import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 1000;
const extensions = new Set(
  ".html .htm .css .js .mjs .json .webmanifest .xml .txt .svg .png .jpg .jpeg .gif .webp .avif .ico .bmp .woff .woff2 .ttf .otf .eot .mp3 .mp4 .webm .ogg .wav .pdf .wasm .vtt .csv".split(
    " ",
  ),
);
const forbidden =
  /^(?:node_modules|vendor|coverage|package(?:-lock)?\.json|npm-shrinkwrap\.json|(?:pnpm|yarn|bun)\.lock.*|(?:credentials?|secrets?|id_rsa|id_ed25519)(?:[._-].*)?)$/i;
const privateContent =
  /-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}/;

function inside(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function findSource(workspaceDirectory: string, requested: string) {
  const root = await realpath(workspaceDirectory);
  if (requested.trim()) {
    const source = path.resolve(root, requested.trim());
    if (!inside(root, source))
      throw new Error("Choose a build folder or HTML file inside this workspace.");
    let actual: string;
    try {
      actual = await realpath(source);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      )
        throw new Error(
          "Build path was not found on this host. Build your site first or choose another folder or HTML file.",
        );
      throw error;
    }
    if (actual !== source)
      throw new Error("Symlink paths cannot be published. Choose the actual build output.");
    return { root, source };
  }
  for (const folder of ["dist", "out", "build", ".output/public", "public"]) {
    const source = path.join(root, folder);
    try {
      if ((await lstat(path.join(source, "index.html"))).isFile()) {
        if ((await realpath(source)) !== source)
          throw new Error("Build output is a symlink. Choose the actual build folder.");
        return { root, source };
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      )
        continue;
      throw error;
    }
  }
  throw new Error(
    "No static build found. Build your site, then enter its output folder (for example dist or out), or an HTML file.",
  );
}

interface FileBytes {
  path: string;
  content: Buffer;
}

export async function readBuild(source: string, token: string | null, signal?: AbortSignal) {
  const files: FileBytes[] = [];
  let bytes = 0;
  let visited = 0;
  const sourceStat = await lstat(source);
  if (sourceStat.isSymbolicLink()) throw new Error("Symlinks cannot be published.");
  const directory = sourceStat.isDirectory();
  if (!directory && !/\.html?$/i.test(source))
    throw new Error(
      "Choose a static build folder or an HTML file. Extract ZIPs into a folder first.",
    );

  async function visit(absolute: string, relative: string, depth: number) {
    signal?.throwIfAborted();
    if (++visited > 2000)
      throw new Error("Build output contains too many entries (maximum 2,000 files and folders).");
    if (depth > 32) throw new Error("Build output is nested too deeply (maximum 32 levels).");
    const name = path.basename(absolute);
    if (
      name.startsWith(".") ||
      forbidden.test(name) ||
      name.includes("\\") ||
      [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
      throw new Error(
        `Cannot publish ${relative}: hidden, dependency, or sensitive paths are excluded. Choose public build output.`,
      );
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Cannot publish symlink: ${relative}`);
    if (stat.isDirectory()) {
      const entries = await readdir(absolute);
      if (entries.length > MAX_FILES) throw new Error("Publish at most 1,000 files.");
      for (const entry of entries.sort())
        await visit(path.join(absolute, entry), `${relative}/${entry}`, depth + 1);
      return;
    }
    if (
      !stat.isFile() ||
      !extensions.has(path.extname(name).toLowerCase()) ||
      /(?:^|[._-])(?:secret|credential|private)(?:[._-]|$)/i.test(name)
    )
      throw new Error(
        `Cannot publish ${relative}: unsupported or sensitive file. Use public static build output.`,
      );
    if (files.length >= MAX_FILES || bytes + stat.size > MAX_BYTES)
      throw new Error("Publish at most 1,000 files and 50 MiB.");
    const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let content: Buffer;
    try {
      const current = await handle.stat();
      if (!current.isFile() || current.size !== stat.size)
        throw new Error("Build changed while reading. Preview it again.");
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = await handle.read(buffer, length, buffer.length - length, null);
        if (read.bytesRead === 0) break;
        length += read.bytesRead;
      }
      if (length !== stat.size) throw new Error("Build changed while reading. Preview it again.");
      content = buffer.subarray(0, length);
    } finally {
      await handle.close();
    }
    if (
      (token && content.includes(Buffer.from(token))) ||
      privateContent.test(content.toString("utf8"))
    )
      throw new Error(`Cannot publish ${relative}: it contains a credential or private key.`);
    bytes += content.length;
    files.push({ path: relative, content });
  }

  if (directory) {
    const entries = await readdir(source);
    if (entries.length > MAX_FILES) throw new Error("Publish at most 1,000 files.");
    for (const entry of entries.sort()) await visit(path.join(source, entry), entry, 0);
  } else {
    await visit(source, "index.html", 0);
  }
  if (!files.some((file) => file.path === "index.html"))
    throw new Error("Build output needs index.html at its root. Choose the folder containing it.");
  const hash = createHash("sha256");
  for (const file of files)
    hash.update(JSON.stringify([file.path, file.content.length])).update(file.content);
  return { files, bytes, digest: hash.digest("hex") };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

// Store-only ZIP avoids extra runtime dependencies and decompression-ratio limits.
export function zip(files: FileBytes[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { path: filename, content } of files) {
    const name = Buffer.from(filename, "utf8");
    if (name.length > 65535) throw new Error("Build contains an overlong filename.");
    let crc = 0xffffffff;
    for (const byte of content) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); // 1980-01-01, the ZIP epoch.
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    header.copy(entry, 6, 4, 30);
    entry.writeUInt32LE(offset, 42);
    local.push(header, name, content);
    central.push(entry, name);
    offset += header.length + name.length + content.length;
  }
  const index = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...local, index, end]);
  if (archive.length > MAX_BYTES)
    throw new Error(
      "ZIP upload exceeds 50 MiB including archive overhead. Remove some assets and preview again.",
    );
  return archive;
}

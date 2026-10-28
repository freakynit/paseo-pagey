import { mkdir, readFile, rename, rm, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class Credentials {
  private readonly directory = path.join(
    process.env.PASEO_HOME || path.join(homedir(), ".paseo"),
    "pagey",
  );
  private readonly file = path.join(this.directory, "credentials.json");

  async read(): Promise<string | null> {
    if (process.env.PAGEY_API_TOKEN?.trim()) return process.env.PAGEY_API_TOKEN.trim();
    try {
      const stored: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (
        !stored ||
        typeof stored !== "object" ||
        !("token" in stored) ||
        typeof stored.token !== "string"
      )
        throw new Error("Invalid credentials");
      return stored.token;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return null;
      throw new Error("Cannot read Pagey credentials. Save the API token again in Pagey settings.");
    }
  }

  async status() {
    const configured = Boolean(await this.read());
    return {
      configured,
      source: process.env.PAGEY_API_TOKEN?.trim()
        ? ("environment" as const)
        : configured
          ? ("file" as const)
          : ("none" as const),
    };
  }

  async save(token: string) {
    if (process.env.PAGEY_API_TOKEN?.trim())
      throw new Error(
        "PAGEY_API_TOKEN is set on the daemon. Remove it before saving a different token here.",
      );
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify({ token }), { mode: 0o600, flag: "wx" });
      await rename(temporary, this.file);
    } finally {
      await rm(temporary, { force: true });
    }
    return this.status();
  }

  async remove() {
    if (process.env.PAGEY_API_TOKEN?.trim())
      throw new Error("Remove PAGEY_API_TOKEN from the daemon environment to disconnect.");
    await rm(this.file, { force: true });
    return this.status();
  }
}

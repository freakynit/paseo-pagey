import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { publishInput, Preview } from "../shared/contracts";
import { findSource, readBuild, zip } from "./archive";
import type { Credentials } from "./credentials";
import type { Pagey } from "./pagey";

interface SavedPreview {
  source: string;
  digest: string;
  owner: string;
  expires: number;
}

export class Publisher {
  private readonly previews = new Map<string, SavedPreview>();
  constructor(
    private readonly credentials: Credentials,
    private readonly pagey: Pagey,
  ) {}

  async preview(
    directory: string,
    requested: string,
    owner: string,
    signal?: AbortSignal,
  ): Promise<Preview> {
    const { source } = await findSource(directory, requested);
    const build = await readBuild(source, await this.credentials.read(), signal);
    for (const [id, preview] of this.previews) {
      if (preview.expires < Date.now()) this.previews.delete(id);
    }
    if (this.previews.size >= 32) this.previews.delete(this.previews.keys().next().value!);
    const id = randomUUID();
    const expires = Date.now() + 15 * 60_000;
    this.previews.set(id, { source, digest: build.digest, owner, expires });
    return {
      id,
      source,
      files: build.files.map(({ path, content }) => ({ path, bytes: content.length })),
      bytes: build.bytes,
      digest: build.digest,
      expiresAt: new Date(expires).toISOString(),
    };
  }

  async publish(input: z.infer<typeof publishInput>, owner: string, signal?: AbortSignal) {
    const preview = this.previews.get(input.previewId);
    if (!preview || preview.expires < Date.now() || preview.owner !== owner)
      throw new Error(
        "This preview expired or belongs to another workspace/session. Preview your build again.",
      );
    if (input.siteId && !input.confirmReplace)
      throw new Error(
        "Updating replaces every file at the existing URL. Confirm replacement to continue.",
      );
    if (input.siteId && (input.title || input.customSubdomain || input.password || input.expiresAt))
      throw new Error(
        "Content updates keep existing site settings. Clear the new-site options before replacing content.",
      );
    if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now())
      throw new Error("Choose an expiry in the future.");
    const { source } = await findSource(preview.source, ".");
    const build = await readBuild(source, await this.credentials.read(), signal);
    if (build.digest !== preview.digest)
      throw new Error(
        "Build files changed since preview. Preview the new build before publishing.",
      );
    const archive = zip(build.files);
    // Recheck after reading: concurrent submissions must consume a preview only once.
    if (!this.previews.delete(input.previewId))
      throw new Error(
        "This preview is already being published. Refresh your sites before retrying.",
      );
    return this.pagey.upload(archive, input, signal);
  }

  dispose() {
    this.previews.clear();
  }
}

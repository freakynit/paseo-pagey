import { z } from "zod";
import { analyticsSchema, siteSchema, type Site } from "../shared/contracts";
import type { Credentials } from "./credentials";

const apiSiteSchema = siteSchema.omit({ url: true });
const messages: Record<number, string> = {
  400: "Pagey rejected the request. Check the title, subdomain, password and expiry; the subdomain may already be taken.",
  401: "Pagey rejected the API token. Create a new token and save it in Pagey settings.",
  403: "Pagey refused this operation. Check site ownership and account permissions in the Pagey dashboard.",
  404: "This Pagey site no longer exists or is unavailable to this account.",
  409: "That Pagey subdomain is already in use. Choose another one.",
  410: "This Pagey site has expired. Manage its expiry in the Pagey dashboard.",
  413: "Pagey rejected the upload size. Publish a smaller build.",
  429: "Pagey's daily allowance or request limit was reached. Wait before retrying; updates do not use the new-site allowance.",
};

export class Pagey {
  constructor(private readonly credentials: Credentials) {}

  async request(
    route: string,
    init: RequestInit = {},
    signal?: AbortSignal,
    tokenOverride?: string,
  ): Promise<unknown> {
    const token = tokenOverride ?? (await this.credentials.read());
    if (!token)
      throw new Error("Connect a free Pagey account in Settings → Plugins → Pagey Site first.");
    const deadline = AbortSignal.timeout(60_000);
    let response: Response;
    try {
      response = await fetch(`https://pagey.site/api${route}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      });
    } catch {
      throw new Error(
        init.method && init.method !== "GET"
          ? "Pagey did not confirm the request. Refresh your sites before retrying: it may already have completed."
          : "Cannot reach Pagey. Check your connection and try again.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        messages[response.status] ?? `Pagey returned HTTP ${response.status}. Try again later.`,
      );
    }
    try {
      // Never relay upstream error bodies, credentials, or host storage fields.
      return await response.json();
    } catch {
      throw new Error("Pagey returned an unreadable response. Refresh your sites before retrying.");
    }
  }

  async check(token?: string) {
    z.object({ user: z.object({ id: z.string() }) }).parse(
      await this.request("/auth/me", {}, undefined, token),
    );
    return { connected: true as const };
  }

  site(value: unknown): Site {
    const parsed = apiSiteSchema.safeParse(value);
    if (!parsed.success)
      throw new Error(
        "Pagey returned an unexpected site response. Refresh your sites before retrying.",
      );
    return { ...parsed.data, url: `https://${parsed.data.subdomain}.pagey.site` };
  }

  async list(page: number, search: string, signal?: AbortSignal) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: "12",
      status: "active",
      search,
    });
    const body = z
      .object({
        items: z.array(z.unknown()),
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
      })
      .parse(await this.request(`/sites?${query}`, {}, signal));
    return { ...body, items: body.items.map((site) => this.site(site)) };
  }

  async analytics(siteId: string, signal?: AbortSignal) {
    const body = z
      .object({ analytics: analyticsSchema })
      .parse(await this.request(`/sites/${siteId}/analytics`, {}, signal));
    return body.analytics;
  }

  async upload(
    archive: Buffer,
    options: {
      siteId?: string;
      title?: string;
      customSubdomain?: string;
      password?: string;
      expiresAt?: string;
    },
    signal?: AbortSignal,
  ) {
    const body = new FormData();
    body.append(
      "file",
      new Blob([new Uint8Array(archive)], { type: "application/zip" }),
      "site.zip",
    );
    if (!options.siteId) {
      for (const key of ["title", "customSubdomain", "password", "expiresAt"] as const) {
        if (options[key]) body.append(key, options[key]);
      }
    }
    const route = options.siteId ? `/sites/${options.siteId}/content` : "/sites";
    const response = z
      .object({ site: z.unknown() })
      .parse(await this.request(route, { method: options.siteId ? "PUT" : "POST", body }, signal));
    return this.site(response.site);
  }
}

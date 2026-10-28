import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const siteSchema = z.object({
  id: z.string().uuid(),
  subdomain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  title: z.string().nullable(),
  status: z.string(),
  isPasswordProtected: z.boolean(),
  maintenanceMode: z.boolean(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  url: z.string().url(),
});
export type Site = z.infer<typeof siteSchema>;

export const previewSchema = z.object({
  id: z.string(),
  source: z.string(),
  files: z.array(z.object({ path: z.string(), bytes: z.number() })),
  bytes: z.number(),
  digest: z.string(),
  expiresAt: z.string(),
});
export type Preview = z.infer<typeof previewSchema>;
export const publishOptions = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  customSubdomain: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/)
    .optional(),
  password: z.string().min(6).max(200).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});
export const publishInput = publishOptions.extend({
  previewId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  confirmReplace: z.boolean().default(false),
});
export const listInput = z.object({
  page: z.number().int().min(1).max(10000).default(1),
  search: z.string().max(255).default(""),
});
export const siteInput = z.object({ siteId: z.string().uuid() });
export const connectionSchema = z.object({
  configured: z.boolean(),
  source: z.enum(["environment", "file", "none"]),
});
export const connectionRpc = defineRpc({
  name: "pagey.connection.request",
  input: z.object({}),
  output: connectionSchema,
});
export const saveTokenRpc = defineRpc({
  name: "pagey.credentials.save.request",
  input: z.object({ token: z.string().trim().min(16).max(256).regex(/^\S+$/) }),
  output: connectionSchema,
});
export const removeTokenRpc = defineRpc({
  name: "pagey.credentials.remove.request",
  input: z.object({}),
  output: connectionSchema,
});
export const checkConnectionRpc = defineRpc({
  name: "pagey.connection.check.request",
  input: z.object({}),
  output: z.object({ connected: z.literal(true) }),
});
export const previewRpc = defineRpc({
  name: "pagey.preview.request",
  input: z.object({ workspaceId: z.string().min(1), path: z.string().max(4096).default("") }),
  output: previewSchema,
});
export const publishRpc = defineRpc({
  name: "pagey.publish.request",
  input: publishInput.extend({ workspaceId: z.string().min(1) }),
  output: siteSchema,
});
export const listRpc = defineRpc({
  name: "pagey.sites.list.request",
  input: listInput,
  output: z.object({
    items: z.array(siteSchema),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
});
export const analyticsSchema = z.object({
  pageViews: z.number(),
  uniqueVisitors: z.number(),
  sessions: z.number(),
  from: z.string(),
  to: z.string(),
});
export type Analytics = z.infer<typeof analyticsSchema>;
export const analyticsRpc = defineRpc({
  name: "pagey.analytics.request",
  input: siteInput,
  output: analyticsSchema,
});

import type { PluginServerContext } from "@getpaseo/plugin/server";
import { Credentials } from "./server/credentials";
import { Pagey } from "./server/pagey";
import { Publisher } from "./server/publisher";
import { createTools } from "./server/tools";
import {
  analyticsRpc,
  checkConnectionRpc,
  connectionRpc,
  listRpc,
  previewRpc,
  publishRpc,
  removeTokenRpc,
  saveTokenRpc,
} from "./shared/contracts";

export default function contribute(server: PluginServerContext) {
  const credentials = new Credentials();
  const pagey = new Pagey(credentials);
  const publisher = new Publisher(credentials, pagey);
  server.handle(connectionRpc, () => credentials.status());
  server.handle(checkConnectionRpc, () => pagey.check());
  server.handle(saveTokenRpc, async ({ token }) => {
    await pagey.check(token);
    return credentials.save(token);
  });
  server.handle(removeTokenRpc, () => credentials.remove());
  server.handle(previewRpc, async ({ workspaceId, path }, { paseo }) => {
    const workspace = await paseo.workspaces.ref(workspaceId).refresh();
    if (!workspace) throw new Error("Workspace is unavailable. Reopen it and try again.");
    return publisher.preview(workspace.workspaceDirectory, path, `workspace:${workspaceId}`);
  });
  server.handle(publishRpc, ({ workspaceId, ...input }) =>
    publisher.publish(input, `workspace:${workspaceId}`),
  );
  server.handle(listRpc, ({ page, search }) => pagey.list(page, search));
  server.handle(analyticsRpc, ({ siteId }) => pagey.analytics(siteId));
  const tools = createTools(publisher, pagey);
  server.before("agent.session_open", ({ request }) => ({
    ...request,
    tools: [...request.tools, ...tools],
  }));
  return () => publisher.dispose();
}

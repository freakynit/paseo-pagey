import type { PluginClientContext } from "@getpaseo/plugin/client";
import { PublishingPanel } from "./client/publishing-panel";
import { PageySettings } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "account",
    title: "Pagey account",
    icon: "CloudUpload",
    Component: PageySettings,
  });
  client.addWorkspacePanel({
    id: "publish",
    title: "Pagey Site",
    icon: "CloudUpload",
    locations: ["workspace", "explorer"],
    Component: PublishingPanel,
  });
  client.addCommandCenterItem({
    id: "publish",
    title: "Pagey: Publish a static site",
    icon: "CloudUpload",
    context: "workspace",
    keywords: ["deploy", "hosting", "website", "free"],
    onSelect({ openPanel }) {
      openPanel("publish");
    },
  });
  client.addCommandCenterItem({
    id: "account",
    title: "Pagey: Connect account",
    icon: "KeyRound",
    context: "global",
    keywords: ["token", "hosting"],
    onSelect({ openSettings }) {
      openSettings("account");
    },
  });
  client.addSlashCommand({
    name: "pagey",
    description: "Open Pagey static site publishing",
    argumentHint: "",
    context: "agent",
    onSubmit({ openPanel }) {
      openPanel("publish");
    },
  });
  return () => {};
}

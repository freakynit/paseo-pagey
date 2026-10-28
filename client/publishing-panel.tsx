import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useRpc, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { copyText, ExternalLink, Icon, ScrollView } from "@getpaseo/plugin/client/ui";
import {
  analyticsRpc,
  connectionRpc,
  listRpc,
  previewRpc,
  publishOptions,
  publishRpc,
  type Analytics,
  type Preview,
  type Site,
} from "../shared/contracts";
import { Action, Card, Feedback, Field, formatBytes } from "./controls";

export function PublishingPanel({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const getConnection = useRpc(connectionRpc);
  const listSites = useRpc(listRpc);
  const previewBuild = useRpc(previewRpc);
  const publishBuild = useRpc(publishRpc);
  const getAnalytics = useRpc(analyticsRpc);
  const [tab, setTab] = useState<"publish" | "sites">("publish");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [allFiles, setAllFiles] = useState(false);
  const [target, setTarget] = useState<Site | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [published, setPublished] = useState<Site | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [analytics, setAnalytics] = useState<{ siteId: string; counts: Analytics } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);

  const loadSites = useCallback(
    async (requestedPage: number, query: string) => {
      const connection = await getConnection({});
      setConnected(connection.configured);
      if (!connection.configured) {
        setSites([]);
        setTotal(0);
        return;
      }
      const result = await listSites({ page: requestedPage, search: query });
      setSites(result.items);
      setPage(result.page);
      setTotal(result.total);
      setAppliedSearch(query);
    },
    [getConnection, listSites],
  );

  const run = useCallback(async (label: string, action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setPending(label);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pagey request failed. Try again.");
    } finally {
      locked.current = false;
      setPending(null);
    }
  }, []);

  useEffect(() => {
    void run("Loading account…", () => loadSites(1, ""));
  }, [loadSites, run]);

  function replace(site: Site) {
    setTarget(site);
    setConfirm(false);
    setTitle("");
    setSubdomain("");
    setPassword("");
    setExpiry("");
    setTab("publish");
    setError(null);
    setMessage(null);
  }

  async function publish() {
    if (!preview) return;
    const options = publishOptions.safeParse({
      title: title.trim() || undefined,
      customSubdomain: subdomain.trim() || undefined,
      password: password || undefined,
      expiresAt: expiry.trim() || undefined,
    });
    if (!options.success) {
      setError(
        options.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(" · "),
      );
      return;
    }
    await run(target ? "Replacing site content…" : "Publishing your site…", async () => {
      // An upload attempt consumes this preview, including uncertain network outcomes.
      setPreview(null);
      const site = await publishBuild({
        ...options.data,
        workspaceId,
        previewId: preview.id,
        siteId: target?.id,
        confirmReplace: confirm,
      });
      setPublished(site);
      setPassword("");
      setTarget(null);
      setConfirm(false);
      setMessage("Published successfully. Your site is ready to share.");
      setSites((current) => [site, ...current.filter((existing) => existing.id !== site.id)]);
      // Refresh pagination on the user's next sites refresh; publishing success stays visible.
    });
  }

  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 13, lineHeight: 20 };
  const busy = Boolean(pending);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      contentContainerStyle={{ padding: layout.compact ? 16 : 28, gap: 20 }}
    >
      <View style={{ width: "100%", maxWidth: 860, alignSelf: "center", gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface2 }}>
            <Icon name="CloudUpload" size={24} color={theme.colors.foreground} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ ...text, fontSize: 24, fontWeight: "700" }}>Build it. Share it.</Text>
            <Text style={muted}>Free static sites, published from Paseo.</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {["No total site cap", "Automatic HTTPS", "25 new sites / day"].map((label) => (
            <View
              key={label}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 6,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              <Text style={{ ...muted, fontSize: 11 }}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Action
            label="Publish"
            icon="CloudUpload"
            theme={theme}
            primary={tab === "publish"}
            disabled={busy}
            onPress={() => setTab("publish")}
          />
          <Action
            label="Your sites"
            icon="Globe"
            theme={theme}
            primary={tab === "sites"}
            disabled={busy}
            onPress={() => {
              setTab("sites");
              void run("Loading sites…", () => loadSites(1, appliedSearch));
            }}
          />
        </View>

        <Feedback theme={theme} error message={error} />
        <Feedback theme={theme} message={pending ?? message} />
        {connected === false ? (
          <Card theme={theme}>
            <Text style={{ ...text, fontWeight: "600" }}>Connect your free Pagey account</Text>
            <Text style={muted}>
              Open Settings → Plugins → Pagey Site → Pagey account, or search “Pagey: Connect
              account” in the Command Center. Create an API token and save it once on this host.
            </Text>
            <ExternalLink
              href="https://pagey.site/signup"
              onError={() =>
                setError("Cannot open signup. Visit pagey.site/signup in your browser.")
              }
            >
              <Text style={{ ...text, textDecorationLine: "underline" }}>
                Create a free account ↗
              </Text>
            </ExternalLink>
            <Action
              label="I've connected my account — refresh"
              theme={theme}
              disabled={busy}
              onPress={() => void run("Checking account…", () => loadSites(1, ""))}
            />
          </Card>
        ) : null}

        {published ? (
          <Card theme={theme}>
            <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
              <Icon name="CircleCheck" size={19} color={theme.colors.foreground} />
              <Text style={{ ...text, fontSize: 16, fontWeight: "600" }}>Your site is live</Text>
            </View>
            <ExternalLink
              href={published.url}
              onError={() =>
                setError("Cannot open your site. Copy its URL and open it in your browser.")
              }
            >
              <Text selectable style={{ ...text, fontSize: 16, textDecorationLine: "underline" }}>
                {published.url}
              </Text>
            </ExternalLink>
            {published.isPasswordProtected ? (
              <Text style={muted}>Visitors need the password you chose.</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Action
                label="Copy URL"
                icon="Copy"
                theme={theme}
                disabled={busy}
                onPress={() =>
                  void run("Copying URL…", async () => {
                    await copyText(published.url);
                    setMessage("Site URL copied.");
                  })
                }
              />
              <Action
                label="Update this site"
                icon="RefreshCw"
                theme={theme}
                disabled={busy}
                onPress={() => replace(published)}
              />
            </View>
          </Card>
        ) : null}

        {tab === "publish" ? (
          <>
            <Card theme={theme}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text style={{ ...text, fontSize: 16, fontWeight: "600" }}>
                  {target ? "Update an existing site" : "Publish a new site"}
                </Text>
                {target ? (
                  <Action
                    label="New site"
                    theme={theme}
                    disabled={busy}
                    onPress={() => {
                      setTarget(null);
                      setConfirm(false);
                    }}
                  />
                ) : null}
              </View>
              {target ? (
                <Text selectable style={muted}>
                  {target.url}
                </Text>
              ) : (
                <Text style={muted}>
                  Choose a build folder or HTML file on this workspace's host. Leave the path empty
                  to detect common build output.
                </Text>
              )}
              <Field
                label="Build folder or HTML file"
                value={path}
                placeholder="Auto-detect · dist, out, build, public…"
                theme={theme}
                disabled={busy}
                onChangeText={(value) => {
                  setPath(value);
                  setPreview(null);
                }}
              />
              {!target ? (
                <>
                  <Field
                    label="Site title (optional)"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="My next great idea"
                    theme={theme}
                    disabled={busy}
                  />
                  <Field
                    label="Pagey subdomain (optional)"
                    value={subdomain}
                    onChangeText={setSubdomain}
                    placeholder="your-project → your-project.pagey.site"
                    theme={theme}
                    disabled={busy}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setAdvanced((value) => !value)}
                  >
                    <Text style={{ ...muted, textDecorationLine: "underline" }}>
                      {advanced ? "Hide password & expiry" : "Password & expiry (optional)"}
                    </Text>
                  </Pressable>
                  {advanced ? (
                    <>
                      <Field
                        label="Visitor password (at least 6 characters)"
                        value={password}
                        onChangeText={setPassword}
                        secure
                        theme={theme}
                        disabled={busy}
                      />
                      <Field
                        label="Expiry (ISO date and time, optional)"
                        value={expiry}
                        onChangeText={setExpiry}
                        placeholder="2027-01-01T00:00:00Z"
                        theme={theme}
                        disabled={busy}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              <Action
                label={pending === "Inspecting build…" ? "Inspecting build…" : "Preview files"}
                icon="Files"
                theme={theme}
                disabled={busy}
                onPress={() =>
                  void run("Inspecting build…", async () => {
                    setPreview(null);
                    setAllFiles(false);
                    setPreview(await previewBuild({ workspaceId, path }));
                  })
                }
              />
            </Card>
            {preview ? (
              <Card theme={theme}>
                <Text style={{ ...text, fontWeight: "600", fontSize: 16 }}>
                  Ready to {target ? "update" : "publish"} · {preview.files.length}{" "}
                  {preview.files.length === 1 ? "file" : "files"} · {formatBytes(preview.bytes)}
                </Text>
                <Text selectable style={muted}>
                  {preview.source}
                </Text>
                <View style={{ gap: 7 }}>
                  {(allFiles ? preview.files : preview.files.slice(0, 12)).map((file) => (
                    <View
                      key={file.path}
                      style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}
                    >
                      <Text selectable style={{ ...text, fontSize: 12, flex: 1 }}>
                        {file.path}
                      </Text>
                      <Text style={{ ...muted, fontSize: 12 }}>{formatBytes(file.bytes)}</Text>
                    </View>
                  ))}
                </View>
                {preview.files.length > 12 ? (
                  <Action
                    label={allFiles ? "Show fewer files" : `Show all ${preview.files.length} files`}
                    theme={theme}
                    onPress={() => setAllFiles((value) => !value)}
                  />
                ) : null}
                <Text style={muted}>
                  These files will be uploaded to Pagey. Review them for private content. The
                  preview expires in 15 minutes; changing any file requires a new preview.
                </Text>
                {target ? (
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Switch
                      accessibilityLabel="Confirm replacing all existing site files"
                      value={confirm}
                      onValueChange={setConfirm}
                      disabled={busy}
                    />
                    <Text style={{ ...muted, flex: 1 }}>
                      Replace every file at {target.url}. Existing content will be removed. Site
                      settings and the URL stay the same.
                    </Text>
                  </View>
                ) : null}
                <Action
                  label={target ? "Replace site content" : "Publish to Pagey"}
                  icon="CloudUpload"
                  theme={theme}
                  primary
                  disabled={busy || !connected || (Boolean(target) && !confirm)}
                  onPress={() => void publish()}
                />
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <Card theme={theme}>
              <Field
                label="Find a site"
                value={search}
                onChangeText={setSearch}
                placeholder="Search titles or subdomains"
                theme={theme}
                disabled={busy}
              />
              <Action
                label="Search / refresh sites"
                icon="Search"
                theme={theme}
                disabled={busy}
                onPress={() => void run("Loading sites…", () => loadSites(1, search))}
              />
            </Card>
            {!sites.length && connected && !busy ? (
              <Text style={muted}>
                No sites found. Publish your first site or try a different search.
              </Text>
            ) : null}
            {sites.map((site) => (
              <Card theme={theme} key={site.id}>
                <Text style={{ ...text, fontSize: 16, fontWeight: "600" }}>
                  {site.title || site.subdomain}
                </Text>
                <ExternalLink
                  href={site.url}
                  onError={() =>
                    setError("Cannot open this site. Copy its URL and open it in your browser.")
                  }
                >
                  <Text selectable style={{ ...muted, textDecorationLine: "underline" }}>
                    {site.url}
                  </Text>
                </ExternalLink>
                <Text style={{ ...muted, fontSize: 12 }}>
                  {site.isPasswordProtected ? "Password protected · " : ""}
                  {site.maintenanceMode ? "Maintenance mode · " : ""}
                  {site.expiresAt ? `Expires ${site.expiresAt}` : "No expiry"}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Action
                    label={`Update ${site.subdomain}`}
                    theme={theme}
                    disabled={busy}
                    onPress={() => replace(site)}
                  />
                  <Action
                    label={`Analytics for ${site.subdomain}`}
                    icon="ChartNoAxesCombined"
                    theme={theme}
                    disabled={busy}
                    onPress={() =>
                      void run("Loading analytics…", async () => {
                        setAnalytics({
                          siteId: site.id,
                          counts: await getAnalytics({ siteId: site.id }),
                        });
                      })
                    }
                  />
                  <Action
                    label={`Copy URL for ${site.subdomain}`}
                    icon="Copy"
                    theme={theme}
                    disabled={busy}
                    onPress={() =>
                      void run("Copying URL…", async () => {
                        await copyText(site.url);
                        setMessage("Site URL copied.");
                      })
                    }
                  />
                </View>
                {analytics?.siteId === site.id ? (
                  <Text style={muted}>
                    Last 7 days · {analytics.counts.pageViews} views ·{" "}
                    {analytics.counts.uniqueVisitors} visitors · {analytics.counts.sessions}{" "}
                    sessions
                  </Text>
                ) : null}
              </Card>
            ))}
            {connected ? (
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}
              >
                <Action
                  label="Previous page"
                  theme={theme}
                  disabled={busy || page <= 1}
                  onPress={() =>
                    void run("Loading sites…", () => loadSites(page - 1, appliedSearch))
                  }
                />
                <Text style={muted}>
                  Page {page} · {total} {total === 1 ? "site" : "sites"}
                </Text>
                <Action
                  label="Next page"
                  theme={theme}
                  disabled={busy || page * 12 >= total}
                  onPress={() =>
                    void run("Loading sites…", () => loadSites(page + 1, appliedSearch))
                  }
                />
              </View>
            ) : null}
          </>
        )}
        <ExternalLink
          href="https://pagey.site/dashboard"
          onError={() =>
            setError("Cannot open the dashboard. Visit pagey.site/dashboard in your browser.")
          }
        >
          <Text style={{ ...muted, textDecorationLine: "underline" }}>
            Open Pagey dashboard for forms, share links and more ↗
          </Text>
        </ExternalLink>
        <Text style={{ ...muted, fontSize: 11 }}>
          Static files only · No build commands run automatically · Updates keep the same URL and
          don't use the new-site allowance.
        </Text>
      </View>
    </ScrollView>
  );
}

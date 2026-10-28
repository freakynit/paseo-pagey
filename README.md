# Pagey Site for Paseo

**Build in Paseo. Publish for free. Keep the link when you update.**

Turn a static build folder or an HTML file into a live website without leaving
Paseo. [Pagey](https://pagey.site/) provides free static hosting with **no cap on
total sites**, automatic HTTPS, and no subscription or credit card.

Registered accounts can create **25 new sites per UTC day**. Updating an existing
site does not use that allowance. Upload and request limits still apply.

![Pagey publishing panel inside Paseo](https://raw.githubusercontent.com/freakynit/paseo-pagey/main/assets/publishing.png)

> Publish this build folder to Pagey and give me the link.

For portfolios, landing pages, project demos, documentation, event pages, and
client previews: build your files, review the upload, and share a real URL.

[See the live publishing demo](https://comet-everest-saffron.pagey.site/) ·
[Pagey API reference](https://pagey.site/api-docs) ·
[Report an issue](https://github.com/freakynit/paseo-pagey/issues)

## Install

Requires **Paseo 0.14.0-beta.1 or later** on both the daemon and connected app.
The agent-tool API used here is not available in Paseo 0.13.2 stable.

```sh
paseo plugin add git:freakynit/paseo-pagey --ref v1.0.0
```

You can also paste `git:freakynit/paseo-pagey` into Paseo's plugin installation
screen. If external plugins are disabled, enable them in that host's plugin
settings. Plugins run trusted code on your host and inside the app; review the
source before enabling them.

Connect your account once:

1. [Create a free Pagey account](https://pagey.site/signup), or sign in.
2. Open [API tokens](https://pagey.site/dashboard/api-tokens) and create a token.
3. In Paseo's Command Center, search **Pagey: Connect account**. Paste the token
   and choose **Verify and save token**.

The same screen lives under **Settings → Plugins → Pagey Site → Pagey account**.
The account is shared by authorized clients connected to that daemon host, so
you can publish from your phone while the files stay on your development machine
until you choose to upload them.

## Publish from Paseo

Open a workspace, then choose **Pagey: Publish a static site** in the Command
Center, select **Pagey Site** from the workspace tab or Explorer launcher, or
enter `/pagey` in the agent composer.

1. Build your site with your normal build command.
2. Enter its output folder, such as `dist`, `out`, or `build`. Leave the path
   empty to detect `dist/`, `out/`, `build/`, `.output/public/`, or `public/`.
3. Optionally set a title, a custom `your-project.pagey.site` subdomain, a visitor
   password, or an expiry date.
4. Choose **Preview files**, review the filenames and sizes, then **Publish to Pagey**.
5. Open or copy the live URL from the result.

A single `.html` or `.htm` file works too; it is published as `index.html`.
For folders, `index.html` must already be at the root. Extract ZIP archives into
a folder before selecting them. Build commands never run automatically.

### Update without changing the URL

Open **Your sites**, find the site, and choose **Update**. Preview the new build,
confirm that every existing file will be replaced, then publish. The URL,
password, title, expiry, and other site settings stay the same.

Replacement removes files that are missing from the new build. There is no
plugin rollback or automatic backup; keep your build output or version history.

### Ask your coding agent

The plugin adds four tools to agents through Paseo:

| Tool               | What it does                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| `pagey_preview`    | Inspect an HTML file or build folder; return a file list and preview ID      |
| `pagey_publish`    | Publish that preview, or replace a site's content with explicit confirmation |
| `pagey_list_sites` | Search and paginate your active sites; return IDs and public URLs            |
| `pagey_analytics`  | Read aggregate views, unique visitors, and sessions for the last seven days  |

For example:

> Preview `dist`, then publish it to Pagey as “My portfolio”. Use `my-portfolio`
> as the subdomain if it is available.

> Update my existing Pagey portfolio with the new `dist` build. Replace all its
> files and keep the same URL.

Agent tools use the token saved on the host. You never need to paste it into an
agent conversation. Existing sessions receive the tools on their next idle prompt
after Paseo reopens the session; a running turn continues normally.

## Included

| Capability                                                    | Where                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Free hosting with no total site cap                           | Publish panel and agent tools                          |
| Automatic HTTPS and custom Pagey subdomains                   | New-site publishing                                    |
| File preview, sizes, and build-change detection               | Before every upload                                    |
| Password protection and expiry                                | Optional new-site settings                             |
| Updates at the same URL                                       | Your sites → Update, or `pagey_publish` with a site ID |
| Site search and pagination                                    | Your sites                                             |
| Aggregate visitor analytics                                   | Your sites → Analytics, or `pagey_analytics`           |
| Forms, share links, file editing, maintenance, and AI builder | Linked Pagey dashboard                                 |

This plugin publishes static HTML, CSS, JavaScript, fonts, images, and other
public assets. It does not deploy server processes, API routes, databases, or
framework SSR runtimes. Use your framework's static export when necessary.
Anonymous uploads are not included; connect a free account to manage and update sites.

## Upload checks and data access

- **Only the selected build output.** Paths must stay inside the workspace or
  calling agent's working directory. The local limit is 1,000 files and 50 MiB;
  ZIP overhead counts toward the upload limit. Very large or deeply nested trees
  are rejected. Pagey may apply additional server limits.
- **No hidden files, symlinks, source maps, dependency folders, or common secret
  files.** Unsupported file types and detected private keys or common credential
  patterns are rejected. The saved Pagey token is checked against every file's
  bytes. These checks cannot identify every secret: review your public build.
- **The reviewed bytes are the published bytes.** Previews expire after 15 minutes
  and can be used once. If a file changes, preview again. Previews are kept in
  memory and disappear when the plugin reloads.
- **Uploads happen on request.** Nothing is uploaded at installation, activation,
  preview, or account verification. Publishing sends the selected files and
  supplied site options to `https://pagey.site/api`.
- **Tokens stay on the daemon host.** The settings screen writes
  `$PASEO_HOME/pagey/credentials.json` (default `~/.paseo/pagey/credentials.json`)
  using a private directory and file permissions on POSIX systems. This is ordinary
  JSON, not an encrypted vault. Alternatively, set `PAGEY_API_TOKEN` in the daemon
  environment; it takes precedence over the saved token. The plugin never returns
  the token in RPC responses, logs, or agent tool results.
- **Site metadata reaches your clients.** URLs, titles, file paths, sizes, and
  aggregate analytics are returned to Paseo. When an agent uses a tool, its result
  also reaches that agent's provider. The plugin has no separate telemetry.

Requests go only to Pagey's HTTPS API, refuse redirects, and have a 60-second
deadline. The plugin does not retry uploads automatically. If an upload times out,
refresh **Your sites** or call `pagey_list_sites` before retrying: Pagey may already
have completed the operation. Upstream error bodies and internal storage fields
are not forwarded to clients.

Removing the plugin does not delete your Pagey sites or revoke the API token.
Use **Forget saved token** before removal to erase the plugin's credential file,
or revoke the token in Pagey's dashboard. The environment variable must be removed
from the daemon environment separately.

## Development

Node.js 22 or later. All dependencies are for development; installation in Paseo
requires no npm preparation, build step, or extra runtime packages.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run format:check
```

Server code uses Node APIs; client code uses React Native and Paseo's UI SDK for
web, Electron, iOS, and Android. Shared files contain only RPC schemas and plain
values. See [Paseo's plugin documentation](https://paseo.sh/docs/plugins).

Pagey's free offering and allowances were checked against its
[published product information](https://pagey.site/llms.txt) on October 28, 2026.
This is an independent community plugin, not an official Paseo or Pagey integration.
Also available: [Pagey Site for Herdr](https://github.com/freakynit/herdr-pagey).

MIT licensed.

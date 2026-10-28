Publish static build folders or individual HTML files to Pagey from a Paseo
workspace panel or an agent conversation. Pagey provides free static hosting
with automatic HTTPS, no subscription or credit card, and no cap on total sites.
Registered accounts can create 25 new sites per UTC day; content updates do not
consume that allowance. Other upload and request limits apply.

The panel previews filenames and sizes before publishing. Updates replace every
file at the existing URL after confirmation, preserving the site's settings.
You can search your active sites, copy their URLs, and read aggregate visitor
analytics for the last seven days. Optional new-site settings include a custom
Pagey subdomain, visitor password, and expiry. The linked Pagey dashboard provides
forms, share links, file editing, maintenance settings, and the AI builder.

## Setup

Requires Paseo 0.14.0-beta.1 or later on the daemon and connected app; the agent
tools are unavailable in 0.13.2 stable. Create a free account at
[pagey.site](https://pagey.site/signup), then create an
[API token](https://pagey.site/dashboard/api-tokens).
Open **Pagey: Connect account** in the Command Center, or **Settings → Plugins →
Pagey Site → Pagey account**, and verify and save the token. Authorized users of
that daemon host share the account.

Open **Pagey: Publish a static site**, select **Pagey Site** from the workspace
or Explorer launcher, or enter `/pagey` in the composer. Choose a build folder
with `index.html` at its root, or an HTML file. Empty paths detect common build
folders. Build your site first; the plugin never runs build commands. Extract ZIPs
before selecting their folder. Server processes and SSR runtimes are not supported.

## Access and limits

The plugin reads the selected files on the daemon host and sends them to
`https://pagey.site/api` only when publishing. Previews upload nothing. Paths must
stay inside the workspace or calling agent's working directory. Local limits are
1,000 files and 50 MiB including ZIP overhead. Hidden files, symlinks, dependency
folders, source maps, unsupported file types, and detected credentials are
rejected. Review your public build; these checks cannot detect every secret.

Previews expire after 15 minutes, can be used once, and require unchanged file
contents. Requests have a 60-second deadline and uploads are not automatically
retried. After an uncertain failure, refresh the site list before retrying.
Content replacement removes the old files; the plugin has no rollback or backup.

The API token is stored in `$PASEO_HOME/pagey/credentials.json`, defaulting to
`~/.paseo/pagey/credentials.json`, with private file permissions on POSIX systems.
It is ordinary JSON, not an encrypted vault. `PAGEY_API_TOKEN` in the daemon
environment takes precedence. The token goes only to Pagey's API and is never
returned to clients or agent tools. Forget the saved token before uninstalling
to remove the file; uninstalling does not delete hosted sites or revoke tokens.

The four agent tools preview files, publish or update sites, list sites, and read
aggregate analytics. Their results include filenames, paths, sizes, site metadata,
URLs, and counts, which are visible to the calling agent's provider. The plugin
does not send uploaded file contents through tool results and has no separate
telemetry. No runtime dependencies or additional software installation are needed.

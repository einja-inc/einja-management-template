---
"@einja-inc/create-app": minor
---

Add `--apps-detail <apps>` and `--packages-detail <packages>` CLI flags to `sync` command for non-interactive subset selection (e.g. `sync --categories packages --packages-detail admin-ui --yes`). Fix bug where `--yes` did not suppress interactive prompts when used with `--categories`.

- New: `--apps-detail <list>` and `--packages-detail <list>` CLI flags
- New: `SyncOptions.appsDetail` / `SyncOptions.packagesDetail` fields
- Fix: `detectProjectConfig` failure now triggers `process.exit(1)` in `--categories` mode (previously only in `--yes` mode)
- Improved: Input sanitization for CSV list values (trim, drop empty)
- Improved: Safe-name validation for `apps`/`packages` detail entries

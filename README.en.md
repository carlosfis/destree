# DesTree

🇪🇸 [Versión en español](README.md)

Single source of truth for agencies and product teams: a canvas with the **software tree** (applications → features → variants), their **Design Systems and UI Kits**, owners, teams (cells), documentation and versions. Self-hosted, multi-page, with admin / head / designer roles.

- **Canvas**: nested containers (branches), DS and UI Kits inside each software, "uses DS" and "derives from" connections, tags, auto-layout, minimap, undo/redo.
- **Team**: cells with members; roots and pages visible to the whole organization or only to certain cells; assignees and owner per card; designers only see what is theirs, in read-only mode.
- **Documentation**: links (Figma, Notion, repos…) and markdown notes per card; safe images (WebP + thumbnail).
- **History**: automatic and manual versions per page, diff and restore; schedulable tar.gz backups; organization export/import.
- **No heavy dependencies**: Node 22 + Fastify 5 + SQLite (`node:sqlite`), vanilla ESM client without a bundler. Only native dependency: `sharp`.

> Figma (metrics, thumbnails, webhooks) is out of scope: the app is complete without it; links to Figma files are added by hand under Documentation.

## At a glance
| Canvas | Instance sidebar | Page lobby |
|---|---|---|
| ![Canvas with the software tree, Design Systems and UI Kits](docs/img/canvas.png) | ![Sidebar of a Main instance: type, name, image, tags and relations](docs/img/drawer.png) | ![Lobby with several pages](docs/img/lobby.png) |

▶ **Intro video** (84 s): not published yet; rendered with `node promo/render.js`.

## Quick install (Docker)
```
git clone https://github.com/carlosfis/destree.git && cd destree
cp .env.example .env            # adjust PORT/DOMAIN if needed
docker compose up -d            # http://localhost:3000 → setup wizard (organization + admin)
```
`./data` holds the database, images and backups. `docker compose down && docker compose up -d` keeps everything. Automatic HTTPS: set `DOMAIN=your.domain` in `.env` and run `docker compose --profile https up -d`.

## Without Docker
```
npm ci && cp .env.example .env
npm run migrate      # creates data/destree.db
npm start            # http://localhost:3000
```
Requires Node ≥ 22.13. Behind a TLS proxy: `TRUST_PROXY=1`.

## Updating
Docker: `docker compose pull && docker compose up -d` (or `--build` if you cloned). Without Docker: `git pull && npm ci && npm start`. Migrations run automatically at startup; take a backup first (`npm run backup` or `#/admin → Respaldos`).

## Backup and restore
- Manual: `#/admin → Respaldos → Crear` (downloadable) or `npm run backup`. Scheduled: `BACKUP_CRON="30 3 * * *"` in `.env` (`BACKUP_KEEP` keeps the last N).
- Restore: with the server stopped, `node scripts/restore.js data/backups/destree-<date>.tar.gz` (Docker: `docker compose run --rm destree node scripts/restore.js /data/backups/<file>` with the service stopped). The previous data is kept in `data/restore-prev-<date>/`.
- Logical alternative: export/import the organization as JSON from `#/admin → Respaldos`.

## Roles
| | admin | head | designer |
|---|---|---|---|
| Canvas, documentation, pages | edit | edit | read-only (what is visible) |
| Users and roles | ✓ | — | — |
| Invite | any role | designers into their cells | — |
| Cells | create/edit | members of their own | — |
| Root/page visibility, assignees | ✓ | ✓ | — |
| Versions | view/create/restore | view/create/restore | view |
| Delete/restore pages, backups, audit log | ✓ | — | — |

## Documentation
Product docs are in Spanish (the UI language): `docs/INSTALL.md` (installation and variables) · `docs/ADMIN.md` (administration) · `docs/USER.md` (using the canvas) · `docs/API.md` · `docs/SECURITY.md` (threat model and headers) · `docs/MAP.md` (code map) · `docs/DECISIONS.md` · `CONTRIBUTING.md` · `CODE_OF_CONDUCT.md` · `SECURITY.md` (reporting vulnerabilities) · `CHANGELOG.md` · `PENDIENTE.md` (detailed roadmap by phases).

## Roadmap
Done: own password change and reset from Administration · security headers and strict CSP · English README and screenshots. Pending (details and status in `PENDIENTE.md`): published video · SMTP mail for invitations and password recovery · v1.0.0. Out of scope for now: Figma integration, SSO/OAuth.

## License
MIT — see `LICENSE`.

# Instalación

## Requisitos
- Docker + Docker Compose **o** Node ≥ 22.13 (usa `node:sqlite`; sin compiladores salvo que `sharp` no tenga binario para tu plataforma).
- 1 CPU / 512 MB bastan. Datos en una carpeta (`./data` o volumen `/data`).

## Docker (recomendado)
```
git clone https://github.com/carlosfis/destree.git && cd destree
cp .env.example .env
docker compose up -d
```
Abre `http://localhost:3000`: el primer arranque pide nombre de organización y cuenta admin.
- Imagen publicada: `ghcr.io/carlosfis/destree:<versión>` (amd64/arm64). `docker compose pull` para actualizar.
- La carpeta `./data` debe ser escribible por el usuario `node` (uid 1000): `sudo chown -R 1000:1000 data` si el contenedor no arranca.
- HTTPS: `DOMAIN=destree.ejemplo.com` en `.env`, puertos 80/443 libres, `docker compose --profile https up -d` (Caddy obtiene el certificado). Pon `TRUST_PROXY=1`.

## Sin Docker
```
npm ci
cp .env.example .env
npm run migrate
npm start          # o: npm run dev (recarga automática)
```
Para producción usa un gestor de procesos (systemd, pm2) y un proxy TLS (Caddy/nginx) con `TRUST_PROXY=1`.

## Variables (`.env`)
| Variable | Defecto | Uso |
|---|---|---|
| `PORT`, `HOST` | 3000, 127.0.0.1 (Docker: 0.0.0.0) | Escucha |
| `DATABASE_PATH` | `./data/destree.db` | SQLite; `uploads/`, `backups/` se crean al lado |
| `UPLOADS_DIR`, `BACKUPS_DIR` | junto a la BD | Carpetas alternativas |
| `TRUST_PROXY` | — | `1` detrás de proxy TLS (cookie `Secure`, `X-Forwarded-*`) |
| `LOG_LEVEL` | info | pino |
| `VERSIONS_KEEP`, `VERSIONS_COALESCE_MIN` | 50, 5 | Versiones automáticas por página |
| `BACKUP_CRON`, `BACKUP_KEEP` | —, 10 | Respaldos programados (cron 5 campos, hora local) |

## Actualización
1. Respaldo (`npm run backup` o `#/admin → Respaldos`).
2. `docker compose pull && docker compose up -d` o `git pull && npm ci`.
3. Las migraciones (`server/db/migrations`) se aplican al arrancar; revisa `CHANGELOG.md`.

## Restauración
Servidor parado → `node scripts/restore.js <respaldo.tar.gz>` → arrancar. Detalle en `README.md`.

## Comprobación
- `curl -s localhost:3000/api/health` → `{ "ok": true, "version": "…", "db": "ok", ... }`.
- `curl -I localhost:3000/` → cabeceras de seguridad (`Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`); `curl -I localhost:3000/api/health` no lleva CSP. Detalle en `docs/SECURITY.md`.
- Parar: `docker compose down` (o Ctrl+C / `systemctl stop`) hace un cierre ordenado: SQLite se cierra y `.server.lock` desaparece de la carpeta de datos.

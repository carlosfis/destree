# PENDIENTE — requiere intervención del usuario

Lista viva. Claude añade aquí lo que no puede resolver solo; el usuario lo despacha cuando esté disponible y borra la línea.

## Abiertos
- **F7 · Docker no está instalado en esta máquina.** Verificar en una máquina con Docker: `git clone … && cp .env.example .env && docker compose up -d --build && curl -s localhost:3000/api/health` → setup en :3000; `docker compose down && docker compose up -d` conserva `./data`. Si `sharp` falla en el build, avísame con el log.
- **F7 · Paquete GHCR.** `ghcr.io/carlosfis/destree:0.1.0` y `:latest` ya existen (release.yml OK, 3m45s). Por defecto el paquete es privado: para `docker compose pull` sin login, hacerlo público en GitHub → Packages → destree → Package settings → Change visibility. Comprobar: `docker manifest inspect ghcr.io/carlosfis/destree:0.1.0` (amd64 + arm64).
- **F8a · ALTO.** Según `PLAN.md` §5 F8a, no se continúa con Figma: el MVP queda sin esa función. Dime si quieres seguir con F9b-sin-Figma (correo SMTP para invitaciones), F11a (hardening/e2e) o cerrar.

## Resueltos
- 2026-10-07 F7 · CI (`ci.yml`) verde en main. Release `v0.1.0` creada por `release.yml` (imagen multi-arch + zip). Nota: GitHub no dispara workflows al subir >3 tags a la vez; `v0.1.0` se re-subió solo.

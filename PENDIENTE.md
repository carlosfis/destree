# PENDIENTE — requiere intervención del usuario

Lista viva. Claude añade aquí lo que no puede resolver solo; el usuario lo despacha cuando esté disponible y borra la línea.

## Abiertos
- **F7 · Docker no está instalado en esta máquina.** Verificar en una máquina con Docker: `git clone … && cp .env.example .env && docker compose up -d --build && curl -s localhost:3000/api/health` → setup en :3000; `docker compose down && docker compose up -d` conserva `./data`. Si `sharp` falla en el build, avísame con el log.
- **F7 · Release v0.1.0 en GitHub.** El tag `v0.1.0` ya está en `origin`; `release.yml` debe construir `ghcr.io/carlosfis/destree:0.1.0` y `:latest` (amd64+arm64) y crear la Release con zip. Revisar en https://github.com/carlosfis/destree/actions y, si el paquete queda privado, hacerlo público en Packages → destree → Package settings. Comprobar: `docker manifest inspect ghcr.io/carlosfis/destree:0.1.0`.
- **F7 · CI.** Confirmar que `ci.yml` (lint + test en ubuntu/Node 22) pasa en https://github.com/carlosfis/destree/actions. Si falla por `sharp`/`node:sqlite`, pásame el log.
- **F8a · ALTO.** Según `PLAN.md` §5 F8a, no se continúa con Figma: el MVP queda sin esa función. Dime si quieres seguir con F9b-sin-Figma (correo SMTP para invitaciones), F11a (hardening/e2e) o cerrar.

## Resueltos

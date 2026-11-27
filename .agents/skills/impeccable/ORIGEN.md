# Origen

- Repo: https://github.com/pbakaus/impeccable (Paul Bakaus), licencia Apache 2.0 (ver LICENSE).
- Versión: skill 4.6.0, commit `6af45ac9a5eb8792f033d3242f52e99812fd91fa`, copiado el 2026-10-16 desde `.claude/skills/impeccable/`.
- Se copiaron **solo** `SKILL.md` y `reference/` (texto revisado). La carpeta `scripts/` (lanzador que descarga y ejecuta un binario del detector) **no se versiona**: sin ella la skill usa su modo "Launcher unavailable" y lee PRODUCT.md/DESIGN.md directamente.
- Quien quiera el detector en su máquina copia `scripts/` del commit de arriba y lo excluye de git en local (`.git/info/exclude`).
- Para actualizar: revisar el diff del repo de origen antes de copiar.

## Copia para ÑandeFinanza

- Copiada el 2026-11-27 desde `/home/edisonubutun/SifenPortal/sifenportal-web/.claude/skills/impeccable/` por pedido del dueño.
- Se conserva el SKILL, sus referencias y LICENSE originales.
- En este repositorio se incluyen también los lanzadores y scripts de texto provistos en SifenPortal; no se versiona ningún binario descargado ni caché del detector. La nota anterior sobre excluir `scripts/` describe la política de SifenPortal, no esta copia.

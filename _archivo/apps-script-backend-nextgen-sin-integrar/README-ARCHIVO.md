# Archivado el 2026-10-19 — nunca se integró a producción

Este backend ("capa Opus", commit único `e843b95`, 2026-06-30) fue un diseño de próxima
generación para el motor BAIP: identidad por enlace-capacidad `?sid=`, autosave en la nube
con Google Sheets como fuente de verdad, resolución de conflicto por `rev`, y migración de
esquema. `SPEC.md` es el contrato completo; `Code.gs` y `sync.client.js` son la implementación
parcial, con piezas explícitamente marcadas `TODO(Sonnet)` (PDF a Drive, notificaciones Gmail,
panel/Looker, `saveFeedback`/`sendFeedback`/`listCohort`, validaciones, a11y).

**Nunca se integró.** Ningún HTML en producción (ni entonces ni ahora) referencia
`sync.client.js`, `WEBAPP_URL`, `getIdentity()` ni las acciones de esta API (`load`,
`autosave`, `submit`, `getFeedback`). Los tres instrumentos vivos (S01, S02, audición) siguen
usando el motor real: `backend/Codigo.gs` + `backend/Panel.gs`, con `localStorage` como
autosave y envío puntual por `fetch` — ver `CLAUDE.md` del repo.

**Por qué se archiva en vez de borrarse:** el diseño es sólido y la decisión de arquitectura
(capability link + Sheets + `rev`) sigue siendo válida si algún día se justifica el salto a
autosave multi-dispositivo en la nube. Se archiva para que ninguna sesión futura lo confunda
con código que corre, no para descartar el trabajo. Si se retoma, hacerlo como proyecto nuevo
y deliberado — no reactivarlo a medias dentro de un cambio de otra cosa.

Hallazgo de la auditoría 2026-10-19 (ver `CLAUDE.md`, sección «Fallbacks — inventario» e
historial de `project_backend_envio.md` en memoria).

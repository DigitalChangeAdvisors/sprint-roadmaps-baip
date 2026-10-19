# BAIP Roadmaps · Backend Google Workspace — Especificación de diseño (capa Opus)

> Este documento es el **contrato de construcción**. Las piezas críticas de seguridad,
> el protocolo de autosave/conflicto, el versionado y la privacidad están decididos aquí.
> La implementación restante (PDF, Looker, panel, validaciones) se ejecuta sobre este contrato.

## Decisiones bloqueadas (asunciones de diseño)

1. **Identidad = enlace-capacidad `?sid=<UUID>`.** Cada estudiante recibe un enlace personal
   `https://…/sprint-roadmap-02-baip/?sid=<uuid-v4>`. El `sid` es un *bearer capability token*:
   conocerlo otorga acceso de lectura/escritura **solo** a los datos de ese estudiante.
   La resolución de identidad está aislada en `resolveIdentity()` (servidor) y `getIdentity()`
   (cliente), de modo que migrar a **Google Sign-In** después es un cambio localizado, no un rediseño.
2. **Autosave a la nube, *debounced*, con guarda de revisión (`rev`).** El `localStorage` sigue
   siendo caché instantánea/offline; la **fuente de verdad durable** es Google Sheets. Esto da
   persistencia central (#1) y multi-dispositivo (#11) desde el día 1, sin depender del "Enviar".
3. **Separación de planos de seguridad.** El Web App público es **solo de estudiante** y siempre
   *scoped* al `sid`. Las operaciones de facilitador/DCA (leer cualquier estudiante, escribir y
   enviar feedback) **no se exponen** en el endpoint público: corren en un script *bound* al
   Spreadsheet (se ejecuta con la identidad Google del facilitador) o requieren `ADMIN_TOKEN`
   guardado en Script Properties (nunca en el cliente).
4. **Dueño del Apps Script = cuenta de rol de DCA** (no personal), por continuidad.

## Riesgo aceptado y mitigaciones (capability URL)

Si un estudiante reenvía su enlace, el receptor puede editar sus datos. Aceptable para una
cohorte conocida y datos de baja sensibilidad, **con** estas mitigaciones:
- `sid` = 128 bits aleatorios (UUID v4), no adivinable ni enumerable.
- El servidor valida que el `sid` exista y esté `activo` en `Roster`; rechaza lo demás.
- **Todas** las operaciones se *scopean* por `sid` derivado del token; el cliente nunca puede
  pedir datos de otro `sid`.
- Toda escritura queda en `Auditoría` (timestamp, acción, agente).
- Camino de endurecimiento futuro: enlazar `sid` ↔ email y exigir Google Sign-In (ver decisión 1).

---

## Arquitectura

```
HTML (GitHub Pages, ?sid=…)
   localStorage  ← caché instantánea / offline
        │  fetch (simple request, text/plain)
        ▼
Apps Script Web App  =  API pública (SOLO estudiante, scoped por sid)
        ├── Google Sheets  = base de datos (Roster, Autosave, Respuestas, Feedback, Auditoría)
        ├── Google Drive   = PDFs/evidencias  /BAIP/<cohorte>/<estudiante>/   [Sonnet]
        └── Gmail (MailApp) = notificación de acuse / feedback                 [Sonnet]

Script bound al Spreadsheet  =  operaciones de facilitador/DCA (identidad Google + ADMIN_TOKEN)
Looker Studio sobre el Spreadsheet = panel de cohorte                          [Sonnet]
```

---

## CORS — patrón obligatorio (esto es lo que hace que "Enviar" tenga acuse real)

Apps Script no fija cabeceras CORS arbitrarias en `script.google.com`, **pero** la respuesta final
(tras el 302 a `*.googleusercontent.com`) se sirve con `Access-Control-Allow-Origin: *`. Por tanto:

- El cliente **debe** usar *simple requests* (sin *preflight*):
  - `GET` con query string para lecturas idempotentes (`load`, `getFeedback`).
  - `POST` con `Content-Type: text/plain;charset=utf-8` y cuerpo `JSON.stringify(payload)` para
    escrituras (`autosave`, `submit`).
- **Nunca** usar `Content-Type: application/json` (dispara *preflight* OPTIONS → falla).
- El servidor responde **siempre** `ContentService` con MIME `JSON`.

---

## Contrato de la API

Base: `<WEBAPP_URL>` (deploy del Web App, "Ejecutar como: cuenta de rol DCA", "Acceso: cualquiera con el enlace").

Envoltura de respuesta uniforme:
```json
{ "ok": true,  "action": "<action>", "data": { … } }
{ "ok": false, "action": "<action>", "error": { "code": "<CODE>", "message": "…" } }
```
Códigos de error: `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `SERVER`.

### 1) `GET ?action=load&sid=…&sprint=02`
Rehidrata el avance. Devuelve el registro de `Autosave` del `sid`+sprint (o vacío si no hay).
```json
{ "ok": true, "data": { "rev": 7, "schemaVersion": 1, "updatedAt": "ISO", "fields": { "f-201-e1": "…", … } } }
```

### 2) `POST action=autosave`  (cuerpo text/plain JSON)
```json
{ "action":"autosave", "sid":"…", "sprint":"02", "baseRev": 7, "schemaVersion": 1,
  "fields": { "f-201-e1":"…", "f-201-ctx":"equipo", "sf-cohorte":"BAIP-2026-01", … } }
```
Reglas:
- `LockService` por `sid` para integridad de `rev`.
- Si no existe registro → crear con `rev = 1`.
- Si `baseRev === storedRev` → aceptar, `rev = storedRev + 1`, persistir, devolver `{rev}`.
- Si `baseRev < storedRev` → **409 CONFLICT**, devolver `{rev, updatedAt, fields}` del servidor
  (otro dispositivo escribió). El cliente resuelve (ver protocolo abajo).
- `baseRev > storedRev` es inconsistente → tratar como CONFLICT y devolver estado del servidor.

### 3) `POST action=submit`
```json
{ "action":"submit", "sid":"…", "sprint":"02", "experimento":"2.01",
  "identificacion": { "unidad":"…", "fecha":"…", "ctx":"equipo" },
  "fields": { "f-201-e1":"…", … }, "obs":"…" }
```
- *Upsert* idempotente por (`sid`,`sprint`,`experimento`) en `Respuestas`.
- Incrementa `submitCount`; fija `lastSubmittedAt`; `estado='enviado'`.
- Genera y devuelve **acuse real**: `acuseId = "BAIP-S{sprint}-{exp}-{sid8}-{seq}"`.
- [Sonnet] encola PDF a Drive + notificación a `facilitador@…`.
```json
{ "ok": true, "data": { "acuseId":"BAIP-S02-2.01-a1b2c3d4-3", "receivedAt":"ISO" } }
```

### 4) `GET ?action=getFeedback&sid=…&sprint=02`
Devuelve el feedback que el facilitador haya publicado para ese `sid` (bucle in-app, #7).
```json
{ "ok": true, "data": { "items": [ { "experimento":"2.01", "texto":"…", "autor":"…", "fecha":"ISO" } ] } }
```

### Operaciones de facilitador/DCA (NO en el endpoint público de estudiante)
`saveFeedback`, `sendFeedback`, `listCohort`, `readStudent` → requieren `ADMIN_TOKEN` (Script Properties)
o ejecución desde el script *bound* con identidad Google autorizada. [Sonnet construye el panel.]

---

## Esquema de datos (Spreadsheet "BAIP · Base de Datos Roadmaps")

`SCHEMA_VERSION = 1`. Toda fila/blob lleva `schemaVersion` para migración (#10).

**Roster** — identidad y matrícula (lo crea DCA)
| sid | nombre | email | cohorte | sprints | activo | creadoAt |

**Autosave** — un registro por (sid, sprint); resume/multi-dispositivo
| sid | sprint | schemaVersion | rev | updatedAt | dataJson |

**Respuestas** — un registro por (sid, sprint, experimento); envíos formales
| sid | nombre | cohorte | sprint | experimento | identificacionJson | e1 | e2 | e3 | e4 | obs | fieldsJson | estado | submitCount | firstSubmittedAt | lastSubmittedAt | acuseId | pdfUrl |

**Feedback** — bucle de retorno (escribe el facilitador)
| sid | sprint | experimento | rubricaJson | texto | autor | creadoAt | enviado | enviadoAt |

**Auditoría** — trazabilidad
| at | sid | action | sprint | experimento | outcome | agente |

Drive: `/BAIP/<cohorte>/<estudiante-sid8>/` para PDFs (lo cablea Sonnet en `submit`).

---

## Protocolo cliente de autosave + conflicto (debe calzar exacto con el servidor)

Estado en cliente: `localRev` (última `rev` confirmada por servidor), `dirty` (hay cambios sin subir).

1. **Al cargar:** `getIdentity()` lee `sid` de la URL → `GET load`. Reconciliar:
   - Si servidor `rev >= localRev` (o no hay caché) → hidratar UI desde servidor; `localRev = rev`.
   - Si caché local tiene cambios `dirty` más nuevos que servidor → subir (autosave con `baseRev = rev` del servidor).
2. **Al escribir:** guardar en `localStorage` inmediato (como hoy) + `dirty=true`; *debounce* 1200 ms → `POST autosave` con `baseRev=localRev`.
   - `200` → `localRev = data.rev`, `dirty=false`, indicador "guardado en DCA".
   - `409 CONFLICT` → mostrar aviso "tu avance se actualizó en otro dispositivo"; ofrecer
     **(a) traer la versión de DCA** (hidratar desde `data.fields`, `localRev=data.rev`) o
     **(b) sobrescribir** (reenviar autosave con `baseRev=data.rev`). Sin pérdida silenciosa.
3. **Offline / fallo de red:** mantener `dirty`; reintentar con backoff; el `localStorage` evita pérdida.
4. **Al enviar:** `POST submit` → mostrar `acuseId` real ("Recibido por DCA · folio …"); el `✓`
   solo aparece tras respuesta `ok` (elimina el falso positivo, #2).

---

## Migración / versionado (#10)

- Cada blob/fila lleva `schemaVersion`. El servidor expone `migrate(record)` que actualiza
  `schemaVersion < SCHEMA_VERSION` al esquema actual **en lectura** (lazy migration).
- Renombres de campo (p. ej. `f-104-nivel` → `f-104-ctx`) se resuelven en `migrate()` con un mapa.
- Nunca borrar columnas; marcar `deprecated`. Subir `SCHEMA_VERSION` solo con `migrate()` cubriendo el salto.

## Privacidad y retención (#15)

- **Clasificación:** PII de estudiantes + datos de clientes = confidencial.
- **Ubicación:** Spreadsheet y Drive en un **Shared Drive** propiedad de DCA (continuidad), acceso
  restringido a facilitador + admins DCA. Los enlaces con `sid` se tratan como secretos.
- **Consentimiento:** aviso de una línea en el roadmap ("tus respuestas se guardan en DCA para
  feedback y certificación").
- **Retención:** definir N meses post-cohorte (sugerido 24) → purga o anonimización; registrar en `Auditoría`.
- **Acceso:** toda lectura admin queda auditada.

---

## Despliegue (Fase 0 — pasos para Sonnet/operador)

1. Crear Spreadsheet maestro con las 5 pestañas y encabezados de arriba; ID → `SPREADSHEET_ID`.
2. Crear Shared Drive `BAIP` con subcarpeta por cohorte.
3. Proyecto Apps Script (cuenta de rol DCA) con `Code.gs`; Script Properties:
   `SPREADSHEET_ID`, `ADMIN_TOKEN` (secreto largo), `SCHEMA_VERSION=1`.
4. Deploy → Web App ("Ejecutar como: yo (cuenta DCA)", "Acceso: cualquiera con el enlace"). Copiar `WEBAPP_URL`.
5. En el HTML del roadmap: incluir `sync.client.js`, fijar `WEBAPP_URL`, cargar `?sid=…`.
6. Pre-cargar `Roster` de la cohorte piloto (Sprint 02) con sus `sid` y generar los enlaces personales.

## Entregables y reparto de modelo

- **Hecho en Opus (este documento + código crítico):** contrato API, `resolveIdentity` + auth + *scoping*,
  CORS, autosave/`rev`/conflicto (servidor y cliente), `submit`+acuse, `migrate`, política de privacidad.
- **Para Sonnet:** Fase 0 (crear Sheet/Drive/deploy), PDF en Drive, notificaciones Gmail, panel/Looker,
  `saveFeedback`/`sendFeedback`/`listCohort`, validaciones de mínimos (#9), export/import JSON UI (#5),
  a11y/responsive (#14).

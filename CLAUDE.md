# Proyecto: Sprint Roadmaps ARIA — Digital Change Advisors

## Qué es este proyecto
Instrumentos HTML de la certificación Analista BAIP del Modelo ARIA.
Cada archivo es un Sprint Roadmap autónomo (CSS + JS inline, sin deps).

## Variables CSS críticas para fine-tuning
--teal: #2e8b76    + color primario de marca
--gold: #a48111    + acento dorado
--carbon: #1e2a38  + oscuro base
--doc: 720px       + ancho del documento
--r-md: 8px        + radio de tarjetas
--shadow-page: ...  + elevación de páginas
--fs-lg: 15px      + tamaño base del cuerpo

## Reglas de marca DCA (NO negociables)
1. Tipografías: SOLO Marcellus + Montserrat. Sin excepciones.
2. Sin gradientes. Sin stock photos. Sin sombras dramáticas.
3. **Tono de comunicación: tuteo.** La marca se comunica de tú a tú. Nunca usar «usted», «su», «sus», ni imperativos de usted (-e para -ar, -a para -er/-ir). Usar siempre: tú, tu, tus, imperativos de tuteo (-a para -ar, -e para -er/-ir).

## Qué NO tocar
- Lógica de autosave (getData, saveField, loadAll)
- EXP_FIELDS del JS
- Atributos data-save y data-radio-save
- Bloque @media print
- SAVE_KEY
- **Motor de envío** (submitExp, collectPayload, validarEnvio, alerta, markSent) y **printExp** (PDF)
- **Panel de Facilitador** (backend/Panel.gs, backend/PanelUI.html): gate por `PANEL_KEY`, funciones `listarEntregas`/`generarBorradorIA`/`enviarFeedback`, y el HTML debe llamarse `PanelUI`
- *Excepción documentada (2026-10-19):* por instrucción explícita se corrigieron en `generarBorradorIA` los defaults que fabricaban datos (`|| 3`, `|| 'ajustar'`). Cualquier otro cambio en esas zonas sigue requiriendo petición expresa.

## Motor de envío + PDF + backend (canónico 2026-07-16)
El botón «Enviar» realiza un envío REAL vía `fetch` a un Google Apps Script (`backend/Codigo.gs`),
que registra en Sheets, genera un PDF de marca y despacha correo al facilitador (copia a ceo@ y al
estudiante), devolviendo un recibo. La confirmación «✓ Enviado» **solo** se muestra con recibo del
servidor — nunca por optimismo. `printExp()` genera un PDF con el contenido íntegro (no `window.print()`
sobre el formulario, que recorta). Campo `sf-email` en portada es obligatorio.

**Ojo:** `sprint-roadmap-01-baip.html` es anterior al patrón: usa `const ENDPOINT` y el literal `instrumento: 'sprint-01-baip'` en `collectPayload`, y no tiene la guarda `PEGA_AQUI`. S02 y la audición sí usan `INSTRUMENT`.

**Diseño genérico multi-sprint:** cada roadmap solo cambia 4 cosas — `const INSTRUMENT {id, sprintLabel,
endpoint}`, `SAVE_KEY`, `expNames`, `EXP_FIELDS`. El motor es idéntico en todos. El backend es único para
todos los sprints y NO se edita al crear uno nuevo (usa `expNombre` del payload). IDs por patrón
sprint+exp (S01: 101–104, S02: 201–204). Guía completa: `Guia-Creacion-Sprint-Roadmaps-DCA.docx`.
Endpoint del motor y estado de despliegue: ver memoria [[project_backend_envio]].

## Panel de Facilitador (canónico 2026-07-16, en producción)
Cockpit web servido por el MISMO Apps Script (`backend/Panel.gs` + `backend/PanelUI.html`) en
`.../exec?panel=1&key=<PANEL_KEY>`. El facilitador lee cada entrega, la evalúa con una rúbrica de 4
criterios (1–5), genera un **borrador de feedback con IA** (`claude-sonnet-5`, salida estructurada,
vía `UrlFetchApp`; clave en propiedad `ANTHROPIC_API_KEY`) que edita, y envía el feedback al estudiante
por correo de marca DCA. Todo se registra en la Hoja (para BI). Guía: `backend/README-panel-facilitador.md`.
Claves de despliegue (no volver a tropezar): acceso por **token `PANEL_KEY`** (no por cuenta de Google,
que da vacío en deploy «Cualquier persona»); el HTML se llama **`PanelUI`** (no puede repetir el nombre
de `Panel.gs`); al usar `UrlFetchApp` hay que re-autorizar el scope `script.external_request` ejecutando
una función desde el editor. Detalle completo: memoria [[project_backend_envio]].

## Estructura de páginas (Sprint 01)
- 20 páginas fijas `div.page` · 932 px pantalla / 10.1 in impresión
- Portada y contraportada: `section.cover-page` y `section.back-cover`
- Badge canónico portada: **«Experimentos para la puesta en práctica de aprendizajes · DCA»**
- Badge contraportada: **«Certificación Analista BAIP · Digital Change Academy · DCA»**
- Label de sprint: **«Sprint Roadmap · 01»** (sin "de 04")

| Págs | Sección |
|------|---------|
| 1 | Índice |
| 2 | Mensaje del facilitador |
| 3 | Instrucciones de uso |
| 4 | Exp 1.01 intro |
| 5–7 | Exp 1.01 campos (3 págs) |
| 8 | Exp 1.02 intro |
| 9–11 | Exp 1.02 campos (3 págs) |
| 12 | Exp 1.03 intro |
| 13–15 | Exp 1.03 campos (3 págs) |
| 16 | Exp 1.04 intro |
| 17–20 | Exp 1.04 campos (4 págs) |

## Tema del sprint y variantes de nombre
- Nombre largo (run-headers, bc-theme): **«Identificación de Causas Raíz de los Obstáculos al ROI de la IA»**
- Nombre corto (c-theme portada): **«Identificación de Causas Raíz»**
- c-program portada: **«Certificación Analista BAIP — Brecha AI Personas»**

## Diseño de portada
- `cover-visual` (barra superior): fondo **teal** `#2e8b76`, puntos de cuadrícula en **carbón** `rgba(30,42,56,0.28)`
- `cover-band` (barra título): fondo **carbón** `var(--carbon)`, texto blanco
- SVG tres lentes: AIMT = blanco, AILS = platino `rgba(210,208,200,…)`, AICD = carbón `rgba(30,42,56,…)`
- Placeholder cohorte: `Ej. BAIP-2026-01`

## Diseño de contraportada
- `cover-visual`: SVG idéntico al de portada (tres lentes sobre teal)
- `bc-band`: fondo carbón, mismo estilo que `cover-band`
- `bc-spacer`: fondo blanco, logo DCA New Branding 2026 centrado (`base64` embebido)
- `bc-foot`: fondo **dorado** `var(--gold)`, texto «Digital Change Advisors · Modelo ARIA» centrado
- Sin campos de participante ni mención del facilitador

## Assets externos (carpeta Images/)
Imágenes PNG en `Images/` (commiteadas al repo, referenciadas con ruta relativa).
NO base64 para imágenes > 100 KB — usar ruta relativa y commitear al repo.
- `Images/Imagen mensaje facilitador.png` — ilustración pág. 2, generada con IA

## Bloque «Conexión con la fundamentación»
Presente en la página intro de cada experimento, inmediatamente después del `div.exp-meta-row`.
Usa la clase `.note` existente (borde dorado, etiqueta `note-hd` en caps).
El texto exacto proviene del campo «Conexión con la fundamentación» del archivo `.md` canónico.

## Guías de campo (field-guide) — NO volver a poner preguntas en el placeholder
Las preguntas guía de cada campo van en un `<div class="field-guide">` **fijo y visible** entre
el `.fill-lbl` y el `<textarea>`. NO en el `placeholder` (desaparecía al escribir y dificultaba
responder completo — queja real de cohorte 1). El `textarea` lleva placeholder mínimo «Escribe aquí
tu respuesta…». La guía se oculta en `@media print` (el PDF oficial lo arma `printExp` desde
`EXP_FIELDS`, no del DOM). Aplica a S01 (19 campos) y S02 (16 campos). Convertido con script
`scratchpad/fix_guides.py`. Al crear campos nuevos, seguir este patrón.

## Glosario Nivel/Alcance (Sprint 01, pág. Instrucciones)
Bloque `.note` «Cómo leer el reporte · Nivel y Alcance». **Nivel** (estado del obstáculo):
Cautela → Vulnerable → Diestro → Óptimo. **Alcance** (definición oficial DCA): *extendido* /
*foco senior* / *en la base*. Regla: nivel a secas = estado del grupo como unidad, no cobertura
parcial; priorizar por «peso × nivel más bajo». S02 NO usa estos niveles (no lleva glosario).

## Fuente de verdad del contenido
`Roadmap_Sprint01_BAIP_v1-1_ALINEADO.md` (en este repo) es la ÚNICA fuente de verdad
para objetivo, contexto, paso a paso, métricas y rol de la IA de los 4 experimentos.
Al reconciliar HTML con .md: mantener voz «el analista» aunque el .md diga «el participante».
Cuando el texto se dirige al lector directamente, usar tuteo (tú/tu) — nunca usted/su.

## Bloque de identificación del reporte (report-id-block)
Labels canónicos (una sola línea): **Nombre empresa** · **Fecha reporte** · **Analista BAIP**
Fondo de campos: platino `#d2d0c8`. Texto ingresado: carbón `var(--carbon)`.
Placeholder: carbón al 38% `rgba(30,42,56,.38)`. Focus: platino claro `#e4e2da` + borde teal.
Este diseño aplica a los 4 experimentos (Exp 1.01–1.04).

## Casos base por experimento
- **Exp 1.01 (AIMT):** «Nexform Industrial» — referenciado en Paso 1.
- **Exp 1.02 (AILS):** «Nexforma» — referenciado en contexto de aplicación y Paso 2.
- **Exp 1.03 (AICD):** «Nexforma Industrial» — referenciado en contexto de aplicación.
- **Exp 1.04 (triangulación):** «Nexform Industrial» — referenciado en Paso 1 (misma empresa que venimos analizando).

## Estado del Sprint 01
Fine-tuning **completado** en todas las páginas (portada, contraportada, págs. 1–20).
Terminología consolidada: «reporte de causas raíz» (no «insight de causa raíz»), «rasgo» (no «marcador») para AICD, tuteo global aplicado.

**URL de producción:** `https://digitalchangeadvisors.com/sprint-roadmap-01-baip/`
Integrado en `dca-website` como carpeta `sprint-roadmap-01-baip/` (`index.html` + `Images/`).
El subdominio temporal `srbaip01` quedó retirado (CNAME del repo eliminado; pendiente borrar el registro DNS en Cloudflare).

## Marcas canónicas (2026)
Certificación: Analista BAIP | Instrumentos: AIMT · AILS · AICD

OBSOLETOS: Analista BDP · DMT · DLS · DCD

## Audición de Certificación (nombre canónico: «Certificación Analista BAIP»)
Prueba final individual sobre el caso sintético Vertecsa Group. El nombre de la certificación es **«Certificación Analista BAIP»**
(no «Champions ReturnAI», que es otro rol: quien mide en el cliente). Corregido en el kit el 2026-10-19.
- Instrumento `audicion-baip`; ids 901–904 (entregables), 905 (cierre), 990 (Mesa de consultas). HTML: `audicion-certificacion-baip.html`
  (producción, página no listada: `/audicion-baip-m4q7z/`).
- Kit en `Audición de Certificación/` (v1 y `v2/`), **ignorado por git** (incluye la clave maestra: nunca publicar). La clave del Panel va
  troceada en propiedades `CLAVE_AUDICION_1…n` (ver `Audición de Certificación/clave_para_el_panel/LEEME…`).
- Documentos descargables (`/audicion-baip-m4q7z/docs/`): solo 01–05 (01–04 `_v2`; el 05 se llama `Vertecsa_05_Borrador_Reporte_BAIP.docx`, sin
  «Senuelo» ni «v2», para no delatar el diseño). El 06 (Manuales del facilitador) y el 07 (Clave maestra) **nunca** se publican.
  Verificación de enlaces: descargar cada `href` con `download`, comparar hash con `Audición de Certificación/v2/` y abrir como zip. Nota:
  Cloudflare responde 403 al User-Agent por defecto de Python; usar cabecera de navegador o curl. Un archivo retirado puede seguir
  sirviéndose hasta 4 h por caché de Cloudflare.
- Orden secuencial verificado en servidor (`verificarOrdenAudicion`). Flash Feedback tras cada entregable; calificación única en semana 3.
- **Rúbrica de 7 criterios y pesos (35/30/12/8/7/4/4) vive duplicada en 3 sitios: `RUBRICA_AUDICION` (Panel.gs), el HTML de la audición y
  el Centro de Ayuda.** Si cambia, cambiar los tres. Verificado consistente el 2026-10-19.

## Centro de Ayuda (`centro-baip.html`)
Datos en `const FAQ` (JS dentro del HTML); cada entrada es un ítem de acordeón. Se ordena por `actualizado` descendente (más reciente primero),
con «Nuevo» durante 14 días. Sección «Cómo se evalúa: los siete criterios» (9 entradas `audicion-criterio*`, 2026-10-19).
Deuda conocida: el acordeón es un `div` con `onclick`, sin `tabindex`/`role`/aria → no se opera con teclado.

## Despliegue (canónico)
Producción = monorepo `Presencia Digital DCA` → `./deploy.sh website` (force-push a `dca-website`). Las fuentes de este repo se copian a
`website/<carpeta>/index.html` (centro-baip, sprint-roadmap-01/02-baip, audicion-baip-m4q7z, expediente-modelo-nexforma-r8k2x).
1. `git pull --ff-only` en el monorepo **antes de todo** (2026-10-19: el clon del Mac Mini estaba 56 commits atrás; publicar así habría
   pisado en producción el trabajo del MacBook Pro).
2. Copiar, commit, `git push origin main`, `./deploy.sh website`, verificar en vivo (el `.md` y los `*-vN.html` los quita el script).
3. **Apps Script (motor + Panel) NO se despliega desde aquí**: no hay `.clasp.json`. Se pega `Codigo.gs`, `Panel.gs` y `PanelUI.html` en el
   editor y se usa «Administrar implementaciones → editar la existente» (nunca «Nueva implementación»: cambia la URL `/exec` que está
   incrustada en los HTML). Pendiente de pegar: versión `2026-10-19` (ver abajo). Intentado `clasp pull` con el scriptId del Panel (auditoría
   2026-10-19 en otra sesión): falla con `invalid_rapt` — la cuenta de clasp necesita `clasp login` interactivo; no es automatizable desde
   una sesión sin navegador.
4. **Riesgo bidireccional (detectado y corregido 2026-10-19):** alguien editó `centro-baip.html` directamente en el espejo del monorepo
   (`website/centro-baip/index.html`, ya publicado) sin devolver el cambio a este repo fuente — quedó 9 preguntas de FAQ atrás sin que
   `deploy.sh` lo detectara (el monorepo sí estaba commiteado; el desajuste era solo entre este repo y el monorepo). Si se edita el espejo
   directamente, copiar el archivo de vuelta aquí y commitear también en este repo — es la autoridad, el monorepo es solo espejo de publicación.

## Fallbacks — inventario (auditoría 2026-10-19)
**Deliberados (no tocar sin decisión):** `nombreExp` (expNombre → mapa S01 → genérico); etiquetas de sprint/recibo (`etiquetaSprint`,
`etiquetaCorta`, sprint `'00'`); copia de respaldo `MAIL_COPIA`; registro en la Hoja *antes* del correo; `registrarError` silencioso;
reintentos a la API de Claude solo en 429/5xx (3 reintentos); centinelas `(sin nombre/cohorte/empresa/correo/respuesta)` en los HTML,
bloqueados por `validarEnvio` y ahora también por el backend; guarda `PEGA_AQUI` (no envía si el endpoint no está configurado);
`getData()` → `{}` si falla `localStorage`; sin recibo del servidor no hay «Enviado» (botón «Reintentar» + PDF manual); gate del Panel
fail-closed (`PANEL_KEY` o cuenta de facilitador); `facilitadorActual()` vacío con despliegue «Cualquier persona» (limitación de Apps
Script; deja `FeedbackPor` vacío); filtros/orden del Centro de Ayuda.
**Corregidos el 2026-10-19 (repo; pendientes de pegar en Apps Script):** `|| 3` en el borrador de IA (2 sitios) y `|| 'ajustar'` en Flash →
ahora fallan con error visible; `d.instrumento || 'sprint-01-baip'` → se rechaza el envío sin instrumento; `(sin …)` aceptado por el
backend → rechazado; `ORIGENES_VALIDOS` (config inerte que simulaba protección) → eliminado; `version: '1.1'` → `VERSION_MOTOR`;
«Hola Hola,» sin nombre → «Hola,».
**Pendientes de decisión (zona protegida):** `saveField`/`localStorage.setItem` sin `try/catch` (si el navegador bloquea el almacenamiento el
autosave falla en silencio y el aviso «tu trabajo está a salvo» deja de ser cierto); `enviarFeedback` de sprints acepta criterios sin
calificar (`Number(...)||0`) a diferencia de la audición; `FeedbackPor` queda vacío con acceso por clave.

## Hardcodeados que conviene resolver
- Endpoint `/exec` copiado en 3 HTML (S01, S02, audición): seguro mientras se edite la implementación existente; centralizar exige romper
  la regla «HTML autónomo».
- Modelo de IA fijo en `Panel.gs` (`claude-sonnet-5`): moverlo a propiedad `MODELO_IA`.
- Correos (`MAIL_FACILITADOR`, `MAIL_COPIA`, `FACILITADORES`) y `facilitador@…` en mensajes de error de los HTML.
- Rúbrica en 3 sitios (ver Audición); `AUDICION_ORDEN.nombres` y `EXPERIMENTOS` duplican nombres que ya envía el HTML.
- ~~`apps-script/` (SPEC + `Code.gs` + `sync.client.js`) es un andamiaje con `TODO` que ningún HTML usa~~ — **archivado 2026-10-19** en `_archivo/apps-script-backend-nextgen-sin-integrar/` (ver su README-ARCHIVO.md).

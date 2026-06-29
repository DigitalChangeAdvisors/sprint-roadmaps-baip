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

## Marcas canónicas (2026)
Certificación: Analista BAIP | Instrumentos: AIMT · AILS · AICD

OBSOLETOS: Analista BDP · DMT · DLS · DCD

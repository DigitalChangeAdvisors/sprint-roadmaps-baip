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

## Qué NO tocar
- Lógica de autosave (getData, saveField, loadAll)
- EXP_FIELDS del JS
- Atributos data-save y data-radio-save
- Bloque @media print
- SAVE_KEY

## Estructura de páginas (Sprint 01)
- 21 páginas fijas `div.page` · 932 px pantalla / 10.1 in impresión
- Portada y contraportada: `section.cover-page` y `section.back-cover`
- Badge canónico portada: **«Experimentos para la puesta en práctica de aprendizajes · DCA»**
- Badge contraportada: **«Certificación Analista BAIP · Digital Change Academy · DCA»**
- Label de sprint: **«Sprint Roadmap · 01»** (sin "de 04")

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

## Marcas canónicas (2026)
Certificación: Analista BAIP | Instrumentos: AIMT · AILS · AICD

OBSOLETOS: Analista BDP · DMT · DLS · DCD

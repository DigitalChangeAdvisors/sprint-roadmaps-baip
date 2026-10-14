# Panel de Facilitador · Guía de instalación y uso

El **Panel de Facilitador** es una página web servida por el **mismo Apps Script** del motor de
recepción. Desde ahí lees cada entrega, la evalúas con una rúbrica, generas un **borrador de
feedback con IA** que editas, y **envías el feedback al estudiante** por correo — sin salir de la
plataforma DCA. Todo queda registrado en la misma Hoja de cálculo (útil para BI).

```
Hoja «Envios» (las entregas ya están aquí)
        │
        ▼
Panel de Facilitador  (…/exec?panel=1, solo para ti)
   ├─ Lees la entrega
   ├─ ✨ «Generar borrador con IA»  → Claude propone rúbrica + comentario
   ├─ Editas y ajustas
   └─ ✉ «Enviar feedback»  → correo de marca al estudiante (responder-a: tú)
        │
        ▼
   Se registra en la Hoja: puntaje, comentario, fecha, quién lo envió
```

---

## Requisitos previos
- El motor de recepción ya desplegado (ver `README-despliegue.md`). El panel vive en el **mismo** proyecto de Apps Script.
- Una **clave de API de Anthropic** (para los borradores con IA).

---

## Paso 1 — Añade los dos archivos al proyecto de Apps Script

1. Abre tu proyecto en [script.google.com](https://script.google.com) (el mismo del motor).
2. **Nuevo archivo → Script**, nómbralo `Panel` y pega el contenido de **`backend/Panel.gs`**.
3. **Nuevo archivo → HTML**, nómbralo `PanelUI` (así, sin espacios; Apps Script le pone `.html` solo) y pega el contenido de **`backend/PanelUI.html`**. *(Nombre distinto a `Panel.gs` a propósito: Apps Script no permite dos archivos con el mismo nombre.)*
4. Reemplaza tu `Codigo.gs` con la versión actualizada de este repo (el `doGet` ahora enruta al panel).
5. Guarda todo (`Cmd/Ctrl + S`).

> Debes tener **3 archivos**: `Codigo.gs`, `Panel.gs` y `Panel.html`.

---

## Paso 2 — Añade la clave de API de Anthropic

1. Consigue una clave en [console.anthropic.com](https://console.anthropic.com) → **API Keys** → *Create Key*.
2. En Apps Script: ⚙️ **Configuración del proyecto → Propiedades del script → Añadir propiedad**:

   | Propiedad | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | *(pega tu clave, empieza por `sk-ant-…`)* |

3. **Guardar propiedades del script**.

> La clave vive en las propiedades del script, nunca en el código. El panel la usa solo del lado del servidor; el estudiante jamás la ve.

---

## Paso 3 — Define la clave del panel (`PANEL_KEY`)

El panel se protege con una **clave secreta** que solo tú conoces (funciona en cualquier
despliegue, sin depender de la cuenta de Google). Configúrala igual que la clave de la IA:

1. ⚙️ **Configuración del proyecto → Propiedades del script → Añadir propiedad**:

   | Propiedad | Valor |
   |---|---|
   | `PANEL_KEY` | *(una cadena larga y difícil de adivinar que tú inventes, p. ej. `dca-panel-8f3k29xq7w`)* |

2. **Guardar propiedades del script**.

> Elige algo largo y único. Es como la contraseña del panel: cualquiera que tenga el enlace
> **con** esa clave puede entrar; sin ella, no.

**Alternativa por cuenta (opcional):** si prefieres autorizar por correo en vez de por clave,
en `Panel.gs` está la lista `FACILITADORES`. Eso solo funciona si despliegas el panel con acceso
restringido al dominio «Digital Change Advisors» (no «Cualquier persona»). Para el caso normal,
usa la clave `PANEL_KEY` — es lo más simple y directo.

---

## Paso 4 — Vuelve a desplegar

Editar el código **no** actualiza lo publicado. Redespliega la versión:

**Implementar → Gestionar implementaciones → ✏️ (editar) → Versión: «Nueva versión» → Implementar.**

La URL `/exec` **no cambia**, así que el roadmap de los estudiantes sigue funcionando igual.

---

## Paso 5 — Abre tu panel

Pega en el navegador la URL del Apps Script **añadiendo `?panel=1&key=TU_CLAVE`** al final
(reemplaza `TU_CLAVE` por la que pusiste en `PANEL_KEY`):

```
https://script.google.com/macros/s/AKfycby…/exec?panel=1&key=TU_CLAVE
```

Deberías ver el **Panel de Facilitador** con la lista de entregas. Guárdalo como favorito.

> **Si ves el error de Google Drive** («No se pudo abrir el archivo»): es la peculiaridad de multicuenta de Google. Ábrelo en el **navegador/perfil donde estás logueado con tu cuenta DCA**, o en una ventana donde solo esa cuenta esté activa.

---

## Cómo se usa (tu flujo diario)

1. **Abre el panel.** Verás las entregas, las más recientes primero, con una etiqueta *Pendiente* o *✓ Feedback enviado*.
2. **Haz clic en una entrega** para desplegar su contenido completo.
3. **✨ Generar borrador con IA** (opcional): Claude lee la entrega, propone un puntaje por criterio con su nota, redacta un comentario en tuteo y prepara una **Guía de mejora** — 1 a 3 ejemplos concretos del tipo «así se vería más fuerte», anclados al caso del estudiante, cada uno con el *foco*, el *ejemplo* modelo y el *por qué funciona*. **Es un borrador** — revísalo y ajústalo.
4. **Ajusta** los puntajes (1–5), el comentario y los ejemplos de mejora a tu criterio (puedes editarlos, añadir con «+ Añadir ejemplo» o quitar con «×»). Tú tienes la última palabra, siempre.
5. **✉ Enviar feedback**: el estudiante recibe un correo de marca DCA con tu comentario y la rúbrica. Al **Responder**, te escribe directo a ti.
6. La entrega queda marcada como enviada y todo se registra en la Hoja.

---

## La rúbrica (personalizable)

Está definida en `Panel.gs`, en `RUBRICA`. Por defecto son 4 criterios (escala 1–5):

- **Rigor diagnóstico** — profundidad y evidencia.
- **Uso del instrumento** — aplicación correcta de la lente (AIMT/AILS/AICD).
- **Causa raíz y accionabilidad** — llega a la causa raíz y propone algo accionable.
- **Claridad y comunicación** — comunicación ejecutiva.

Cambia los criterios ahí y tanto el panel como la IA se adaptan solos (redespliega después).

---

## Preguntas frecuentes

**¿Cuánto cuesta la IA?** Cada borrador es una llamada a la API de Anthropic; el costo por entrega es
de centavos. Usa el modelo `claude-sonnet-5` (excelente calidad y costo más bajo). Si en algún
momento quieres la máxima capacidad, en `Panel.gs` → `_llamarClaude` puedes cambiar `model` a
`'claude-opus-4-8'`.

**¿La IA envía el feedback sola?** No. La IA solo **propone un borrador**. Nada sale al estudiante
hasta que tú pulsas «Enviar feedback».

**¿Y si otro facilitador (no el dueño del script) necesita entrar?** En la implementación actual,
por privacidad de Google, el panel identifica de forma fiable solo al **dueño del proyecto**. Para
varios facilitadores, crea una **segunda implementación** con acceso *«Cualquier persona dentro de
Digital Change Advisors»* (dominio) — así Google entrega el correo de cada facilitador y la lista
`FACILITADORES` los reconoce. Pídeme ayuda para configurarla cuando sumes facilitadores.

**¿Los datos de los estudiantes están protegidos?** El panel solo lo abren los correos de
`FACILITADORES`; cualquier visitante anónimo ve «Acceso restringido». Aun así, recuerda que manejas
diagnósticos internos de empresas reales: define tu política de retención y confidencialidad antes
de escalar (ver el documento de diseño del motor).

**¿Puedo reenviar un feedback corregido?** Sí. Abre la entrega, ajusta y vuelve a «Enviar». Se
registra la versión más reciente.

**¿Dónde veo lo que envié?** En la misma Hoja «Envios», en las columnas `FeedbackTexto`,
`PuntajeTotal`, `PuntajePromedio`, `FeedbackEnviadoEn` y `FeedbackPor`. Perfecto para BI: distribución
de puntajes por experimento, por cohorte, ritmo de feedback, etc.

---

## Audición de certificación (caso Vertecsa) — qué cambia en el panel

El panel ahora reconoce el instrumento `audicion-baip` (HTML `audicion-certificacion-baip.html`).
Todo lo anterior (Sprints 01 y 02) funciona igual.

**Entregas que verás** (recibo `ARIA-09-9xx-…`):

| Exp | Qué es | Qué haces en el panel |
|---|---|---|
| 901–904 | Entregables 1 a 4 | Envías un **⚡ Flash Feedback** (orientación breve, no califica): nivel por criterio —En buen camino / Ajustar / Replantear—, comentario de máx. 5 frases y, si aporta, una mejora. La IA lo redacta como borrador con la clave (sin revelarla). La calificación se emite una sola vez, en el cierre |
| 905 | Cierre y solicitud de calificación | **Aquí evalúas**: rúbrica de 7 criterios ponderados, veredicto y envío del resultado |
| 990 | Mesa de consultas | «Responder consulta»: la respuesta le llega al estudiante por correo |

**Rúbrica (peso):** C1 Precisión y causa raíz 35 · C2 Integración 30 · C3 Plan S5 12 · C5 Modelo de impacto S6 8 · C6 Defensibilidad por escrito 7 · C4 Claridad 4 · C7 Viabilidad 4.
Escala 1–5 (1–2 insuficiente, 3–4 suficiente, 5 sobresaliente). El panel calcula el puntaje ponderado.
**Veredictos:** aprobado (los siete criterios ≥3) · ajustes (la estudiante los resuelve en la semana 3 y tú emites el veredicto final desde el mismo cierre, reevaluando con los entregables reenviados) · no aprobado. Sin «aprobado condicional»: el panel no deja enviar «aprobado» si algún criterio es 1–2. La semana 3 reemplaza cualquier plazo posterior: todo se resuelve ahí y la cohorte se cierra.

**Borrador con IA para la audición:** lee los cuatro entregables más recientes + el cierre del estudiante y la
**clave maestra**, y devuelve puntaje por criterio, cuáles de los cinco errores del borrador identificó, si se activó la
regla de exclusión, alertas de autoría y un veredicto sugerido. Tú decides todo. El texto al estudiante **no revela** la clave.

### Puesta en marcha (una sola vez)
1. Pega el contenido actualizado de `Panel.gs` y `PanelUI.html` en el proyecto de Apps Script (no cambia `Codigo.gs`).
2. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar** (la URL no cambia).
3. Propiedades del script: añade `CLAVE_AUDICION_1`, `CLAVE_AUDICION_2`, … con los trozos de la carpeta local
   `Audición de Certificación/clave_para_el_panel/` (ver el LEEME de esa carpeta). **La clave nunca va al repositorio.**
4. Prueba: envía un entregable de ensayo desde el HTML de la audición y ábrelo en el panel; en el cierre pulsa «Generar borrador con IA».

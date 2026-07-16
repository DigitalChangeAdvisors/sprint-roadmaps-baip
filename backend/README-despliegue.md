# Motor de Recepción de Sprint Roadmaps · Guía de despliegue

Esta guía te lleva de la mano para poner en marcha el backend que recibe los envíos
de los estudiantes. **No necesitas saber programar.** Son 6 pasos y toma ~15 minutos.
Se hace **una sola vez**.

---

## Qué vas a construir

```
Estudiante (roadmap HTML)
        │  envía sus campos
        ▼
Google Apps Script  ← el motor (el archivo Codigo.gs)
        ├──► Google Sheets ...... registro acumulado (tu base de BI)
        ├──► Genera un PDF ....... con diseño DCA y TODO el contenido
        ├──► Gmail ............... al facilitador + copia a ceo@
        └──► Gmail ............... copia y acuse al estudiante
        │
        ▼
   Devuelve un recibo verificado → SOLO entonces el estudiante ve «Enviado»
```

---

## Paso 1 — Crea la Hoja de Cálculo

1. Entra a [sheets.google.com](https://sheets.google.com) con tu cuenta **@digitalchangeadvisors.com**.
2. Crea una hoja nueva y llámala: **`DCA · Registro Sprint Roadmaps BAIP`**.
3. Mira la barra de direcciones. Vas a ver algo así:
   ```
   https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit
                                          └────┬────┘
                                     esto es el SHEET_ID
   ```
4. **Copia ese ID** (lo que va entre `/d/` y `/edit`). Lo necesitas en el paso 3.

> No crees pestañas ni encabezados: el script los crea solos la primera vez.

---

## Paso 2 — Crea el proyecto de Apps Script

1. Entra a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Ponle de nombre: **`DCA · Motor Sprint Roadmaps`**.
3. Borra todo el contenido del archivo que aparece por defecto (`Código.gs`).
4. Abre el archivo **`Codigo.gs`** de esta carpeta, copia **todo** su contenido y pégalo ahí.
5. Guarda (💾 o `Ctrl/Cmd + S`).

---

## Paso 3 — Conecta la Hoja al script

1. En Apps Script, ve al engranaje ⚙️ **Configuración del proyecto** (barra izquierda).
2. Baja hasta **Propiedades del script** → **Añadir propiedad de script**.
3. Escribe exactamente:

   | Propiedad  | Valor                                  |
   |------------|----------------------------------------|
   | `SHEET_ID` | *(pega aquí el ID del Paso 1)*         |

4. **Guardar propiedades del script**.

> **Por qué así:** el ID vive fuera del código. Si mañana cambias de hoja, no tocas
> el programa. Es la misma razón por la que no guardas la clave de tu casa dentro de la casa.

---

## Paso 4 — Autoriza y prueba

1. Vuelve al editor (`< >` **Editor**).
2. En el selector de funciones (arriba), elige **`pruebaDeEnvio`** y pulsa **▶ Ejecutar**.
3. Google te pedirá permisos. Esto es normal y es de una sola vez:
   - «Revisar permisos» → elige tu cuenta.
   - Verás **«Google no ha verificado esta aplicación»**. Es esperado: la app es tuya.
     Pulsa **Configuración avanzada** → **Ir a DCA · Motor Sprint Roadmaps (no seguro)**.
   - Acepta los permisos (enviar correo, acceder a tus hojas).
4. Cuando termine, verifica que ocurrieron **tres** cosas:
   - ✅ Tu Hoja tiene una pestaña **`Envios`** con una fila de prueba.
   - ✅ Te llegó un correo con un **PDF adjunto** con diseño DCA.
   - ✅ El PDF contiene el **texto largo completo** (el campo de prueba repite una
     frase 60 veces: debe verse entero, fluyendo en varias páginas, **sin recortes**).

> Si el punto 3 se ve completo, la falla del PDF quedó resuelta en el origen.

---

## Paso 5 — Publica el motor (Deploy)

1. Arriba a la derecha: **Implementar** → **Nueva implementación**.
2. En el engranaje ⚙️ junto a «Seleccionar tipo», elige **Aplicación web**.
3. Configura exactamente así:

   | Campo                       | Valor                                            |
   |-----------------------------|--------------------------------------------------|
   | Descripción                 | `v1 · motor de recepción`                        |
   | **Ejecutar como**           | **Yo** (`tu@digitalchangeadvisors.com`)          |
   | **Quién tiene acceso**      | **Cualquier persona**                            |

4. **Implementar**.
5. Copia la **URL de la aplicación web**. Se ve así:
   ```
   https://script.google.com/macros/s/AKfycb..../exec
   ```

> ### ⚠️ Los dos ajustes que la gente equivoca
> - **«Ejecutar como: Yo»** → el correo sale desde tu dominio con tus permisos.
>   Si eliges «el usuario que accede», los estudiantes tendrían que iniciar sesión. Nadie lo haría.
> - **«Quién tiene acceso: Cualquier persona»** → sin esto, los envíos son rechazados
>   silenciosamente. Es exactamente el fallo silencioso que estamos eliminando.
>
> «Cualquier persona» **no** expone tu Hoja ni tu correo: solo permite invocar el motor.

---

## Paso 6 — Conecta el roadmap al motor

1. Comprueba primero que vive: pega la URL del Paso 5 en el navegador.
   Debes ver algo como:
   ```json
   {"ok":true,"servicio":"DCA · Motor de Recepción Sprint Roadmaps BAIP","estado":"operativo"}
   ```
2. Pásame esa URL (o pégala tú mismo) en el HTML del roadmap, en esta línea:
   ```js
   const ENDPOINT = 'PEGA_AQUI_LA_URL_DEL_APPS_SCRIPT';
   ```
3. Publica el cambio. Listo: los envíos empiezan a llegar de verdad.

---

## Cuando cambies el código en el futuro

Editar el script **no** actualiza lo que está publicado. Debes volver a implementar:

**Implementar → Gestionar implementaciones → ✏️ (editar) → Versión: «Nueva versión» → Implementar**

> Usa siempre **editar la implementación existente**, no «Nueva implementación».
> Así la URL **no cambia** y no tienes que tocar el HTML otra vez.

---

## Verificación de que quedó bien

- [ ] La URL del `/exec` responde `{"ok":true,...}` en el navegador.
- [ ] La pestaña `Envios` existe y tiene encabezados en teal.
- [ ] Llega el correo al facilitador **con PDF adjunto**.
- [ ] Llega copia a `ceo@digitalchangeadvisors.com`.
- [ ] El estudiante recibe su acuse con su número de recibo.
- [ ] El PDF muestra los textos largos **completos**.

---

## Preguntas frecuentes

**¿Cuánto cuesta?** Nada. Apps Script, Sheets y Gmail entran en tu Google Workspace.

**¿Cuántos envíos aguanta?** Google Workspace permite ~1.500 correos/día. Cada envío
genera 2 (facilitador + estudiante). Techo práctico: ~700 envíos diarios. Muy por
encima de cualquier cohorte.

**¿Y si un estudiante envía dos veces?** Se registra igual y se marca en la columna
`EsReenvio`. Nunca se pierde información; el facilitador ve la versión más reciente.

**¿Dónde veo los errores?** En la pestaña `Errores` de la misma Hoja: fecha, mensaje
y el contenido que llegó. Nada falla en silencio.

**¿Y si Google cae?** El trabajo del estudiante sigue guardado en su navegador
(`localStorage`). Puede reintentar el envío después sin perder nada.

**¿Puedo cambiar el correo del facilitador?** Sí: en el bloque `CONFIG`, arriba del
archivo `Codigo.gs`. Luego vuelve a implementar (ver arriba).

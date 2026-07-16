/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DCA · MOTOR DE RECEPCIÓN DE SPRINT ROADMAPS BAIP
 *  Backend de envío, registro y acuse de recibo — Google Apps Script
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ HACE (en orden):
 *    1. Recibe el envío del estudiante desde el HTML del Sprint Roadmap.
 *    2. Valida que la información esté completa y bien formada.
 *    3. Registra una fila en la Hoja de Cálculo (el registro acumulado = base de BI).
 *    4. Genera un PDF con diseño de marca DCA con TODO el contenido.
 *    5. Envía ese PDF por correo al facilitador (con copia de respaldo).
 *    6. Envía al estudiante su propia copia + acuse.
 *    7. Devuelve un recibo verificado al navegador. SOLO entonces el estudiante
 *       ve «Enviado». Si algo falla, devuelve el error y NO se confirma nada.
 *
 *  PRINCIPIO RECTOR: la confirmación jamás se muestra por optimismo.
 *  Se muestra porque el servidor confirmó que el correo salió.
 *
 *  Ver README-despliegue.md para instalarlo paso a paso.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ══ CONFIGURACIÓN ══════════════════════════════════════════════════════════
// Los valores sensibles se leen de las Propiedades del Script (Configuración
// del proyecto → Propiedades del script). Así no viven dentro del código.

const CONFIG = {
  // Correo principal del facilitador que recibe los envíos.
  MAIL_FACILITADOR: 'facilitador@digitalchangeadvisors.com',

  // Copia de respaldo. Si el alias del facilitador fallara, el envío igual llega.
  MAIL_COPIA: 'ceo@digitalchangeadvisors.com',

  // Nombre visible del remitente en el correo.
  REMITENTE: 'Digital Change Academy · DCA',

  // Nombre de la pestaña de la Hoja donde se acumulan los envíos.
  HOJA_REGISTRO: 'Envios',

  // Nombre de la pestaña donde se registran los errores (auditoría).
  HOJA_ERRORES: 'Errores',

  // Enviar al estudiante una copia de su propio PDF. Recomendado: true.
  COPIA_AL_ESTUDIANTE: true,

  // Orígenes autorizados a enviar (defensa básica contra uso ajeno).
  ORIGENES_VALIDOS: ['https://digitalchangeadvisors.com'],
};

// Paleta de marca DCA — debe coincidir con el brandbook.
const MARCA = {
  teal:   '#2e8b76',
  oro:    '#a48111',
  carbon: '#1e2a38',
  platino:'#f3f3f3',
  gris:   '#6b7280',
};

// Nombres de respaldo (fallback) del Sprint 01. YA NO es obligatorio editar
// esto para sprints nuevos: el HTML envía el nombre del experimento en el
// payload (expNombre) y el motor lo usa directamente. Este mapa solo cubre
// envíos antiguos que no traigan expNombre.
const EXPERIMENTOS = {
  '101': 'Experimento 1.01 — Clasificación de señales con AIMT',
  '102': 'Experimento 1.02 — Brecha dice-hace con AILS',
  '103': 'Experimento 1.03 — Causas raíz culturales con AICD',
  '104': 'Experimento 1.04 — Triangulación y reporte de causas raíz',
};

/**
 * Nombre legible del experimento. Prioriza lo que envía el HTML (expNombre),
 * cae al mapa de respaldo, y como último recurso arma un nombre genérico.
 * Gracias a esto, un sprint nuevo NO requiere tocar el backend.
 */
function nombreExp(d) {
  return (d.expNombre && String(d.expNombre).trim()) ||
         EXPERIMENTOS[d.exp] ||
         ('Experimento ' + (d.exp || '—'));
}

/** Etiqueta del sprint que envía el HTML, o una genérica si no viene. */
function etiquetaSprint(d) {
  return (d.sprintLabel && String(d.sprintLabel).trim()) ||
         (d.instrumento ? 'Instrumento ' + d.instrumento : 'Sprint Roadmap');
}

// Columnas del registro. El orden define la Hoja: NO reordenar sin migrar.
const COLUMNAS = [
  'Timestamp', 'ReciboID', 'Instrumento', 'Experimento', 'ExperimentoNombre',
  'Nombre', 'Email', 'Empresa', 'Cohorte',
  'GrupoAnalizado', 'FechaReporte', 'Nivel',
  'E1', 'E2', 'E3', 'E4', 'Observaciones',
  'CaracteresTotal', 'CamposLlenos', 'CamposTotal', 'CompletitudPct',
  'EsReenvio', 'HashContenido', 'UserAgent', 'Origen',
];

// ══ PUNTO DE ENTRADA: POST ════════════════════════════════════════════════
/**
 * Recibe el envío del estudiante.
 * El navegador envía Content-Type: text/plain a propósito, para evitar la
 * petición «preflight» de CORS que Apps Script no sabe responder.
 */
function doPost(e) {
  const inicio = new Date();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responder({ ok: false, error: 'PAYLOAD_VACIO', mensaje: 'No llegó ningún contenido.' });
    }

    const datos = JSON.parse(e.postData.contents);

    // ── Validación ──
    const problema = validar(datos);
    if (problema) {
      return responder({ ok: false, error: 'VALIDACION', mensaje: problema });
    }

    // ── Candado: un solo envío a la vez para no corromper la numeración ──
    const candado = LockService.getScriptLock();
    candado.waitLock(30000);

    let recibo;
    try {
      const hoja = obtenerHoja(CONFIG.HOJA_REGISTRO, COLUMNAS);
      const hash = hashContenido(datos);
      const reenvio = yaExiste(hoja, hash);

      recibo = generarReciboID(hoja, datos.exp);

      // 1) Registrar en la Hoja ANTES de enviar el correo.
      //    Si el correo falla, el trabajo del estudiante ya está a salvo.
      escribirFila(hoja, datos, recibo, hash, reenvio, e);

      // 2) Generar el PDF con diseño de marca.
      const pdf = construirPDF(datos, recibo);

      // 3) Enviar al facilitador (+ copia de respaldo).
      enviarAFacilitador(datos, recibo, pdf);

      // 4) Enviar al estudiante su copia y acuse.
      if (CONFIG.COPIA_AL_ESTUDIANTE && datos.participante.email) {
        enviarAlEstudiante(datos, recibo, pdf);
      }
    } finally {
      candado.releaseLock();
    }

    const ms = new Date() - inicio;
    return responder({
      ok: true,
      reciboID: recibo,
      recibidoEn: inicio.toISOString(),
      destinatario: CONFIG.MAIL_FACILITADOR,
      copiaEstudiante: !!(CONFIG.COPIA_AL_ESTUDIANTE && datos.participante.email),
      ms: ms,
      mensaje: 'Envío recibido, registrado y despachado por correo.',
    });

  } catch (err) {
    registrarError(err, e);
    return responder({
      ok: false,
      error: 'SERVIDOR',
      mensaje: 'No pudimos completar el envío: ' + err.message,
    });
  }
}

/** Chequeo de salud: abre la URL en el navegador para verificar que vive. */
function doGet() {
  return responder({
    ok: true,
    servicio: 'DCA · Motor de Recepción Sprint Roadmaps BAIP',
    version: '1.0',
    estado: 'operativo',
    hora: new Date().toISOString(),
  });
}

// ══ VALIDACIÓN ════════════════════════════════════════════════════════════
function validar(d) {
  if (!d.exp) return 'Falta el identificador del experimento.';
  if (!d.participante) return 'Faltan los datos del participante.';

  const p = d.participante;
  if (!p.nombre || p.nombre.trim().length < 3) return 'Escribe tu nombre completo en la portada.';
  if (!p.email || !esEmailValido(p.email)) return 'Escribe un correo electrónico válido en la portada.';
  if (!p.cohorte || !p.cohorte.trim()) return 'Indica tu cohorte en la portada.';

  if (!Array.isArray(d.campos) || !d.campos.length) return 'No llegó ningún campo diligenciado.';

  // Al menos un campo de evidencia con contenido real.
  const conContenido = d.campos.filter(c => c.value && String(c.value).trim().length > 0);
  if (!conContenido.length) return 'Todos los campos están vacíos.';

  return null;
}

function esEmailValido(x) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(x).trim());
}

// ══ HOJA DE CÁLCULO (el registro acumulado = la base de BI) ═══════════════
function obtenerHoja(nombre, encabezados) {
  const libro = SpreadsheetApp.openById(idDelLibro());
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
  }
  if (hoja.getLastRow() === 0 && encabezados) {
    hoja.appendRow(encabezados);
    const cab = hoja.getRange(1, 1, 1, encabezados.length);
    cab.setBackground(MARCA.teal).setFontColor('#ffffff').setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function idDelLibro() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Falta la propiedad SHEET_ID en las Propiedades del script.');
  return id;
}

function escribirFila(hoja, d, recibo, hash, reenvio, e) {
  const p = d.participante;
  const val = id => {
    const c = d.campos.find(x => x.id && x.id.indexOf(id) !== -1);
    return c ? String(c.value || '') : '';
  };

  const total = d.campos.reduce((s, c) => s + String(c.value || '').length, 0);
  const llenos = d.campos.filter(c => String(c.value || '').trim()).length;

  hoja.appendRow([
    new Date(),
    recibo,
    d.instrumento || 'sprint-01-baip',
    d.exp,
    nombreExp(d),
    p.nombre, p.email, p.empresa || '', p.cohorte,
    val('-rid-grupo'), val('-rid-fecha'), val('-nivel'),
    val('-e1'), val('-e2'), val('-e3'), val('-e4'), val('-obs'),
    total, llenos, d.campos.length,
    Math.round((llenos / d.campos.length) * 100),
    reenvio ? 'SI' : 'NO',
    hash,
    (d.meta && d.meta.userAgent) || '',
    (e && e.parameter && e.parameter.origen) || (d.meta && d.meta.origen) || '',
  ]);
}

/**
 * Recibo legible y único, válido para cualquier sprint: ARIA-<sprint>-<exp>-<consec>
 * El número de sprint se deriva del primer dígito del experimento
 * ('101' → 01, '201' → 02, '304' → 03), así no hay que configurarlo por sprint.
 */
function generarReciboID(hoja, exp) {
  const n = Math.max(hoja.getLastRow(), 1); // fila 1 = encabezados
  const consecutivo = ('0000' + n).slice(-4);
  const e = String(exp || '');
  const sprint = e.length >= 3 ? ('0' + e.charAt(0)).slice(-2) : '00';
  return 'ARIA-' + sprint + '-' + e + '-' + consecutivo;
}

/** Huella del contenido para detectar reenvíos idénticos. */
function hashContenido(d) {
  const base = d.exp + '|' + d.participante.email + '|' +
    d.campos.map(c => String(c.value || '')).join('¶');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, base, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').substring(0, 12);
}

function yaExiste(hoja, hash) {
  if (hoja.getLastRow() < 2) return false;
  const col = COLUMNAS.indexOf('HashContenido') + 1;
  const valores = hoja.getRange(2, col, hoja.getLastRow() - 1, 1).getValues();
  return valores.some(f => f[0] === hash);
}

// ══ GENERACIÓN DEL PDF CON DISEÑO DE MARCA ════════════════════════════════
/**
 * Construye el PDF que recibe el facilitador y el estudiante.
 * A diferencia del `window.print()` original, este PDF contiene el texto
 * COMPLETO de cada campo: fluye en páginas naturales, nunca se recorta.
 */
function construirPDF(d, recibo) {
  const html = plantillaReporteHTML(d, recibo);
  const blob = Utilities.newBlob(html, 'text/html', 'reporte.html')
    .getAs('application/pdf')
    .setName(nombreArchivo(d, recibo));
  return blob;
}

function nombreArchivo(d, recibo) {
  const limpio = s => String(s || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${recibo}_${limpio(d.participante.nombre)}_Exp-${d.exp}.pdf`;
}

function plantillaReporteHTML(d, recibo) {
  const p = d.participante;
  const fecha = Utilities.formatDate(new Date(), 'America/Bogota', "d 'de' MMMM 'de' yyyy · HH:mm");

  const bloques = d.campos.map(c => {
    const vacio = !String(c.value || '').trim();
    const valor = vacio
      ? '<em style="color:#9ca3af">— sin contenido —</em>'
      : escapar(String(c.value)).replace(/\n/g, '<br>');
    const chars = String(c.value || '').length;
    return `
      <div class="campo">
        <div class="campo-lbl">${escapar(c.label || c.id)}
          <span class="chars">${chars} caracteres</span>
        </div>
        <div class="campo-val">${valor}</div>
      </div>`;
  }).join('');

  const totalChars = d.campos.reduce((s, c) => s + String(c.value || '').length, 0);
  const llenos = d.campos.filter(c => String(c.value || '').trim()).length;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: letter portrait; margin: 0.6in 0.65in; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
           color: ${MARCA.carbon}; font-size: 10.5pt; line-height: 1.55; margin: 0; }

    .cab { background: ${MARCA.carbon}; color: #fff; padding: 18px 20px; }
    .cab-marca { font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase;
                 color: ${MARCA.oro}; font-weight: 700; }
    .cab-tit { font-family: Georgia, 'Times New Roman', serif; font-size: 19pt;
               margin: 6px 0 2px; }
    .cab-sub { font-size: 9.5pt; color: rgba(255,255,255,.72); }

    .recibo { background: ${MARCA.teal}; color: #fff; padding: 9px 20px;
              font-size: 9.5pt; display: flex; justify-content: space-between; }
    .recibo b { letter-spacing: .05em; }

    .ident { background: ${MARCA.platino}; padding: 12px 20px; margin-bottom: 16px;
             border-left: 4px solid ${MARCA.oro}; }
    .ident table { width: 100%; border-collapse: collapse; }
    .ident td { padding: 2px 0; font-size: 9.5pt; vertical-align: top; }
    .ident td.k { color: ${MARCA.gris}; width: 130px; text-transform: uppercase;
                  font-size: 8pt; letter-spacing: .06em; padding-top: 4px; }
    .ident td.v { font-weight: 600; }

    .wrap { padding: 0 20px 20px; }

    .campo { margin-bottom: 15px; page-break-inside: avoid; }
    .campo-lbl { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .07em;
                 color: ${MARCA.teal}; font-weight: 700; padding-bottom: 4px;
                 border-bottom: 1.5px solid ${MARCA.teal}; margin-bottom: 6px; }
    .chars { float: right; color: ${MARCA.gris}; font-weight: 400;
             text-transform: none; letter-spacing: 0; font-size: 7.5pt; }
    .campo-val { background: #fff; border: 1px solid #dcdfe3; border-radius: 4px;
                 padding: 9px 11px; font-size: 10pt; white-space: pre-wrap;
                 word-wrap: break-word; }

    .resumen { margin-top: 18px; padding: 10px 14px; background: ${MARCA.platino};
               border-radius: 4px; font-size: 8.5pt; color: ${MARCA.gris}; }
    .pie { margin-top: 16px; border-top: 2px solid ${MARCA.oro}; padding-top: 8px;
           font-size: 7.5pt; color: ${MARCA.gris}; text-align: center; }
  </style></head><body>

  <div class="cab">
    <div class="cab-marca">Certificación Analista BAIP · Modelo ARIA</div>
    <div class="cab-tit">${escapar(nombreExp(d))}</div>
    <div class="cab-sub">Sprint Roadmap 01 · Identificación de Causas Raíz de los Obstáculos al ROI de la IA</div>
  </div>

  <div class="recibo">
    <span>Recibo <b>${recibo}</b></span>
    <span>${fecha}</span>
  </div>

  <div class="wrap">
    <div class="ident">
      <table>
        <tr><td class="k">Analista BAIP</td><td class="v">${escapar(p.nombre)}</td></tr>
        <tr><td class="k">Correo</td><td class="v">${escapar(p.email)}</td></tr>
        <tr><td class="k">Empresa</td><td class="v">${escapar(p.empresa || '—')}</td></tr>
        <tr><td class="k">Cohorte</td><td class="v">${escapar(p.cohorte)}</td></tr>
      </table>
    </div>

    ${bloques}

    <div class="resumen">
      <b>Resumen del envío:</b> ${llenos} de ${d.campos.length} campos diligenciados ·
      ${totalChars} caracteres en total · Recibo ${recibo}
    </div>

    <div class="pie">
      Digital Change Advisors, LLC · Modelo ARIA · Digital Change Academy<br>
      Documento generado automáticamente al recibir el envío. Licenciado bajo Creative Commons BY-SA 4.0.
    </div>
  </div>
  </body></html>`;
}

function escapar(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══ CORREOS ═══════════════════════════════════════════════════════════════
function enviarAFacilitador(d, recibo, pdf) {
  const p = d.participante;
  const asunto = `[ARIA Sprint 01 · Exp ${d.exp}] ${p.nombre} — ${p.cohorte} · ${recibo}`;

  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:600px">
      <div style="background:${MARCA.carbon};padding:16px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">
          NUEVO ENVÍO · CERTIFICACIÓN ANALISTA BAIP</div>
        <div style="color:#fff;font-size:18px;margin-top:5px;font-family:Georgia,serif">
          ${escapar(nombreExp(d))}</div>
      </div>
      <div style="background:${MARCA.teal};color:#fff;padding:8px 18px;font-size:13px">
        Recibo <b>${recibo}</b>
      </div>
      <div style="padding:18px">
        <table style="font-size:14px;border-collapse:collapse">
          <tr><td style="color:${MARCA.gris};padding:3px 14px 3px 0">Analista</td>
              <td><b>${escapar(p.nombre)}</b></td></tr>
          <tr><td style="color:${MARCA.gris};padding:3px 14px 3px 0">Correo</td>
              <td><a href="mailto:${escapar(p.email)}">${escapar(p.email)}</a></td></tr>
          <tr><td style="color:${MARCA.gris};padding:3px 14px 3px 0">Empresa</td>
              <td>${escapar(p.empresa || '—')}</td></tr>
          <tr><td style="color:${MARCA.gris};padding:3px 14px 3px 0">Cohorte</td>
              <td>${escapar(p.cohorte)}</td></tr>
        </table>
        <p style="font-size:14px;line-height:1.6;margin-top:16px">
          El reporte completo va adjunto en PDF, con todo el contenido de los campos
          y listo para tu revisión.
        </p>
        <p style="font-size:12px;color:${MARCA.gris};border-top:2px solid ${MARCA.oro};padding-top:10px">
          Digital Change Advisors · Modelo ARIA · Envío registrado automáticamente en la
          hoja de seguimiento de la cohorte.
        </p>
      </div>
    </div>`;

  const destinatarios = CONFIG.MAIL_FACILITADOR;
  const opciones = {
    name: CONFIG.REMITENTE,
    htmlBody: cuerpo,
    attachments: [pdf],
    replyTo: p.email, // el facilitador responde directo al estudiante
  };
  if (CONFIG.MAIL_COPIA) opciones.cc = CONFIG.MAIL_COPIA;

  GmailApp.sendEmail(destinatarios, asunto, 'Ver el mensaje en HTML.', opciones);
}

function enviarAlEstudiante(d, recibo, pdf) {
  const p = d.participante;
  const asunto = `✓ Recibimos tu ${nombreExp(d).split('—')[0].trim()} · Recibo ${recibo}`;

  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:600px">
      <div style="background:${MARCA.carbon};padding:16px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">
          DIGITAL CHANGE ACADEMY · CERTIFICACIÓN ANALISTA BAIP</div>
        <div style="color:#fff;font-size:19px;margin-top:5px;font-family:Georgia,serif">
          Tu envío quedó registrado</div>
      </div>
      <div style="background:${MARCA.teal};color:#fff;padding:8px 18px;font-size:13px">
        Recibo <b>${recibo}</b>
      </div>
      <div style="padding:18px">
        <p style="font-size:15px;line-height:1.6">Hola ${escapar(p.nombre.split(' ')[0])},</p>
        <p style="font-size:14px;line-height:1.6">
          Recibimos tu <b>${escapar(nombreExp(d))}</b>. Ya está en manos de tu
          facilitador y cuenta como entregado para el feedback de seguimiento y tu acceso
          a la Sesión de Mentoring colectivo del sprint.
        </p>
        <p style="font-size:14px;line-height:1.6">
          Adjuntamos tu reporte en PDF para tu archivo personal. Guarda este correo:
          el número de recibo <b>${recibo}</b> es tu comprobante.
        </p>
        <p style="font-size:14px;line-height:1.6">
          Si necesitas corregir algo, puedes volver al roadmap, ajustar tus respuestas y
          enviar de nuevo. Registramos la versión más reciente.
        </p>
        <p style="font-size:12px;color:${MARCA.gris};border-top:2px solid ${MARCA.oro};padding-top:10px;margin-top:18px">
          Digital Change Advisors · Modelo ARIA<br>
          Este es un mensaje automático, pero puedes responderlo si tienes dudas.
        </p>
      </div>
    </div>`;

  GmailApp.sendEmail(p.email, asunto, 'Ver el mensaje en HTML.', {
    name: CONFIG.REMITENTE,
    htmlBody: cuerpo,
    attachments: [pdf],
    replyTo: CONFIG.MAIL_FACILITADOR,
  });
}

// ══ AUDITORÍA DE ERRORES ══════════════════════════════════════════════════
function registrarError(err, e) {
  try {
    const hoja = obtenerHoja(CONFIG.HOJA_ERRORES, ['Timestamp', 'Error', 'Stack', 'Payload']);
    hoja.appendRow([
      new Date(),
      String(err && err.message),
      String(err && err.stack).substring(0, 900),
      (e && e.postData && e.postData.contents || '').substring(0, 900),
    ]);
  } catch (_) { /* nunca dejar que el logger tumbe la respuesta */ }
}

// ══ RESPUESTA JSON ════════════════════════════════════════════════════════
function responder(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══ UTILIDADES DE PRUEBA (ejecutar a mano desde el editor) ════════════════
/**
 * Ejecuta esta función una vez desde el editor de Apps Script para:
 *   a) otorgar los permisos que el script necesita, y
 *   b) comprobar que el correo y el PDF salen bien.
 */
function pruebaDeEnvio() {
  const demo = {
    instrumento: 'sprint-01-baip',
    exp: '101',
    participante: {
      nombre: 'Ana Prueba Martínez',
      email: Session.getActiveUser().getEmail(),
      empresa: 'Nexform Industrial',
      cohorte: 'BAIP-2026-01',
    },
    campos: [
      { id: 'f-101-rid-grupo', label: 'Grupo / Organización del reporte', value: 'Operaciones LATAM' },
      { id: 'f-101-rid-fecha', label: 'Fecha del reporte procesado', value: '2026-07-15' },
      { id: 'f-101-nivel', label: 'Nivel de trabajo', value: 'Equipo' },
      { id: 'f-101-e1', label: 'Hoja de clasificación', value: 'Texto largo de prueba.\n'.repeat(60) },
      { id: 'f-101-e2', label: 'Familia dominante y justificación', value: 'Creencia limitante dominante.' },
      { id: 'f-101-e3', label: 'Hipótesis de secuencia', value: 'Primero creencia, luego capacidad.' },
      { id: 'f-101-e4', label: 'Nota de contraste', value: 'Contraste con par ejecutivo.' },
      { id: 'f-101-obs', label: 'Observaciones', value: 'Prueba de extremo a extremo.' },
    ],
    meta: { userAgent: 'PRUEBA-EDITOR', origen: 'editor' },
  };

  const res = doPost({ postData: { contents: JSON.stringify(demo) } });
  Logger.log(res.getContent());
}

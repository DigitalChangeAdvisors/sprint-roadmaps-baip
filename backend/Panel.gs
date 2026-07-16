/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DCA · PANEL DE FACILITADOR
 *  Cockpit para leer entregas, evaluar con rúbrica, generar borrador de
 *  feedback con IA y despachar el feedback al estudiante — todo desde una
 *  página web servida por el mismo Apps Script.
 *
 *  Se sirve en:  <URL del Apps Script>/exec?panel=1
 *  Solo accesible para los correos de FACILITADORES (abajo).
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Facilitadores autorizados a abrir el panel y enviar feedback.
// Para varios facilitadores con cuentas distintas, ver README-panel-facilitador.md.
const FACILITADORES = [
  'ceo@digitalchangeadvisors.com',
  'facilitador@digitalchangeadvisors.com',
];

// Rúbrica de evaluación — genérica para cualquier experimento BAIP.
// Cambia los criterios aquí y el panel + la IA se adaptan solos.
const RUBRICA = [
  { clave: 'rigor',        titulo: 'Rigor diagnóstico',            descripcion: 'Profundidad del análisis y evidencia que lo sustenta.' },
  { clave: 'instrumento',  titulo: 'Uso del instrumento',          descripcion: 'Aplicación correcta de la lente (AIMT / AILS / AICD).' },
  { clave: 'causa_raiz',   titulo: 'Causa raíz y accionabilidad',  descripcion: 'Llega a la causa raíz y propone algo accionable.' },
  { clave: 'comunicacion', titulo: 'Claridad y comunicación',      descripcion: 'Comunicación ejecutiva, clara y ordenada.' },
];

// Columnas de feedback que el panel gestiona en la Hoja «Envios».
const COLS_FEEDBACK = ['RubricaJSON', 'PuntajeTotal', 'PuntajePromedio', 'FeedbackTexto', 'FeedbackEnviadoEn', 'FeedbackPor'];

// ══ GATE DE ACCESO ════════════════════════════════════════════════════════
function facilitadorActual() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}
function esFacilitador() {
  return FACILITADORES.map(f => f.toLowerCase()).indexOf(facilitadorActual()) !== -1;
}
function exigirFacilitador() {
  if (!esFacilitador()) throw new Error('No autorizado. Inicia sesión con tu cuenta de facilitador DCA.');
}

// ══ SERVIR EL PANEL (invocado desde doGet con ?panel=1) ═══════════════════
function servirPanel() {
  if (!esFacilitador()) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:60px auto;text-align:center;color:#1e2a38">' +
      '<h2 style="color:#2e8b76">Acceso restringido</h2>' +
      '<p>Este panel es solo para facilitadores de DCA. Inicia sesión con tu cuenta ' +
      '<b>@digitalchangeadvisors.com</b> autorizada y vuelve a abrir el enlace.</p></div>'
    ).setTitle('DCA · Panel de Facilitador');
  }
  const t = HtmlService.createTemplateFromFile('Panel');
  t.email = facilitadorActual();
  t.rubrica = RUBRICA;
  return t.evaluate()
    .setTitle('DCA · Panel de Facilitador')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ══ HOJA: helpers de columnas ═════════════════════════════════════════════
function _hojaEnvios() {
  return SpreadsheetApp.openById(idDelLibro()).getSheetByName(CONFIG.HOJA_REGISTRO);
}
function _encabezados(hoja) {
  return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
}
function _asegurarColumna(hoja, header) {
  const heads = _encabezados(hoja);
  let i = heads.indexOf(header);
  if (i === -1) {
    i = heads.length;
    hoja.getRange(1, i + 1).setValue(header)
        .setBackground(MARCA.teal).setFontColor('#ffffff').setFontWeight('bold');
  }
  return i + 1; // 1-based
}

// ══ LISTAR ENTREGAS (para el panel) ══════════════════════════════════════
function listarEntregas() {
  exigirFacilitador();
  const hoja = _hojaEnvios();
  if (!hoja || hoja.getLastRow() < 2) return { rubrica: RUBRICA, entregas: [] };

  COLS_FEEDBACK.forEach(h => _asegurarColumna(hoja, h)); // garantiza columnas
  const heads = _encabezados(hoja);
  const col = h => heads.indexOf(h);
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).getValues();

  const entregas = datos.map((f, k) => {
    const g = h => { const c = col(h); return c === -1 ? '' : f[c]; };
    return {
      fila: k + 2,
      recibo: String(g('ReciboID')),
      fecha: g('Timestamp') ? Utilities.formatDate(new Date(g('Timestamp')), 'America/Bogota', 'd MMM yyyy · HH:mm') : '',
      instrumento: String(g('Instrumento')),
      experimento: String(g('ExperimentoNombre') || g('Experimento')),
      nombre: String(g('Nombre')),
      email: String(g('Email')),
      empresa: String(g('Empresa')),
      cohorte: String(g('Cohorte')),
      nivel: String(g('Nivel')),
      campos: [
        { etq: 'E1', val: String(g('E1')) },
        { etq: 'E2', val: String(g('E2')) },
        { etq: 'E3', val: String(g('E3')) },
        { etq: 'E4', val: String(g('E4')) },
        { etq: 'Observaciones', val: String(g('Observaciones')) },
      ].filter(c => c.val && c.val.trim()),
      completitud: String(g('CompletitudPct')),
      feedbackEnviadoEn: g('FeedbackEnviadoEn')
        ? Utilities.formatDate(new Date(g('FeedbackEnviadoEn')), 'America/Bogota', 'd MMM yyyy · HH:mm') : '',
      feedbackPor: String(g('FeedbackPor') || ''),
      feedbackTexto: String(g('FeedbackTexto') || ''),
      rubricaGuardada: (() => { try { return JSON.parse(g('RubricaJSON') || 'null'); } catch (e) { return null; } })(),
      puntajePromedio: String(g('PuntajePromedio') || ''),
    };
  });

  // Más recientes primero.
  entregas.reverse();
  return { rubrica: RUBRICA, entregas: entregas, facilitador: facilitadorActual() };
}

// ══ BORRADOR DE FEEDBACK CON IA (Claude) ══════════════════════════════════
function generarBorradorIA(recibo) {
  exigirFacilitador();
  const e = _buscarEntrega(recibo);
  if (!e) throw new Error('No se encontró la entrega ' + recibo + '.');

  const contenido = e.campos.map(c => '### ' + c.etq + '\n' + c.val).join('\n\n');
  const criterios = RUBRICA.map(r => `- ${r.clave}: ${r.titulo} — ${r.descripcion}`).join('\n');

  const system =
    'Eres un facilitador de la Digital Change Academy (DCA) que evalúa entregas de la ' +
    'Certificación Analista BAIP del Modelo ARIA. Escribes SIEMPRE en tuteo (tú/tu), con voz ' +
    'consultiva, cálida pero rigurosa, sin adular ni ser blando. Nada de «usted». Evalúas la ' +
    'entrega contra una rúbrica de 4 criterios (escala 1 a 5) y redactas un feedback ' +
    'accionable de 4 a 6 frases: reconoce lo bien hecho, señala con precisión qué mejorar y por ' +
    'qué importa para el retorno de la IA, y cierra con un siguiente paso concreto. ' +
    'Es un BORRADOR: el facilitador humano lo revisará y ajustará antes de enviarlo.';

  const usuario =
    'EXPERIMENTO: ' + e.experimento + '\n' +
    'ANALISTA: ' + e.nombre + ' · Empresa: ' + e.empresa + ' · Cohorte: ' + e.cohorte + '\n\n' +
    'CRITERIOS DE LA RÚBRICA (asigna un puntaje 1–5 y una nota breve a cada uno):\n' + criterios + '\n\n' +
    'CONTENIDO ENTREGADO POR EL ANALISTA:\n' + contenido + '\n\n' +
    'Devuelve la evaluación por criterio y un comentario de feedback en tuteo.';

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      criterios: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            clave:   { type: 'string', enum: RUBRICA.map(r => r.clave) },
            puntaje: { type: 'integer', enum: [1, 2, 3, 4, 5] },
            nota:    { type: 'string' },
          },
          required: ['clave', 'puntaje', 'nota'],
        },
      },
      comentario: { type: 'string' },
    },
    required: ['criterios', 'comentario'],
  };

  const out = _llamarClaude(system, usuario, schema);
  // Normaliza: garantiza un criterio por cada clave de la rúbrica, en orden.
  const porClave = {};
  (out.criterios || []).forEach(c => { porClave[c.clave] = c; });
  const criteriosOrden = RUBRICA.map(r => ({
    clave: r.clave, titulo: r.titulo,
    puntaje: (porClave[r.clave] && porClave[r.clave].puntaje) || 3,
    nota: (porClave[r.clave] && porClave[r.clave].nota) || '',
  }));
  return { criterios: criteriosOrden, comentario: out.comentario || '' };
}

/** Llamada a la API de Claude (Anthropic) vía HTTP, con salida estructurada. */
function _llamarClaude(system, userText, schema) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en las Propiedades del script. Ver el README del panel.');

  const body = {
    model: 'claude-opus-4-8',      // Para bajar costo puedes cambiarlo a 'claude-sonnet-5'.
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema } },
    system: system,
    messages: [{ role: 'user', content: userText }],
  };

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const data = JSON.parse(res.getContentText());
  if (code !== 200) throw new Error('Claude API ' + code + ': ' + ((data.error && data.error.message) || ''));
  if (data.stop_reason === 'refusal') throw new Error('La IA declinó generar el borrador para esta entrega.');
  const bloque = (data.content || []).find(b => b.type === 'text' && b.text);
  if (!bloque) throw new Error('La IA respondió sin contenido de texto.');
  return JSON.parse(bloque.text);
}

// ══ ENVIAR FEEDBACK AL ESTUDIANTE ════════════════════════════════════════
function enviarFeedback(payload) {
  exigirFacilitador();
  const recibo = payload && payload.recibo;
  const e = _buscarEntrega(recibo);
  if (!e) throw new Error('No se encontró la entrega ' + recibo + '.');
  if (!e.email || !esEmailValido(e.email)) throw new Error('La entrega no tiene un correo de estudiante válido.');
  if (!payload.comentario || !payload.comentario.trim()) throw new Error('El comentario de feedback está vacío.');

  const criterios = (payload.criterios || []).map(c => {
    const def = RUBRICA.find(r => r.clave === c.clave) || { titulo: c.clave };
    return { clave: c.clave, titulo: def.titulo, puntaje: Number(c.puntaje) || 0, nota: String(c.nota || '') };
  });
  const conNota = criterios.filter(c => c.puntaje > 0);
  const suma = conNota.reduce((s, c) => s + c.puntaje, 0);
  const promedio = conNota.length ? (suma / conNota.length) : 0;

  // 1) Enviar el correo de feedback al estudiante (responder-a facilitador).
  _correoFeedback(e, criterios, payload.comentario, suma, promedio);

  // 2) Registrar en la Hoja.
  const hoja = _hojaEnvios();
  const set = (header, val) => hoja.getRange(e.fila, _asegurarColumna(hoja, header)).setValue(val);
  set('RubricaJSON', JSON.stringify(criterios));
  set('PuntajeTotal', suma);
  set('PuntajePromedio', Math.round(promedio * 100) / 100);
  set('FeedbackTexto', payload.comentario);
  set('FeedbackEnviadoEn', new Date());
  set('FeedbackPor', facilitadorActual());

  return { ok: true, enviadoEn: Utilities.formatDate(new Date(), 'America/Bogota', 'd MMM yyyy · HH:mm'), destinatario: e.email };
}

function _buscarEntrega(recibo) {
  const lista = listarEntregas().entregas;
  return lista.find(x => x.recibo === String(recibo)) || null;
}

function _correoFeedback(e, criterios, comentario, suma, promedio) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const primerNombre = (e.nombre || '').split(' ')[0] || 'Hola';

  const filas = criterios.filter(c => c.puntaje > 0).map(c => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(c.titulo)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${MARCA.teal}">${c.puntaje}/5</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${MARCA.gris};font-size:12px">${esc(c.nota)}</td>
    </tr>`).join('');

  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:620px">
      <div style="background:${MARCA.carbon};padding:16px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">
          DIGITAL CHANGE ACADEMY · CERTIFICACIÓN ANALISTA BAIP</div>
        <div style="color:#fff;font-size:19px;margin-top:5px;font-family:Georgia,serif">
          Feedback de tu entrega</div>
      </div>
      <div style="background:${MARCA.teal};color:#fff;padding:8px 18px;font-size:13px">
        ${esc(e.experimento)} · Recibo <b>${esc(e.recibo)}</b>
      </div>
      <div style="padding:18px">
        <p style="font-size:15px;line-height:1.6">Hola ${esc(primerNombre)},</p>
        <p style="font-size:14px;line-height:1.7">${esc(comentario).replace(/\n/g, '<br>')}</p>
        ${filas ? `
        <table style="border-collapse:collapse;width:100%;margin-top:14px;font-size:13px">
          <tr style="background:${MARCA.platino}">
            <th style="text-align:left;padding:6px 10px">Criterio</th>
            <th style="padding:6px 10px">Puntaje</th>
            <th style="text-align:left;padding:6px 10px">Nota</th>
          </tr>
          ${filas}
          <tr>
            <td style="padding:8px 10px;font-weight:700">Promedio</td>
            <td style="padding:8px 10px;text-align:center;font-weight:700;color:${MARCA.oro}">${(Math.round(promedio * 100) / 100)}/5</td>
            <td></td>
          </tr>
        </table>` : ''}
        <p style="font-size:12px;color:${MARCA.gris};border-top:2px solid ${MARCA.oro};padding-top:10px;margin-top:18px">
          Puedes responder este correo si tienes preguntas — llega directo a tu facilitador.<br>
          Digital Change Advisors · Modelo ARIA
        </p>
      </div>
    </div>`;

  GmailApp.sendEmail(e.email,
    'Feedback de tu ' + e.experimento.split('—')[0].trim() + ' · Recibo ' + e.recibo,
    'Ver el mensaje en HTML.', {
      name: CONFIG.REMITENTE,
      htmlBody: cuerpo,
      replyTo: CONFIG.MAIL_FACILITADOR,
      cc: CONFIG.MAIL_COPIA || undefined,
    });
}

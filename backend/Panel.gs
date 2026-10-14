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
const COLS_FEEDBACK = ['RubricaJSON', 'PuntajeTotal', 'PuntajePromedio', 'FeedbackTexto', 'MejorasJSON', 'FeedbackEnviadoEn', 'FeedbackPor', 'Veredicto'];

// ══ AUDICIÓN DE CERTIFICACIÓN (caso Vertecsa) ═════════════════════════════
// Instrumento 'audicion-baip': entregables 901–904, cierre 905 y mesa de consultas 990.
// La evaluación se emite sobre la entrega de CIERRE (905), con la IA leyendo los cuatro
// entregables más recientes del estudiante y la clave maestra, guardada en las
// Propiedades del script (CLAVE_AUDICION_1, CLAVE_AUDICION_2, …). Nunca en el repositorio.
const INSTRUMENTO_AUDICION = 'audicion-baip';
const RUBRICA_AUDICION = [
  { clave: 'c1', peso: 35, titulo: 'Precisión del diagnóstico y jerarquía de causa raíz',
    descripcion: 'Keystone correcto con evidencia de varias lentes y de la distribución; separa los dos señuelos; jerarquía completa. REGLA DE EXCLUSIÓN: tratar un síntoma o un señuelo como keystone es insuficiente de forma automática.' },
  { clave: 'c2', peso: 30, titulo: 'Integración de los tres instrumentos (el cruce)',
    descripcion: 'Triangula en lugar de sumar; identifica la falsa triangulación; cruza D21-D9; usa las declaraciones de cobertura y el documento del caso.' },
  { clave: 'c3', peso: 12, titulo: 'Calidad del plan de intervención (S5)',
    descripcion: 'Acciones ancladas, hechos auditables con dueño y fecha, keystone primero con aceleradores encadenados; sin «capacitar/sensibilizar».' },
  { clave: 'c5', peso: 8,  titulo: 'Modelo de impacto (S6) con inversión estimada',
    descripcion: 'Cadena adelantado-rezagado, escenarios declarados, costo de inacción sin costo hundido, inversión derivada (esfuerzo × tarifa de referencia) y no como cotización.' },
  { clave: 'c6', peso: 7,  titulo: 'Defensibilidad ante audiencia C-Level (por escrito)',
    descripcion: 'Matriz de anticipación: objeciones respondidas con hallazgos; concede y sostiene en la que reordena; límites declarados; no cotiza.' },
  { clave: 'c4', peso: 4,  titulo: 'Claridad ejecutiva del reporte',
    descripcion: 'S1 autocontenida, títulos que afirman la conclusión; decide sin leer el resto.' },
  { clave: 'c7', peso: 4,  titulo: 'Viabilidad operativa del plan',
    descripcion: 'Responsables, fases y delegación explícitos; componentes ARIA nombrados sin mecánica; S7 específico y no contractual.' },
];
const ETIQUETAS_AUDICION = {
  '901': ['Errores de integración identificados', 'Prueba de distribución', 'Tu keystone y los señuelos que descartas'],
  '902': ['Diagnóstico Integrado (S3)', 'Cruces y reconciliación de contradicciones', 'Mapa de Causa Raíz (S4)'],
  '903': ['Plan de Intervención 90 días (S5)', 'Modelo de Impacto (S6)', 'Caso de valor'],
  '904': ['Síntesis Ejecutiva (S1)', 'Matriz de anticipación', 'Síntesis y Decisión (S7)'],
  '905': ['Declaración de uso de IA', 'Autoevaluación contra la rúbrica', 'Declaración de autoría y solicitud de calificación'],
  '990': ['Tipo de consulta', 'Consulta', ''],
};
const VEREDICTOS = ['aprobado', 'ajustes', 'no_aprobado'];
// Flash Feedback: retroalimentación breve tras cada entregable (901–904). No califica; orienta.
const FLASH_EXPS = ['901', '902', '903', '904'];
const FLASH_CRITERIOS = { '901': ['c1', 'c2'], '902': ['c1', 'c2'], '903': ['c3', 'c5', 'c7'], '904': ['c4', 'c6', 'c7'] };
const FLASH_NIVELES = ['buen_camino', 'ajustar', 'replantear'];
const FLASH_ROT = { buen_camino: 'En buen camino', ajustar: 'Ajustar', replantear: 'Replantear' };
function _rubricaPara(instrumento) { return instrumento === INSTRUMENTO_AUDICION ? RUBRICA_AUDICION : RUBRICA; }
function _claveAudicion() {
  const props = PropertiesService.getScriptProperties();
  let texto = '';
  for (let i = 1; i <= 12; i++) {
    const parte = props.getProperty('CLAVE_AUDICION_' + i);
    if (!parte) break;
    texto += parte;
  }
  return texto;
}
function _puntajePonderado(criterios) {
  // Devuelve el promedio ponderado en escala 1–5 y su porcentaje (peso × puntaje / 5).
  let pct = 0, escala = 0;
  RUBRICA_AUDICION.forEach(r => {
    const c = (criterios || []).find(x => x.clave === r.clave);
    const pj = c ? Number(c.puntaje) || 0 : 0;
    pct += r.peso * (pj / 5);
    escala += (r.peso / 100) * pj;
  });
  return { pct: Math.round(pct * 10) / 10, escala: Math.round(escala * 100) / 100 };
}

// ══ GATE DE ACCESO ════════════════════════════════════════════════════════
// Dos formas de autorizar (basta una):
//  1) CLAVE SECRETA del panel: propiedad de script PANEL_KEY + ?key=... en la URL.
//     Funciona en CUALQUIER despliegue (incluido «Cualquier persona»). Recomendado.
//  2) CUENTA de facilitador: solo funciona en despliegues restringidos al dominio
//     (donde Google sí entrega el correo del usuario).
function facilitadorActual() {
  try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
  catch (e) { return ''; }
}
function esFacilitador() {
  const correo = facilitadorActual();
  return correo && FACILITADORES.map(f => f.toLowerCase()).indexOf(correo) !== -1;
}
function _claveConfigurada() {
  return PropertiesService.getScriptProperties().getProperty('PANEL_KEY') || '';
}
function _accesoOk(token) {
  const clave = _claveConfigurada();
  if (clave && token && String(token) === clave) return true; // por clave secreta
  return esFacilitador();                                      // o por cuenta de dominio
}
function exigirAcceso(token) {
  if (!_accesoOk(token)) throw new Error('No autorizado. Falta la clave del panel o tu cuenta no está autorizada.');
}

// ══ SERVIR EL PANEL (invocado desde doGet con ?panel=1&key=...) ═══════════
function servirPanel(e) {
  const token = (e && e.parameter && e.parameter.key) || '';
  if (!_accesoOk(token)) {
    const hayClave = !!_claveConfigurada();
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Montserrat,Arial,sans-serif;max-width:560px;margin:60px auto;text-align:center;color:#1e2a38">' +
      '<h2 style="color:#2e8b76">Acceso restringido</h2>' +
      '<p>Este panel es solo para facilitadores de DCA.</p>' +
      (hayClave
        ? '<p>Abre el enlace añadiendo tu <b>clave del panel</b> al final:<br>' +
          '<code>…/exec?panel=1&amp;key=TU_CLAVE</code></p>'
        : '<p>Aún no has configurado la clave del panel. Añade la propiedad de script ' +
          '<b>PANEL_KEY</b> y abre el enlace con <code>?panel=1&amp;key=TU_CLAVE</code>.</p>') +
      '</div>'
    ).setTitle('DCA · Panel de Facilitador');
  }
  const t = HtmlService.createTemplateFromFile('PanelUI');
  t.email = facilitadorActual() || 'facilitador';
  t.rubrica = RUBRICA;
  t.token = token; // el cliente lo reenvía en cada llamada al servidor
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
function listarEntregas(token) {
  exigirAcceso(token);
  return _todasEntregas();
}
function _todasEntregas() {
  const hoja = _hojaEnvios();
  if (!hoja || hoja.getLastRow() < 2) return { rubrica: RUBRICA, entregas: [] };

  COLS_FEEDBACK.forEach(h => _asegurarColumna(hoja, h)); // garantiza columnas
  const heads = _encabezados(hoja);
  const col = h => heads.indexOf(h);
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).getValues();

  const entregas = datos.map((f, k) => {
    const g = h => { const c = col(h); return c === -1 ? '' : f[c]; };
    const instr = String(g('Instrumento'));
    const exp = String(g('Experimento'));
    const esAud = instr === INSTRUMENTO_AUDICION;
    const etq = (esAud && ETIQUETAS_AUDICION[exp]) || ['E1', 'E2', 'E3', 'E4'];
    return {
      exp: exp,
      esAudicion: esAud,
      esConsulta: esAud && exp === '990',
      esCierre: esAud && exp === '905',
      esFlash: esAud && FLASH_EXPS.indexOf(exp) !== -1,
      criteriosFlash: (esAud && FLASH_CRITERIOS[exp]) ? RUBRICA_AUDICION.filter(r => FLASH_CRITERIOS[exp].indexOf(r.clave) !== -1).map(r => ({ clave: r.clave, titulo: r.titulo })) : [],
      rubrica: _rubricaPara(instr),
      veredicto: String(g('Veredicto') || ''),
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
        { etq: etq[0] || 'E1', val: String(g('E1')) },
        { etq: etq[1] || 'E2', val: String(g('E2')) },
        { etq: etq[2] || 'E3', val: String(g('E3')) },
        { etq: 'E4', val: String(g('E4')) },
        { etq: 'Observaciones', val: String(g('Observaciones')) },
      ].filter(c => c.val && c.val.trim()),
      completitud: String(g('CompletitudPct')),
      feedbackEnviadoEn: g('FeedbackEnviadoEn')
        ? Utilities.formatDate(new Date(g('FeedbackEnviadoEn')), 'America/Bogota', 'd MMM yyyy · HH:mm') : '',
      feedbackPor: String(g('FeedbackPor') || ''),
      feedbackTexto: String(g('FeedbackTexto') || ''),
      rubricaGuardada: (() => { try { return JSON.parse(g('RubricaJSON') || 'null'); } catch (e) { return null; } })(),
      mejorasGuardadas: (() => { try { return JSON.parse(g('MejorasJSON') || 'null'); } catch (e) { return null; } })(),
      puntajePromedio: String(g('PuntajePromedio') || ''),
    };
  });

  // Más recientes primero.
  entregas.reverse();
  return { rubrica: RUBRICA, entregas: entregas, facilitador: facilitadorActual() };
}

// ══ BORRADOR DE FEEDBACK CON IA (Claude) ══════════════════════════════════
function generarBorradorIA(token, recibo) {
  exigirAcceso(token);
  const e = _buscarEntrega(recibo);
  if (!e) throw new Error('No se encontró la entrega ' + recibo + '.');
  if (e.esConsulta) throw new Error('Esto es una consulta: usa «Responder consulta», no el borrador de evaluación.');
  if (e.esFlash) return _borradorFlash(e);
  if (e.esAudicion) {
    if (!e.esCierre) throw new Error('La audición se evalúa sobre la entrega de CIERRE (905), que reúne los cuatro entregables.');
    return _borradorAudicion(e);
  }

  const contenido = e.campos.map(c => '### ' + c.etq + '\n' + c.val).join('\n\n');
  const criterios = RUBRICA.map(r => `- ${r.clave}: ${r.titulo} — ${r.descripcion}`).join('\n');

  const system =
    'Eres un facilitador de la Digital Change Academy (DCA) que evalúa entregas de la ' +
    'Certificación Analista BAIP del Modelo ARIA. Escribes SIEMPRE en tuteo (tú/tu), con voz ' +
    'consultiva, cálida pero rigurosa, sin adular ni ser blando. Nada de «usted». Evalúas la ' +
    'entrega contra una rúbrica de 4 criterios (escala 1 a 5) y redactas un feedback ' +
    'accionable de 4 a 6 frases: reconoce lo bien hecho, señala con precisión qué mejorar y por ' +
    'qué importa para el retorno de la IA, y cierra con un siguiente paso concreto. ' +
    'No basta con señalar QUÉ mejorar: por cada punto débil relevante MUESTRA CÓMO se haría ' +
    'mejor con un ejemplo modelo y concreto —una versión reescrita, redactada en primera persona ' +
    'como si fueras el propio analista, del tipo «así se vería más fuerte»— para que aprenda el ' +
    'estándar y no solo el diagnóstico. El ejemplo debe ser específico al contenido de esta ' +
    'entrega (usa su empresa, sus datos, su caso), nunca genérico. ' +
    'Es un BORRADOR: el facilitador humano lo revisará y ajustará antes de enviarlo.';

  const usuario =
    'EXPERIMENTO: ' + e.experimento + '\n' +
    'ANALISTA: ' + e.nombre + ' · Empresa: ' + e.empresa + ' · Cohorte: ' + e.cohorte + '\n\n' +
    'CRITERIOS DE LA RÚBRICA (asigna un puntaje 1–5 y una nota breve a cada uno):\n' + criterios + '\n\n' +
    'CONTENIDO ENTREGADO POR EL ANALISTA:\n' + contenido + '\n\n' +
    'Devuelve tres cosas:\n' +
    '1) La evaluación por criterio (puntaje 1–5 + nota breve).\n' +
    '2) Un comentario de feedback en tuteo (4–6 frases).\n' +
    '3) Una GUÍA DE MEJORA (campo «mejoras»): para cada aspecto por mejorar que detectes ' +
    '(prioriza los criterios con puntaje 3 o menos, o cualquier debilidad concreta), un objeto con ' +
    '«foco» (el aspecto en pocas palabras), «ejemplo» (una versión modelo y concreta de cómo se ' +
    'vería bien hecho, redactada en tuteo/primera persona como lo escribiría el analista, lista ' +
    'para usarse de referencia y anclada al caso real de esta entrega) y «porque» (una frase de ' +
    'por qué esa versión es más fuerte y cómo impacta el retorno de la IA). Incluye entre 1 y 3 ' +
    'ejemplos, los de mayor impacto. Si la entrega es sobresaliente y no hay nada relevante que ' +
    'mejorar, devuelve «mejoras» como lista vacía.';

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
      mejoras: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            foco:    { type: 'string' },
            ejemplo: { type: 'string' },
            porque:  { type: 'string' },
          },
          required: ['foco', 'ejemplo', 'porque'],
        },
      },
    },
    required: ['criterios', 'comentario', 'mejoras'],
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
  const mejoras = (out.mejoras || [])
    .map(m => ({ foco: String((m && m.foco) || ''), ejemplo: String((m && m.ejemplo) || ''), porque: String((m && m.porque) || '') }))
    .filter(m => m.foco || m.ejemplo);
  return { criterios: criteriosOrden, comentario: out.comentario || '', mejoras: mejoras };
}

/** Llamada a la API de Claude (Anthropic) vía HTTP, con salida estructurada. */
function _llamarClaude(system, userText, schema) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY en las Propiedades del script. Ver el README del panel.');

  const body = {
    model: 'claude-sonnet-5',      // Modelo de la consulta. (Para máxima calidad: 'claude-opus-4-8'.)
    max_tokens: 8000,              // Holgado: comentario + rúbrica + Guía de mejora + thinking adaptivo.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema } },
    system: system,
    messages: [{ role: 'user', content: userText }],
  };

  // Reintentos con espera creciente ante saturación temporal de la API
  // (529 Overloaded, 429 Rate limit, 500/502/503). No reintenta errores de
  // cliente reales (p. ej. 400/401), que sí deben fallar de una.
  const TRANSITORIOS = [429, 500, 502, 503, 529];
  const ESPERAS_MS = [1500, 3000, 6000]; // 3 reintentos ⇒ 4 intentos en total
  let res, code, data;
  for (let intento = 0; intento <= ESPERAS_MS.length; intento++) {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    code = res.getResponseCode();
    if (code === 200) break;
    if (TRANSITORIOS.indexOf(code) !== -1 && intento < ESPERAS_MS.length) {
      Utilities.sleep(ESPERAS_MS[intento]);
      continue; // reintenta
    }
    break; // 200 no; y o no es transitorio o ya agotamos reintentos
  }

  data = JSON.parse(res.getContentText());
  if (code === 529 || code === 503) {
    throw new Error('La IA está saturada en este momento (la API respondió ' + code +
      '). Es temporal: espera unos segundos y vuelve a pulsar «Generar borrador con IA».');
  }
  if (code !== 200) throw new Error('Claude API ' + code + ': ' + ((data.error && data.error.message) || ''));
  if (data.stop_reason === 'refusal') throw new Error('La IA declinó generar el borrador para esta entrega.');
  if (data.stop_reason === 'max_tokens') throw new Error('La respuesta de la IA se cortó por longitud (max_tokens). Vuelve a intentar; si persiste, sube max_tokens en _llamarClaude.');
  const bloque = (data.content || []).find(b => b.type === 'text' && b.text);
  if (!bloque) throw new Error('La IA respondió sin contenido de texto.');
  try {
    return JSON.parse(bloque.text);
  } catch (err) {
    throw new Error('La IA devolvió un JSON incompleto (posible corte por longitud). Vuelve a intentar. Detalle: ' + err.message);
  }
}

// ══ ENVIAR FEEDBACK AL ESTUDIANTE ════════════════════════════════════════
function enviarFeedback(token, payload) {
  exigirAcceso(token);
  const recibo = payload && payload.recibo;
  const e = _buscarEntrega(recibo);
  if (!e) throw new Error('No se encontró la entrega ' + recibo + '.');
  if (!e.email || !esEmailValido(e.email)) throw new Error('La entrega no tiene un correo de estudiante válido.');
  if (!payload.comentario || !payload.comentario.trim()) throw new Error('El comentario de feedback está vacío.');

  if (e.esConsulta) throw new Error('Esto es una consulta: usa «Responder consulta».');
  if (e.esFlash) return _enviarFlash(e, payload);
  if (e.esAudicion) return _enviarResultadoAudicion(e, payload);

  const criterios = (payload.criterios || []).map(c => {
    const def = RUBRICA.find(r => r.clave === c.clave) || { titulo: c.clave };
    return { clave: c.clave, titulo: def.titulo, puntaje: Number(c.puntaje) || 0, nota: String(c.nota || '') };
  });
  const conNota = criterios.filter(c => c.puntaje > 0);
  const suma = conNota.reduce((s, c) => s + c.puntaje, 0);
  const promedio = conNota.length ? (suma / conNota.length) : 0;

  const mejoras = (payload.mejoras || [])
    .map(m => ({ foco: String((m && m.foco) || '').trim(), ejemplo: String((m && m.ejemplo) || '').trim(), porque: String((m && m.porque) || '').trim() }))
    .filter(m => m.foco || m.ejemplo);

  // 1) Enviar el correo de feedback al estudiante (responder-a facilitador).
  _correoFeedback(e, criterios, payload.comentario, suma, promedio, mejoras);

  // 2) Registrar en la Hoja.
  const hoja = _hojaEnvios();
  const set = (header, val) => hoja.getRange(e.fila, _asegurarColumna(hoja, header)).setValue(val);
  set('RubricaJSON', JSON.stringify(criterios));
  set('PuntajeTotal', suma);
  set('PuntajePromedio', Math.round(promedio * 100) / 100);
  set('FeedbackTexto', payload.comentario);
  set('MejorasJSON', JSON.stringify(mejoras));
  set('FeedbackEnviadoEn', new Date());
  set('FeedbackPor', facilitadorActual());

  return { ok: true, enviadoEn: Utilities.formatDate(new Date(), 'America/Bogota', 'd MMM yyyy · HH:mm'), destinatario: e.email };
}

function _buscarEntrega(recibo) {
  const lista = _todasEntregas().entregas;
  return lista.find(x => x.recibo === String(recibo)) || null;
}

function _correoFeedback(e, criterios, comentario, suma, promedio, mejoras) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const primerNombre = (e.nombre || '').split(' ')[0] || 'Hola';

  const filas = criterios.filter(c => c.puntaje > 0).map(c => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(c.titulo)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${MARCA.teal}">${c.puntaje}/5</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${MARCA.gris};font-size:12px">${esc(c.nota)}</td>
    </tr>`).join('');

  const guia = (mejoras && mejoras.length) ? `
    <div style="margin-top:22px">
      <div style="font-size:11px;letter-spacing:.12em;font-weight:700;color:${MARCA.teal};text-transform:uppercase;border-bottom:2px solid ${MARCA.oro};padding-bottom:6px">
        Cómo llevarlo al siguiente nivel</div>
      <p style="font-size:12px;color:${MARCA.gris};margin:8px 0 2px">Ejemplos concretos para que veas el estándar en acción:</p>
      ${mejoras.map(m => `
        <div style="border-left:3px solid ${MARCA.oro};padding:2px 0 2px 12px;margin-top:14px">
          ${m.foco ? `<div style="font-weight:700;font-size:13px;color:${MARCA.carbon}">${esc(m.foco)}</div>` : ''}
          ${m.ejemplo ? `<div style="background:${MARCA.platino};border-radius:6px;padding:10px 12px;margin-top:6px;font-size:13px;line-height:1.6">
            <span style="font-size:10px;letter-spacing:.1em;color:${MARCA.gris};font-weight:700">EJEMPLO · ASÍ SE VE MÁS FUERTE</span><br>
            ${esc(m.ejemplo).replace(/\n/g, '<br>')}</div>` : ''}
          ${m.porque ? `<div style="font-size:12px;color:${MARCA.gris};margin-top:6px"><b style="color:${MARCA.carbon}">Por qué funciona:</b> ${esc(m.porque)}</div>` : ''}
        </div>`).join('')}
    </div>` : '';

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
        ${guia}
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


// ═══════════════════════════════════════════════════════════════════════════
//  AUDICIÓN DE CERTIFICACIÓN · evaluación (7 criterios), consultas y devolución
// ═══════════════════════════════════════════════════════════════════════════

/** Último envío de cada entregable (901–905) de un estudiante en la audición. */
function _entregasDelEstudiante(email, instrumento) {
  const mail = String(email || '').toLowerCase();
  const lista = _todasEntregas().entregas.filter(x =>
    x.instrumento === instrumento && String(x.email || '').toLowerCase() === mail);
  const porExp = {};
  lista.forEach(x => { if (!porExp[x.exp]) porExp[x.exp] = x; }); // lista viene con lo más reciente primero
  return porExp;
}

/** Borrador de evaluación con la IA: lee los 4 entregables + cierre y la clave maestra. */
function _borradorAudicion(e) {
  const clave = _claveAudicion();
  if (!clave) throw new Error('Falta la clave de la audición. Cárgala en las Propiedades del script como CLAVE_AUDICION_1, CLAVE_AUDICION_2… (ver README del panel).');

  const porExp = _entregasDelEstudiante(e.email, INSTRUMENTO_AUDICION);
  const titulos = {
    '901': 'ENTREGABLE 1 — AUDITORÍA DEL BORRADOR', '902': 'ENTREGABLE 2 — DIAGNÓSTICO INTEGRADO Y CAUSA RAÍZ',
    '903': 'ENTREGABLE 3 — PLAN Y MODELO DE IMPACTO', '904': 'ENTREGABLE 4 — SÍNTESIS, DEFENSA Y DECISIÓN',
    '905': 'CIERRE — DECLARACIÓN DE USO DE IA Y SOLICITUD',
  };
  let contenido = '';
  ['901', '902', '903', '904', '905'].forEach(k => {
    const x = porExp[k];
    contenido += '\n\n======== ' + titulos[k] + ' ========\n';
    contenido += x ? x.campos.map(c => '### ' + c.etq + '\n' + c.val).join('\n\n') : '(NO ENTREGADO)';
  });
  const criterios = RUBRICA_AUDICION.map(r => `- ${r.clave} (peso ${r.peso}%): ${r.titulo} — ${r.descripcion}`).join('\n');

  const system =
    'Eres el asistente del único evaluador de la audición de certificación Analista BAIP de la Digital Change Academy. ' +
    'Preparas un BORRADOR de evaluación del trabajo de un estudiante sobre el caso Vertecsa Group; el evaluador humano lo revisará y decidirá. ' +
    'Evalúas SOLO contra la rúbrica de siete criterios y la CLAVE MAESTRA que se te entrega, con severidad de firma consultora premium. ' +
    'Escala por criterio: 1–2 insuficiente, 3 suficiente (cumple el mínimo), 4 suficiente sólido, 5 sobresaliente. ' +
    'Aplica la regla de exclusión del Criterio 1: si el estudiante declara como keystone un obstáculo distinto al de la clave (incluidos los dos señuelos), el Criterio 1 no puede superar 2 y la exclusión se marca como activada. ' +
    'Cada nota por criterio cita evidencia concreta del trabajo del estudiante. ' +
    'MUY IMPORTANTE: el comentario y la guía de mejora van dirigidos al estudiante (tuteo, voz consultiva, rigurosa, sin adular). NO reveles la clave maestra ni nombres el keystone correcto: señala qué tipo de error cometió y qué evidencia del caso debía reconsiderar, sin darle la respuesta. ' +
    'Detecta además señales de autoría dudosa, contradicciones con la declaración de uso de IA, entregables ausentes o incompletos y regístralas en «alertas». ' +
    'Si hay entregables «NO ENTREGADO», evalúa solo lo entregado y refleja la ausencia en los puntajes y en las alertas. ' +
    'Reglas de resultado para el veredicto sugerido: aprobado = todos los criterios en 3 o más; ajustes = algún criterio en 1–2 sobre un trabajo realmente ejecutado y corregible dentro de la semana 3 (la estudiante hace los ajustes y reenvía los entregables afectados, y luego se emite el veredicto final); no_aprobado = el trabajo no fue ejecutado, no se sostiene como propio, o los ajustes no resolvieron los criterios insuficientes. No existe el aprobado condicional ni plazos posteriores: todo se resuelve en la semana 3 y la cohorte se cierra.';

  const usuario =
    'ESTUDIANTE: ' + e.nombre + ' · ' + e.empresa + ' · Cohorte ' + e.cohorte + '\n\n' +
    'RÚBRICA (puntaje 1–5 por criterio):\n' + criterios + '\n\n' +
    '=== CLAVE MAESTRA (CONFIDENCIAL, solo para ti) ===\n' + clave + '\n=== FIN DE LA CLAVE ===\n\n' +
    'TRABAJO DEL ESTUDIANTE:' + contenido + '\n\n' +
    'Devuelve: (1) puntaje 1–5 y nota breve con evidencia por cada uno de los siete criterios; ' +
    '(2) cuáles de los cinco errores del borrador identificó (identificado / parcial / no_identificado) con una nota; ' +
    '(3) si la regla de exclusión está activada y por qué; (4) alertas; (5) veredicto sugerido; ' +
    '(6) un comentario de feedback al estudiante en tuteo (5–7 frases); (7) una guía de mejora de 1 a 3 ejemplos con «foco», «ejemplo» y «porque», sin revelar la respuesta correcta.';

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      criterios: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { clave: { type: 'string', enum: RUBRICA_AUDICION.map(r => r.clave) },
                      puntaje: { type: 'integer', enum: [1, 2, 3, 4, 5] }, nota: { type: 'string' } },
        required: ['clave', 'puntaje', 'nota'] } },
      errores: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { numero: { type: 'integer', enum: [1, 2, 3, 4, 5] },
                      estado: { type: 'string', enum: ['identificado', 'parcial', 'no_identificado'] }, nota: { type: 'string' } },
        required: ['numero', 'estado', 'nota'] } },
      exclusion: { type: 'object', additionalProperties: false,
        properties: { activada: { type: 'boolean' }, motivo: { type: 'string' } }, required: ['activada', 'motivo'] },
      alertas: { type: 'array', items: { type: 'string' } },
      veredicto_sugerido: { type: 'string', enum: VEREDICTOS },
      comentario: { type: 'string' },
      mejoras: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { foco: { type: 'string' }, ejemplo: { type: 'string' }, porque: { type: 'string' } },
        required: ['foco', 'ejemplo', 'porque'] } },
    },
    required: ['criterios', 'errores', 'exclusion', 'alertas', 'veredicto_sugerido', 'comentario', 'mejoras'],
  };

  const out = _llamarClaude(system, usuario, schema);
  const porClave = {};
  (out.criterios || []).forEach(c => { porClave[c.clave] = c; });
  const criteriosOrden = RUBRICA_AUDICION.map(r => ({
    clave: r.clave, titulo: r.titulo, peso: r.peso,
    puntaje: (porClave[r.clave] && porClave[r.clave].puntaje) || 3,
    nota: (porClave[r.clave] && porClave[r.clave].nota) || '',
  }));
  const mejoras = (out.mejoras || [])
    .map(m => ({ foco: String((m && m.foco) || ''), ejemplo: String((m && m.ejemplo) || ''), porque: String((m && m.porque) || '') }))
    .filter(m => m.foco || m.ejemplo);
  return {
    criterios: criteriosOrden, comentario: out.comentario || '', mejoras: mejoras,
    veredicto: out.veredicto_sugerido || '', errores: out.errores || [],
    exclusion: out.exclusion || { activada: false, motivo: '' }, alertas: out.alertas || [],
    ponderado: _puntajePonderado(criteriosOrden),
  };
}

/** Envía el resultado de la audición (devolución personalizada) y lo registra. */
function _enviarResultadoAudicion(e, payload) {
  const veredicto = String(payload.veredicto || '').toLowerCase();
  if (VEREDICTOS.indexOf(veredicto) === -1) throw new Error('Elige el veredicto: aprobado, ajustes o no aprobado.');
  const criterios = RUBRICA_AUDICION.map(r => {
    const c = (payload.criterios || []).find(x => x.clave === r.clave);
    return { clave: r.clave, titulo: r.titulo, peso: r.peso, puntaje: c ? Number(c.puntaje) || 0 : 0, nota: c ? String(c.nota || '') : '' };
  });
  if (criterios.some(c => c.puntaje < 1)) throw new Error('Califica los siete criterios (1 a 5) antes de enviar.');
  // Reglas de resultado: sin aprobado condicional.
  if (veredicto === 'aprobado' && criterios.some(c => c.puntaje <= 2))
    throw new Error('No se puede aprobar con un criterio en nivel insuficiente (1–2). Elige «ajustes» o corrige el puntaje.');
  const ponderado = _puntajePonderado(criterios);
  const mejoras = (payload.mejoras || [])
    .map(m => ({ foco: String((m && m.foco) || '').trim(), ejemplo: String((m && m.ejemplo) || '').trim(), porque: String((m && m.porque) || '').trim() }))
    .filter(m => m.foco || m.ejemplo);

  _correoResultadoAudicion(e, criterios, payload.comentario, ponderado, veredicto, mejoras);

  const hoja = _hojaEnvios();
  const set = (header, val) => hoja.getRange(e.fila, _asegurarColumna(hoja, header)).setValue(val);
  set('RubricaJSON', JSON.stringify(criterios));
  set('PuntajeTotal', ponderado.pct);
  set('PuntajePromedio', ponderado.escala);
  set('FeedbackTexto', payload.comentario);
  set('MejorasJSON', JSON.stringify(mejoras));
  set('FeedbackEnviadoEn', new Date());
  set('FeedbackPor', facilitadorActual());
  set('Veredicto', veredicto);
  return { ok: true, enviadoEn: Utilities.formatDate(new Date(), 'America/Bogota', 'd MMM yyyy · HH:mm'), destinatario: e.email, ponderado: ponderado };
}

function _correoResultadoAudicion(e, criterios, comentario, ponderado, veredicto, mejoras) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const primerNombre = (e.nombre || '').split(' ')[0] || 'Hola';
  const TERRA = '#c2593f';
  const cfg = {
    aprobado:  { color: MARCA.teal, titulo: 'Aprobado', texto: 'Superaste la audición de certificación. Te contactaremos con los pasos de emisión de tu certificado y tu incorporación al ecosistema de analistas certificados.' },
    ajustes:   { color: MARCA.oro,  titulo: 'Ajustes requeridos', texto: 'Tu trabajo tiene aspectos puntuales que se resuelven esta misma semana 3. Haz los ajustes que indica esta devolución, reenvía los entregables afectados desde tu documento de audición y luego te comunico el veredicto final.' },
    no_aprobado: { color: TERRA,    titulo: 'No aprobado', texto: 'Tu trabajo no alcanzó el estándar de certificación en esta audición. Responde este correo y conversamos los pasos siguientes.' },
  }[veredicto];

  const filas = criterios.map(c => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(c.titulo)}<div style="font-size:11px;color:${MARCA.gris}">Peso ${c.peso}%</div></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:${MARCA.teal}">${c.puntaje}/5</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${MARCA.gris};font-size:12px">${esc(c.nota)}</td>
    </tr>`).join('');
  const guia = (mejoras && mejoras.length) ? `
    <div style="margin-top:22px">
      <div style="font-size:11px;letter-spacing:.12em;font-weight:700;color:${MARCA.teal};text-transform:uppercase;border-bottom:2px solid ${MARCA.oro};padding-bottom:6px">Cómo llevarlo al siguiente nivel</div>
      ${mejoras.map(m => `
        <div style="border-left:3px solid ${MARCA.oro};padding:2px 0 2px 12px;margin-top:14px">
          ${m.foco ? `<div style="font-weight:700;font-size:13px;color:${MARCA.carbon}">${esc(m.foco)}</div>` : ''}
          ${m.ejemplo ? `<div style="background:${MARCA.platino};border-radius:6px;padding:10px 12px;margin-top:6px;font-size:13px;line-height:1.6">${esc(m.ejemplo).replace(/\n/g, '<br>')}</div>` : ''}
          ${m.porque ? `<div style="font-size:12px;color:${MARCA.gris};margin-top:6px"><b style="color:${MARCA.carbon}">Por qué funciona:</b> ${esc(m.porque)}</div>` : ''}
        </div>`).join('')}
    </div>` : '';

  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:640px">
      <div style="background:${MARCA.carbon};padding:16px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">DIGITAL CHANGE ACADEMY · CERTIFICACIÓN ANALISTA BAIP</div>
        <div style="color:#fff;font-size:19px;margin-top:5px;font-family:Georgia,serif">Resultado de tu audición de certificación</div>
      </div>
      <div style="background:${cfg.color};color:#fff;padding:10px 18px;font-size:15px;font-weight:700">${cfg.titulo} · Puntaje ponderado ${ponderado.pct}%</div>
      <div style="padding:18px">
        <p style="font-size:15px;line-height:1.6">Hola ${esc(primerNombre)},</p>
        <p style="font-size:14px;line-height:1.7">${esc(cfg.texto)}</p>
        <p style="font-size:14px;line-height:1.7">${esc(comentario).replace(/\n/g, '<br>')}</p>
        <table style="border-collapse:collapse;width:100%;margin-top:14px;font-size:13px">
          <tr style="background:${MARCA.platino}"><th style="text-align:left;padding:6px 10px">Criterio</th><th style="padding:6px 10px">Puntaje</th><th style="text-align:left;padding:6px 10px">Nota</th></tr>
          ${filas}
          <tr><td style="padding:8px 10px;font-weight:700">Puntaje ponderado</td><td style="padding:8px 10px;text-align:center;font-weight:700;color:${MARCA.oro}">${ponderado.pct}%</td><td></td></tr>
        </table>
        ${guia}
        <p style="font-size:12px;color:${MARCA.gris};border-top:2px solid ${MARCA.oro};padding-top:10px;margin-top:18px">
          Puedes responder este correo: llega directo a tu facilitador.<br>Digital Change Advisors · Modelo ARIA</p>
      </div>
    </div>`;

  GmailApp.sendEmail(e.email, 'Resultado de tu audición de certificación · Recibo ' + e.recibo, 'Ver el mensaje en HTML.', {
    name: CONFIG.REMITENTE, htmlBody: cuerpo, replyTo: CONFIG.MAIL_FACILITADOR, cc: CONFIG.MAIL_COPIA || undefined,
  });
}

/** Respuesta individual a una consulta de la Mesa de consultas (exp 990). */
function responderConsulta(token, payload) {
  exigirAcceso(token);
  const e = _buscarEntrega(payload && payload.recibo);
  if (!e) throw new Error('No se encontró la consulta.');
  if (!e.esConsulta) throw new Error('Esta entrega no es una consulta.');
  if (!e.email || !esEmailValido(e.email)) throw new Error('La consulta no tiene un correo de estudiante válido.');
  const respuesta = String((payload && payload.respuesta) || '').trim();
  if (!respuesta) throw new Error('Escribe la respuesta antes de enviar.');

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const primerNombre = (e.nombre || '').split(' ')[0] || 'Hola';
  const pregunta = e.campos.filter(c => c.etq !== 'Tipo de consulta').map(c => c.val).join('\n\n');
  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:620px">
      <div style="background:${MARCA.carbon};padding:14px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">DIGITAL CHANGE ACADEMY · AUDICIÓN DE CERTIFICACIÓN</div>
        <div style="color:#fff;font-size:18px;margin-top:4px;font-family:Georgia,serif">Respuesta a tu consulta</div>
      </div>
      <div style="padding:18px">
        <p style="font-size:15px">Hola ${esc(primerNombre)},</p>
        <p style="font-size:14px;line-height:1.7">${esc(respuesta).replace(/\n/g, '<br>')}</p>
        <div style="margin-top:16px;background:${MARCA.platino};border-left:3px solid ${MARCA.oro};padding:10px 12px;font-size:12px;color:${MARCA.gris}">
          <b>Tu consulta (${esc(e.fecha)}):</b><br>${esc(pregunta).replace(/\n/g, '<br>')}</div>
        <p style="font-size:12px;color:${MARCA.gris};margin-top:16px">Puedes responder este correo o enviar otra consulta desde tu documento de audición.<br>Digital Change Advisors · Modelo ARIA</p>
      </div>
    </div>`;
  GmailApp.sendEmail(e.email, 'Respuesta a tu consulta · Audición de certificación', 'Ver el mensaje en HTML.', {
    name: CONFIG.REMITENTE, htmlBody: cuerpo, replyTo: CONFIG.MAIL_FACILITADOR, cc: CONFIG.MAIL_COPIA || undefined,
  });

  const hoja = _hojaEnvios();
  const set = (header, val) => hoja.getRange(e.fila, _asegurarColumna(hoja, header)).setValue(val);
  set('FeedbackTexto', respuesta);
  set('FeedbackEnviadoEn', new Date());
  set('FeedbackPor', facilitadorActual());
  return { ok: true, enviadoEn: Utilities.formatDate(new Date(), 'America/Bogota', 'd MMM yyyy · HH:mm'), destinatario: e.email };
}


// ═══════════════════════════════════════════════════════════════════════════
//  FLASH FEEDBACK · retroalimentación breve tras cada entregable (901–904)
//  Orienta, no califica. La calificación se emite una sola vez, sobre el cierre (905).
// ═══════════════════════════════════════════════════════════════════════════

function _borradorFlash(e) {
  const clave = _claveAudicion();
  if (!clave) throw new Error('Falta la clave de la audición (CLAVE_AUDICION_1, 2, 3, 4) en las Propiedades del script.');
  const claves = FLASH_CRITERIOS[e.exp];
  const crit = RUBRICA_AUDICION.filter(r => claves.indexOf(r.clave) !== -1);
  const criteriosTxt = crit.map(r => `- ${r.clave}: ${r.titulo} — ${r.descripcion}`).join('\n');

  // Contexto: entregables previos del mismo estudiante (para juzgar coherencia entre ellos).
  const porExp = _entregasDelEstudiante(e.email, INSTRUMENTO_AUDICION);
  let previos = '';
  FLASH_EXPS.filter(k => k < e.exp).forEach(k => {
    const x = porExp[k];
    previos += '\n\n---- ENTREGABLE PREVIO ' + k + ' ----\n' + (x ? x.campos.map(c => '### ' + c.etq + '\n' + c.val).join('\n\n') : '(NO ENTREGADO)');
  });
  const actual = e.campos.map(c => '### ' + c.etq + '\n' + c.val).join('\n\n');

  const system =
    'Eres el asistente del único evaluador de la audición Analista BAIP de la Digital Change Academy. ' +
    'Preparas un FLASH FEEDBACK: una retroalimentación breve, formativa y NO calificada que el estudiante recibe tras cada entregable para orientar el siguiente. ' +
    'Usas la CLAVE MAESTRA solo para juzgar el trabajo; NUNCA la reveles ni nombres el keystone correcto ni los errores del borrador por su número. ' +
    'Orienta señalando qué tipo de error o vacío ves y qué evidencia del caso debe reconsiderar, sin darle la respuesta. ' +
    'Voz consultiva en tuteo, directa, sin adular, máximo 5 frases en el comentario. ' +
    'Por cada criterio indica un nivel: «buen_camino» (va bien, sigue así), «ajustar» (hay vacíos corregibles) o «replantear» (la lectura central no se sostiene con la evidencia). ' +
    'Registra en «alertas» (solo para el evaluador) cualquier señal de autoría dudosa, incoherencia con entregables previos o contenido ausente.';
  const usuario =
    'ESTUDIANTE: ' + e.nombre + ' · Cohorte ' + e.cohorte + '\n' +
    'ENTREGABLE: ' + e.experimento + '\n\n' +
    'CRITERIOS QUE SE ORIENTAN EN ESTE FLASH:\n' + criteriosTxt + '\n\n' +
    '=== CLAVE MAESTRA (CONFIDENCIAL, solo para ti) ===\n' + clave + '\n=== FIN DE LA CLAVE ===\n\n' +
    'ENTREGABLE A ORIENTAR:\n' + actual + '\n' + (previos ? '\nCONTEXTO (entregables previos):' + previos : '') + '\n\n' +
    'Devuelve: un nivel y una nota breve por criterio; un comentario flash de máximo 5 frases; alertas para el evaluador; y, si aporta, UNA sola mejora con foco, ejemplo y porque (sin revelar la respuesta correcta).';

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      indicadores: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { clave: { type: 'string', enum: claves }, nivel: { type: 'string', enum: FLASH_NIVELES }, nota: { type: 'string' } },
        required: ['clave', 'nivel', 'nota'] } },
      comentario: { type: 'string' },
      alertas: { type: 'array', items: { type: 'string' } },
      mejoras: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { foco: { type: 'string' }, ejemplo: { type: 'string' }, porque: { type: 'string' } },
        required: ['foco', 'ejemplo', 'porque'] } },
    },
    required: ['indicadores', 'comentario', 'alertas', 'mejoras'],
  };
  const out = _llamarClaude(system, usuario, schema);
  const porClave = {};
  (out.indicadores || []).forEach(i => { porClave[i.clave] = i; });
  const indicadores = crit.map(r => ({ clave: r.clave, titulo: r.titulo,
    nivel: (porClave[r.clave] && porClave[r.clave].nivel) || 'ajustar', nota: (porClave[r.clave] && porClave[r.clave].nota) || '' }));
  const mejoras = (out.mejoras || []).slice(0, 1)
    .map(m => ({ foco: String((m && m.foco) || ''), ejemplo: String((m && m.ejemplo) || ''), porque: String((m && m.porque) || '') }))
    .filter(m => m.foco || m.ejemplo);
  return { flash: true, indicadores: indicadores, comentario: out.comentario || '', mejoras: mejoras, alertas: out.alertas || [] };
}

function _enviarFlash(e, payload) {
  const comentario = String((payload && payload.comentario) || '').trim();
  if (!comentario) throw new Error('El comentario del Flash Feedback está vacío.');
  const claves = FLASH_CRITERIOS[e.exp] || [];
  const indicadores = claves.map(k => {
    const def = RUBRICA_AUDICION.find(r => r.clave === k);
    const x = (payload.indicadores || []).find(i => i.clave === k) || {};
    const nivel = FLASH_NIVELES.indexOf(x.nivel) !== -1 ? x.nivel : '';
    return { clave: k, titulo: def.titulo, nivel: nivel, nota: String(x.nota || '') };
  });
  if (indicadores.some(i => !i.nivel)) throw new Error('Elige un nivel para cada criterio del Flash Feedback.');
  const mejoras = (payload.mejoras || [])
    .map(m => ({ foco: String((m && m.foco) || '').trim(), ejemplo: String((m && m.ejemplo) || '').trim(), porque: String((m && m.porque) || '').trim() }))
    .filter(m => m.foco || m.ejemplo);

  _correoFlash(e, indicadores, comentario, mejoras);

  const hoja = _hojaEnvios();
  const set = (header, val) => hoja.getRange(e.fila, _asegurarColumna(hoja, header)).setValue(val);
  set('RubricaJSON', JSON.stringify(indicadores));
  set('FeedbackTexto', comentario);
  set('MejorasJSON', JSON.stringify(mejoras));
  set('FeedbackEnviadoEn', new Date());
  set('FeedbackPor', facilitadorActual());
  set('Veredicto', 'flash');
  return { ok: true, enviadoEn: Utilities.formatDate(new Date(), 'America/Bogota', 'd MMM yyyy · HH:mm'), destinatario: e.email };
}

function _correoFlash(e, indicadores, comentario, mejoras) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const primerNombre = (e.nombre || '').split(' ')[0] || 'Hola';
  const colores = { buen_camino: MARCA.teal, ajustar: MARCA.oro, replantear: '#c2593f' };
  const num = Number(e.exp) - 900;
  const siguiente = num < 4 ? ('Sigue con el Entregable ' + (num + 1) + '.') : 'Sigue con el cierre y la solicitud de calificación final.';
  const filas = indicadores.map(i => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(i.titulo)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center"><span style="background:${colores[i.nivel]};color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:12px;white-space:nowrap">${esc(FLASH_ROT[i.nivel])}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:${MARCA.gris};font-size:12px">${esc(i.nota)}</td>
    </tr>`).join('');
  const guia = (mejoras && mejoras.length) ? mejoras.map(m => `
    <div style="border-left:3px solid ${MARCA.oro};padding:2px 0 2px 12px;margin-top:14px">
      ${m.foco ? `<div style="font-weight:700;font-size:13px">${esc(m.foco)}</div>` : ''}
      ${m.ejemplo ? `<div style="background:${MARCA.platino};border-radius:6px;padding:10px 12px;margin-top:6px;font-size:13px;line-height:1.6">${esc(m.ejemplo).replace(/\n/g, '<br>')}</div>` : ''}
      ${m.porque ? `<div style="font-size:12px;color:${MARCA.gris};margin-top:6px"><b style="color:${MARCA.carbon}">Por qué funciona:</b> ${esc(m.porque)}</div>` : ''}
    </div>`).join('') : '';
  const cuerpo = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:${MARCA.carbon};max-width:620px">
      <div style="background:${MARCA.carbon};padding:14px 18px">
        <div style="color:${MARCA.oro};font-size:11px;letter-spacing:.14em;font-weight:700">DIGITAL CHANGE ACADEMY · AUDICIÓN DE CERTIFICACIÓN</div>
        <div style="color:#fff;font-size:19px;margin-top:4px;font-family:Georgia,serif">⚡ Flash Feedback · Entregable ${num}</div>
      </div>
      <div style="background:${MARCA.oro};color:#fff;padding:8px 18px;font-size:13px">Orientación breve para tu siguiente paso. No es una calificación.</div>
      <div style="padding:18px">
        <p style="font-size:15px">Hola ${esc(primerNombre)},</p>
        <p style="font-size:14px;line-height:1.7">${esc(comentario).replace(/\n/g, '<br>')}</p>
        <table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:13px">
          <tr style="background:${MARCA.platino}"><th style="text-align:left;padding:6px 10px">Criterio</th><th style="padding:6px 10px">Nivel</th><th style="text-align:left;padding:6px 10px">Orientación</th></tr>
          ${filas}
        </table>
        ${guia}
        <p style="font-size:13px;margin-top:16px"><b>${esc(siguiente)}</b> Puedes reenviar una versión corregida de este entregable mientras la ventana esté abierta.</p>
        <p style="font-size:12px;color:${MARCA.gris};border-top:2px solid ${MARCA.oro};padding-top:10px;margin-top:14px">Puedes responder este correo o usar la Mesa de consultas.<br>Digital Change Advisors · Modelo ARIA</p>
      </div>
    </div>`;
  GmailApp.sendEmail(e.email, '⚡ Flash Feedback · Entregable ' + num + ' · Audición de certificación', 'Ver el mensaje en HTML.', {
    name: CONFIG.REMITENTE, htmlBody: cuerpo, replyTo: CONFIG.MAIL_FACILITADOR, cc: CONFIG.MAIL_COPIA || undefined,
  });
}

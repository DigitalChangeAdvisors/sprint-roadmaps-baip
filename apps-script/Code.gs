/**
 * BAIP Roadmaps — Backend (Google Apps Script Web App)
 * Capa crítica (Opus): routing, CORS, identidad/seguridad scoped por sid,
 * autosave con guarda de revisión (rev) y conflicto, submit+acuse, migración.
 *
 * Ver SPEC.md para el contrato completo. Las piezas marcadas TODO(Sonnet)
 * (PDF a Drive, notificación Gmail, panel/feedback admin) se implementan después.
 *
 * Script Properties requeridas: SPREADSHEET_ID, ADMIN_TOKEN, SCHEMA_VERSION
 */

// ───────────────────────── Config ─────────────────────────
function cfg_() {
  var p = PropertiesService.getScriptProperties();
  return {
    ssId: p.getProperty('SPREADSHEET_ID'),
    adminToken: p.getProperty('ADMIN_TOKEN') || '',
    schemaVersion: parseInt(p.getProperty('SCHEMA_VERSION') || '1', 10)
  };
}

var SHEETS = { ROSTER: 'Roster', AUTOSAVE: 'Autosave', RESP: 'Respuestas', FEEDBACK: 'Feedback', AUDIT: 'Auditoría' };

// ───────────────────────── Entry points ─────────────────────────
// GET  → lecturas idempotentes (load, getFeedback). Simple request → sin preflight.
function doGet(e)  { return route_('GET',  e); }
// POST → escrituras (autosave, submit). Cliente envía text/plain (sin preflight).
function doPost(e) { return route_('POST', e); }

function route_(method, e) {
  try {
    var params = readParams_(method, e);
    var action = String(params.action || '');
    switch (action) {
      case 'load':        return ok_(action, handleLoad_(params));
      case 'autosave':    return handleAutosave_(params); // gestiona su propio ok/conflict
      case 'submit':      return ok_(action, handleSubmit_(params));
      case 'getFeedback': return ok_(action, handleGetFeedback_(params));
      // ── Operaciones admin (requieren ADMIN_TOKEN). El panel del facilitador (Sonnet)
      //    debería preferir el script BOUND con identidad Google. Aquí, defensa por token. ──
      case 'saveFeedback': requireAdmin_(params); return ok_(action, handleSaveFeedback_(params)); // TODO(Sonnet)
      case 'listCohort':   requireAdmin_(params); return ok_(action, handleListCohort_(params));   // TODO(Sonnet)
      default: return err_(action, 'BAD_REQUEST', 'Acción no reconocida.');
    }
  } catch (ex) {
    var code = (ex && ex.appCode) ? ex.appCode : 'SERVER';
    return err_((e && e.parameter && e.parameter.action) || 'unknown', code, String(ex && ex.message || ex));
  }
}

// ───────────────────────── Request / Response ─────────────────────────
function readParams_(method, e) {
  if (method === 'POST' && e && e.postData && e.postData.contents) {
    // Cuerpo text/plain con JSON (ver SPEC: evita preflight CORS).
    try { return JSON.parse(e.postData.contents); }
    catch (_) { throwApp_('BAD_REQUEST', 'Cuerpo JSON inválido.'); }
  }
  return (e && e.parameter) ? e.parameter : {};
}

function jsonOut_(obj) {
  // ContentService; la respuesta final (googleusercontent.com) trae ACAO:* para simple requests.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ok_(action, data)        { return jsonOut_({ ok: true,  action: action, data: data || {} }); }
function err_(action, code, msg)  { return jsonOut_({ ok: false, action: action, error: { code: code, message: msg } }); }
function throwApp_(code, msg)     { var e = new Error(msg); e.appCode = code; throw e; }

// ───────────────────────── Identidad / Seguridad ─────────────────────────
/**
 * Frontera de identidad AISLADA: hoy resuelve por capability token (sid) contra Roster.
 * Migrar a Google Sign-In = reimplementar SOLO esta función (validar Session.getActiveUser()).
 * Devuelve el contexto del estudiante o lanza UNAUTHORIZED. NUNCA confía en datos del cliente
 * más allá del sid; nombre/cohorte se toman del Roster del servidor.
 */
function resolveIdentity_(params) {
  var sid = String(params.sid || '').trim();
  if (!sid || sid.length < 16) throwApp_('UNAUTHORIZED', 'sid ausente o inválido.');
  var cache = CacheService.getScriptCache();
  var ck = 'roster:' + sid;
  var cached = cache.get(ck);
  if (cached) {
    var c = JSON.parse(cached);
    if (!c.activo) throwApp_('UNAUTHORIZED', 'sid inactivo.');
    return c;
  }
  var sh = sheet_(SHEETS.ROSTER);
  var values = sh.getDataRange().getValues();
  var head = values[0];
  var col = colIndex_(head, ['sid','nombre','email','cohorte','sprints','activo']);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col.sid]).trim() === sid) {
      var ctx = {
        sid: sid,
        nombre: values[r][col.nombre],
        email: values[r][col.email],
        cohorte: values[r][col.cohorte],
        sprints: String(values[r][col.sprints] || ''),
        activo: isTrue_(values[r][col.activo]),
        _row: r + 1
      };
      cache.put(ck, JSON.stringify(ctx), 300); // 5 min
      if (!ctx.activo) throwApp_('UNAUTHORIZED', 'sid inactivo.');
      return ctx;
    }
  }
  throwApp_('UNAUTHORIZED', 'sid no encontrado en Roster.');
}

/** Compara ADMIN_TOKEN en tiempo (casi) constante. Operaciones admin NO scoped por sid. */
function requireAdmin_(params) {
  var given = String(params.adminToken || '');
  var expected = cfg_().adminToken;
  if (!expected || given.length !== expected.length) throwApp_('UNAUTHORIZED', 'Admin no autorizado.');
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) ^ expected.charCodeAt(i));
  if (diff !== 0) throwApp_('UNAUTHORIZED', 'Admin no autorizado.');
  return true;
}

// ───────────────────────── Handlers ─────────────────────────
function handleLoad_(params) {
  var id = resolveIdentity_(params);
  var sprint = sprint_(params);
  var rec = findAutosave_(id.sid, sprint);
  if (!rec) return { rev: 0, schemaVersion: cfg_().schemaVersion, updatedAt: null, fields: {} };
  var data = migrate_(JSON.parse(rec.dataJson || '{}'));
  audit_(id.sid, 'load', sprint, '', 'ok');
  return { rev: rec.rev, schemaVersion: cfg_().schemaVersion, updatedAt: rec.updatedAt, fields: data.fields || {} };
}

function handleAutosave_(params) {
  var id = resolveIdentity_(params);
  var sprint = sprint_(params);
  var baseRev = parseInt(params.baseRev || 0, 10);
  var fields = params.fields || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(8000); // integridad de rev frente a escrituras concurrentes
  try {
    var rec = findAutosave_(id.sid, sprint);
    var storedRev = rec ? rec.rev : 0;
    if (rec && baseRev !== storedRev) {
      // Otro dispositivo escribió → conflicto. Devolver estado del servidor (sin pérdida).
      audit_(id.sid, 'autosave', sprint, '', 'conflict');
      var srv = migrate_(JSON.parse(rec.dataJson || '{}'));
      return jsonOut_({ ok: false, action: 'autosave',
        error: { code: 'CONFLICT', message: 'Avance actualizado en otro dispositivo.' },
        data: { rev: storedRev, updatedAt: rec.updatedAt, fields: srv.fields || {} } });
    }
    var newRev = storedRev + 1;
    var now = new Date().toISOString();
    var blob = JSON.stringify({ schemaVersion: cfg_().schemaVersion, sid: id.sid, sprint: sprint, fields: fields });
    upsertAutosave_(id.sid, sprint, newRev, now, blob, rec);
    audit_(id.sid, 'autosave', sprint, '', 'ok');
    return jsonOut_({ ok: true, action: 'autosave', data: { rev: newRev, updatedAt: now } });
  } finally {
    lock.releaseLock();
  }
}

function handleSubmit_(params) {
  var id = resolveIdentity_(params);
  var sprint = sprint_(params);
  var exp = String(params.experimento || '').trim();
  if (!exp) throwApp_('BAD_REQUEST', 'experimento requerido.');
  var fields = params.fields || {};
  var ident = params.identificacion || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = sheet_(SHEETS.RESP);
    var found = findRespRow_(sh, id.sid, sprint, exp);
    var now = new Date().toISOString();
    var submitCount = found ? (parseInt(found.row[found.col.submitCount] || 0, 10) + 1) : 1;
    var firstAt = found ? found.row[found.col.firstSubmittedAt] : now;
    var acuseId = 'BAIP-S' + sprint + '-' + exp + '-' + id.sid.substring(0, 8) + '-' + submitCount;
    var rowObj = {
      sid: id.sid, nombre: id.nombre, cohorte: id.cohorte, sprint: sprint, experimento: exp,
      identificacionJson: JSON.stringify(ident),
      e1: fields[firstKey_(fields,'-e1')] || '', e2: fields[firstKey_(fields,'-e2')] || '',
      e3: fields[firstKey_(fields,'-e3')] || '', e4: fields[firstKey_(fields,'-e4')] || '',
      obs: params.obs || fields[firstKey_(fields,'-obs')] || '',
      fieldsJson: JSON.stringify(fields), estado: 'enviado', submitCount: submitCount,
      firstSubmittedAt: firstAt, lastSubmittedAt: now, acuseId: acuseId, pdfUrl: (found ? found.row[found.col.pdfUrl] : '')
    };
    writeResp_(sh, found, rowObj);
    audit_(id.sid, 'submit', sprint, exp, 'ok');
    // TODO(Sonnet): generar PDF en Drive (/BAIP/<cohorte>/<sid8>/) y notificar a facilitador@ por Gmail.
    return { acuseId: acuseId, receivedAt: now };
  } finally {
    lock.releaseLock();
  }
}

function handleGetFeedback_(params) {
  var id = resolveIdentity_(params);
  var sprint = sprint_(params);
  var sh = sheet_(SHEETS.FEEDBACK);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { items: [] };
  var head = values[0];
  var c = colIndex_(head, ['sid','sprint','experimento','texto','autor','creadoAt','enviado']);
  var items = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][c.sid]).trim() === id.sid && String(values[r][c.sprint]) === sprint && isTrue_(values[r][c.enviado])) {
      items.push({ experimento: values[r][c.experimento], texto: values[r][c.texto],
                   autor: values[r][c.autor], fecha: values[r][c.creadoAt] });
    }
  }
  return { items: items };
}

// TODO(Sonnet): handleSaveFeedback_ / handleListCohort_ — preferir script BOUND con identidad Google.
function handleSaveFeedback_(params) { throwApp_('SERVER', 'No implementado (Sonnet).'); }
function handleListCohort_(params)   { throwApp_('SERVER', 'No implementado (Sonnet).'); }

// ───────────────────────── Migración (#10) ─────────────────────────
/** Actualiza un registro de esquema anterior al actual (lazy, en lectura). */
function migrate_(record) {
  if (!record || typeof record !== 'object') return { fields: {} };
  var v = record.schemaVersion || 1;
  // Ejemplo de renombre futuro: if (v < 2) { record.fields = renameKeys_(record.fields, {'f-104-nivel':'f-104-ctx'}); v = 2; }
  record.schemaVersion = cfg_().schemaVersion;
  if (!record.fields) record.fields = {};
  return record;
}

// ───────────────────────── Acceso a Sheets ─────────────────────────
function sheet_(name) {
  var ss = SpreadsheetApp.openById(cfg_().ssId);
  var sh = ss.getSheetByName(name);
  if (!sh) throwApp_('SERVER', 'Falta la hoja: ' + name);
  return sh;
}
function colIndex_(head, names) {
  var map = {};
  names.forEach(function (n) {
    var i = head.indexOf(n);
    if (i < 0) throwApp_('SERVER', 'Falta columna "' + n + '".');
    map[n] = i;
  });
  return map;
}
function findAutosave_(sid, sprint) {
  var sh = sheet_(SHEETS.AUTOSAVE);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return null;
  var c = colIndex_(values[0], ['sid','sprint','schemaVersion','rev','updatedAt','dataJson']);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][c.sid]).trim() === sid && String(values[r][c.sprint]) === sprint) {
      return { _row: r + 1, _col: c, rev: parseInt(values[r][c.rev] || 0, 10),
               updatedAt: values[r][c.updatedAt], dataJson: values[r][c.dataJson] };
    }
  }
  return null;
}
function upsertAutosave_(sid, sprint, rev, updatedAt, dataJson, existing) {
  var sh = sheet_(SHEETS.AUTOSAVE);
  if (existing) {
    var c = existing._col;
    sh.getRange(existing._row, c.rev + 1).setValue(rev);
    sh.getRange(existing._row, c.updatedAt + 1).setValue(updatedAt);
    sh.getRange(existing._row, c.dataJson + 1).setValue(dataJson);
    sh.getRange(existing._row, c.schemaVersion + 1).setValue(cfg_().schemaVersion);
  } else {
    sh.appendRow([sid, sprint, cfg_().schemaVersion, rev, updatedAt, dataJson]);
  }
}
function findRespRow_(sh, sid, sprint, exp) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) { return null; }
  var head = values[0];
  var col = {}; head.forEach(function (h, i) { col[h] = i; });
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col.sid]).trim() === sid &&
        String(values[r][col.sprint]) === sprint &&
        String(values[r][col.experimento]) === exp) {
      return { _row: r + 1, row: values[r], col: col };
    }
  }
  return null;
}
function writeResp_(sh, found, o) {
  var order = ['sid','nombre','cohorte','sprint','experimento','identificacionJson','e1','e2','e3','e4','obs',
               'fieldsJson','estado','submitCount','firstSubmittedAt','lastSubmittedAt','acuseId','pdfUrl'];
  var rowArr = order.map(function (k) { return o[k]; });
  if (found) sh.getRange(found._row, 1, 1, rowArr.length).setValues([rowArr]);
  else sh.appendRow(rowArr);
}
function audit_(sid, action, sprint, exp, outcome) {
  try { sheet_(SHEETS.AUDIT).appendRow([new Date().toISOString(), sid, action, sprint, exp, outcome, '']); }
  catch (_) { /* auditoría best-effort; no romper la operación */ }
}

// ───────────────────────── Utilidades ─────────────────────────
function sprint_(params) {
  var s = String(params.sprint || '').trim();
  if (s !== '01' && s !== '02') throwApp_('BAD_REQUEST', 'sprint debe ser "01" o "02".');
  return s;
}
function isTrue_(v) { var s = String(v).trim().toLowerCase(); return s === 'true' || s === 'sí' || s === 'si' || s === '1' || s === 'x'; }
function firstKey_(obj, suffix) { for (var k in obj) { if (k.indexOf(suffix) === k.length - suffix.length) return k; } return null; }

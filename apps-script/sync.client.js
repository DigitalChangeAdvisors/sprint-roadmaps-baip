/**
 * BAIP Roadmaps — Cliente de sincronización (capa Opus)
 * Implementa el protocolo que CALZA EXACTO con Code.gs: identidad por sid,
 * carga+reconciliación, autosave debounced con guarda de rev + conflicto, submit+acuse.
 *
 * Integración (no invasiva): incluir <script src="sync.client.js"></script> al final del HTML
 * y fijar DCA_SYNC.WEBAPP_URL. Si NO hay ?sid en la URL, el módulo queda inerte y el roadmap
 * funciona como hoy (solo localStorage) — retrocompatible.
 *
 * Sprint del documento: fijar DCA_SYNC.SPRINT = '01' | '02'.
 */
var DCA_SYNC = (function () {
  'use strict';

  var WEBAPP_URL = '';        // ← fijar tras el deploy del Web App
  var SPRINT = '02';          // ← '01' | '02' según el archivo
  var DEBOUNCE_MS = 1200;

  var sid = null;
  var localRev = 0;
  var dirty = false;
  var saveTimer = null;
  var online = true;
  var listeners = { status: [], conflict: [] };

  // ── Identidad (frontera aislada; migrar a Google Sign-In = cambiar SOLO esto) ──
  function getIdentity() {
    var m = /[?&]sid=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ── Clave local namespaced por estudiante (#4: evita colisión en equipos compartidos) ──
  function localKey() {
    var base = 'dca_aria_sprint' + SPRINT + '_v1';
    return sid ? (base + '_' + sid) : base;
  }

  // ── Lectura/escritura del snapshot de campos desde el DOM existente ──
  function readFields() {
    var out = {};
    document.querySelectorAll('[data-save]').forEach(function (el) { out[el.dataset.save] = el.value; });
    document.querySelectorAll('[data-radio-save]').forEach(function (r) { if (r.checked) out[r.dataset.radioSave] = r.value; });
    return out;
  }
  function applyFields(fields) {
    if (!fields) return;
    document.querySelectorAll('[data-save]').forEach(function (el) {
      if (fields[el.dataset.save] !== undefined) {
        el.value = fields[el.dataset.save];
        if (el.tagName === 'TEXTAREA' && el.value) el.classList.add('filled');
      }
    });
    document.querySelectorAll('[data-radio-save]').forEach(function (r) {
      if (fields[r.dataset.radioSave] === r.value) r.checked = true;
    });
  }

  // ── Transporte: SIMPLE REQUESTS para evitar preflight CORS (ver SPEC) ──
  function get(action, extra) {
    var qs = '?action=' + encodeURIComponent(action) + '&sid=' + encodeURIComponent(sid) + '&sprint=' + SPRINT;
    for (var k in (extra || {})) qs += '&' + k + '=' + encodeURIComponent(extra[k]);
    return fetch(WEBAPP_URL + qs, { method: 'GET' }).then(function (r) { return r.json(); });
  }
  function post(payload) {
    return fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain = simple request
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function emit(type, arg) { (listeners[type] || []).forEach(function (f) { try { f(arg); } catch (_) {} }); }
  function on(type, fn) { if (listeners[type]) listeners[type].push(fn); }
  function status(s) { emit('status', s); } // 'saving' | 'saved' | 'offline' | 'conflict' | 'error'

  // ── Carga + reconciliación inicial ──
  function init(opts) {
    opts = opts || {};
    if (opts.webAppUrl) WEBAPP_URL = opts.webAppUrl;
    if (opts.sprint) SPRINT = opts.sprint;
    sid = getIdentity();
    if (!sid || !WEBAPP_URL) { return Promise.resolve({ mode: 'local-only' }); } // retrocompatible

    var localRaw = null;
    try { localRaw = JSON.parse(localStorage.getItem(localKey()) || 'null'); } catch (_) {}

    return get('load').then(function (res) {
      if (!res || !res.ok) { status('error'); return { mode: 'error' }; }
      var srvRev = res.data.rev || 0;
      var localCachedRev = (localRaw && localRaw.__rev) || 0;
      if (srvRev >= localCachedRev) {
        // Servidor manda: hidratar UI desde servidor.
        applyFields(res.data.fields || {});
        localRev = srvRev;
        persistLocal(res.data.fields || {});
      } else {
        // El cliente tenía cambios offline más nuevos → subir con baseRev del servidor.
        localRev = srvRev;
        dirty = true;
        scheduleSave(); // empuja lo local
      }
      bindInputs();
      return { mode: 'cloud', rev: localRev };
    }).catch(function () {
      online = false; status('offline'); bindInputs();
      return { mode: 'offline' };
    });
  }

  function persistLocal(fields) {
    var blob = {}; for (var k in fields) blob[k] = fields[k];
    blob.__rev = localRev;
    try { localStorage.setItem(localKey(), JSON.stringify(blob)); } catch (_) {}
  }

  // ── Autosave debounced a la nube ──
  function bindInputs() {
    var handler = function () { dirty = true; persistLocal(readFields()); scheduleSave(); };
    document.querySelectorAll('[data-save]').forEach(function (el) { el.addEventListener('input', handler); });
    document.querySelectorAll('[data-radio-save]').forEach(function (r) { r.addEventListener('change', handler); });
  }
  function scheduleSave() {
    if (!sid || !WEBAPP_URL) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, DEBOUNCE_MS);
  }
  function flush() {
    if (!dirty || !sid) return;
    status('saving');
    var fields = readFields();
    post({ action: 'autosave', sid: sid, sprint: SPRINT, baseRev: localRev, fields: fields })
      .then(function (res) {
        if (res && res.ok) {
          localRev = res.data.rev; dirty = false; online = true;
          persistLocal(fields); status('saved');
        } else if (res && res.error && res.error.code === 'CONFLICT') {
          // Otro dispositivo escribió: NO perder datos en silencio. Delegar resolución.
          status('conflict');
          emit('conflict', {
            server: res.data,
            acceptServer: function () { applyFields(res.data.fields || {}); localRev = res.data.rev; dirty = false; persistLocal(res.data.fields || {}); status('saved'); },
            overwrite: function () { localRev = res.data.rev; dirty = true; scheduleSave(); }
          });
        } else { status('error'); }
      })
      .catch(function () { online = false; status('offline'); /* dirty se conserva; reintenta al próximo cambio */ });
  }

  // ── Submit → acuse real (#2). Devuelve Promise<{acuseId, receivedAt}>. ──
  function submit(experimento, identificacion, obs) {
    if (!sid || !WEBAPP_URL) return Promise.reject(new Error('local-only')); // el HTML cae al mailto de respaldo
    var fields = readFields();
    return post({ action: 'submit', sid: sid, sprint: SPRINT, experimento: experimento,
                  identificacion: identificacion || {}, obs: obs || '', fields: fields })
      .then(function (res) {
        if (res && res.ok) return res.data;       // { acuseId, receivedAt }
        throw new Error((res && res.error && res.error.message) || 'submit falló');
      });
  }

  // ── Feedback in-app (#7): traer y entregar al HTML para render ──
  function fetchFeedback() {
    if (!sid || !WEBAPP_URL) return Promise.resolve({ items: [] });
    return get('getFeedback').then(function (res) { return (res && res.ok) ? res.data : { items: [] }; });
  }

  return {
    init: init, submit: submit, fetchFeedback: fetchFeedback, on: on,
    get sid() { return sid; }, get rev() { return localRev; },
    set WEBAPP_URL(v) { WEBAPP_URL = v; }, set SPRINT(v) { SPRINT = v; }
  };
})();

/* ───────────────────────── Integración en el HTML (TODO Sonnet) ─────────────────────────
 * 1) <script src="sync.client.js"></script> antes de </body>.
 * 2) DCA_SYNC.init({ webAppUrl: 'WEBAPP_URL', sprint: '02' }).then(...).
 *    - Si mode==='local-only', dejar el flujo actual (localStorage + mailto) intacto.
 * 3) En el modal de envío: llamar DCA_SYNC.submit(exp, identificacion, obs)
 *    - en éxito → mostrar acuseId real y SOLO entonces markSent(exp).
 *    - en fallo/local-only → caer al mailto de respaldo (comportamiento actual).
 * 4) DCA_SYNC.on('status', fn) → pintar el punto de guardado ('saving'/'saved'/'offline'/'conflict').
 * 5) DCA_SYNC.on('conflict', ({acceptServer, overwrite}) => mostrar diálogo de resolución).
 * 6) DCA_SYNC.fetchFeedback() al cargar → render del feedback del facilitador dentro del roadmap.
 * NOTA: cuando DCA_SYNC está activo, debe ser la ÚNICA capa que escribe localStorage para evitar
 *       doble manejo; conviene que el init existente del HTML detecte sid y delegue en DCA_SYNC.
 * ──────────────────────────────────────────────────────────────────────────────────────── */

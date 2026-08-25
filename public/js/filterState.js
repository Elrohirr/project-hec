/**
 * Persistência de filtros por página usando sessionStorage.
 *
 * Diferente do localStorage, o sessionStorage é descartado quando a aba/
 * navegador é fechado. Injete este script em toda página que tenha filtros.
 *
 * Chave por página: 'hourflow_filters_' + pageKey
 *   saveFilterState(pageKey, obj)  -> grava/atualiza
 *   getFilterState(pageKey)        -> retorna o objeto salvo (ou null)
 *   clearFilterState(pageKey)      -> remove a chave de uma página
 *   clearAllFilterStates()         -> remove as chaves de todas as páginas
 *   restoreFilterState(pageKey, map) -> repopula os campos a partir do
 *     objeto salvo. map = { campoId: prop }, onde prop é a chave em
 *     que o valor foi guardado (o mesmo usado em saveFilterState).
 */
var FILTER_STATE_PREFIX = 'hourflow_filters_';

function storageKey(pageKey) {
  return FILTER_STATE_PREFIX + pageKey;
}

function saveFilterState(pageKey, filters) {
  try {
    sessionStorage.setItem(storageKey(pageKey), JSON.stringify(filters || {}));
  } catch (err) { /* sessão cheia/inválida não deve quebrar a página */ }
}

function getFilterState(pageKey) {
  try {
    var raw = sessionStorage.getItem(storageKey(pageKey));
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

function clearFilterState(pageKey) {
  sessionStorage.removeItem(storageKey(pageKey));
}

function clearAllFilterStates() {
  var i, key, toRemove = [];
  for (i = 0; i < sessionStorage.length; i++) {
    key = sessionStorage.key(i);
    if (key && key.indexOf(FILTER_STATE_PREFIX) === 0) { toRemove.push(key); }
  }
  toRemove.forEach(function (k) { sessionStorage.removeItem(k); });
}

function restoreFilterState(pageKey, fields) {
  var state = getFilterState(pageKey);
  if (!state) return false;
  Object.keys(fields || {}).forEach(function (inputId) {
    var el = document.getElementById(inputId);
    var prop = fields[inputId];
    if (el && Object.prototype.hasOwnProperty.call(state, prop)) {
      el.value = state[prop];
    }
  });
  return true;
}
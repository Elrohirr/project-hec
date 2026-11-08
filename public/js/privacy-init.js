/**
 * Aplica o estado de privacidade antes do primeiro paint, para evitar o
 * flash de UI exposta antes de qualquer decisao de privacidade.
 * Executa no <head> (blocking), depois de theme-init.js.
 */
(function () {
  try {
    if (localStorage.getItem('hourflow_privacy') === 'true') {
      document.documentElement.setAttribute('data-privacy', 'true');
    }
  } catch (e) {}
})();
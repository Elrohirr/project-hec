/**
 * Aplica o tema salvo antes do primeiro paint, para evitar o "flash"
 * de tema claro seguido de escuro. Executa no <head> (blocking), antes
 * do CSS, em todas as páginas — evita duplicar este blocco inline.
 */
(function () {
  try {
    if (localStorage.getItem('hourflow_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
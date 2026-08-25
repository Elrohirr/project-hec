(function () {
  'use strict';

  var STORAGE_KEY = 'hourflow_theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // localStorage indisponivel (modo privado, etc.) - o tema ainda
      // funciona nesta sessao, so nao persiste entre recarregamentos.
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncToggleState(button, knob) {
    var isDark = currentTheme() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    knob.textContent = isDark ? '\uD83C\uDF19' : '\u2600';
  }

  function buildToggle() {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Alternar modo escuro');

    var knob = document.createElement('span');
    knob.className = 'theme-toggle-knob';
    button.appendChild(knob);

    syncToggleState(button, knob);

    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      setStoredTheme(next);
      syncToggleState(button, knob);
    });

    return button;
  }

  function init() {
    // Redundante com o script inline do <head> (que evita o "flash" de
    // tema errado), mas garante consistencia caso este arquivo rode antes.
    var stored = getStoredTheme();
    if (stored === 'dark' || stored === 'light') {
      applyTheme(stored);
    }

    var userArea = document.querySelector('.app-header .user-area');
    if (!userArea || userArea.querySelector('.theme-toggle')) {
      return;
    }

    var logoutButton = document.getElementById('logout-button');
    var toggle = buildToggle();

    if (logoutButton) {
      userArea.insertBefore(toggle, logoutButton);
    } else {
      userArea.appendChild(toggle);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

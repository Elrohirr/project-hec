/**
 * Controlador de privacidade exposto globalmente como window.Privacy.
 * Persiste a preferencia no localStorage e notifica mudancas via
 * CustomEvent 'hourflow:privacy-changed'.
 *
 * Uso:
 *   Privacy.isEnabled()    // retorna true/false
 *   Privacy.setEnabled(b)  // ativa (true) ou desativa (false)
 *   Privacy.toggle()       // inverte o estado atual
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hourflow_privacy';
  var EVENT_NAME = 'hourflow:privacy-changed';

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw === 'true';
    } catch (e) {
      return false;
    }
  }

  function writeStored(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch (e) {
      // localStorage indisponivel (modo privado, etc.) - o estado sera
      // aplicado apenas nesta sessao, sem persistencia.
    }
  }

  function applyState(enabled) {
    var root = document.documentElement;
    if (enabled) {
      root.setAttribute('data-privacy', 'true');
    } else {
      root.removeAttribute('data-privacy');
    }
  }

  function setEnabled(enabled) {
    var value = !!enabled;
    writeStored(value);
    applyState(value);
    var event = new CustomEvent(EVENT_NAME, { detail: { enabled: value } });
    window.dispatchEvent(event);
    return value;
  }

  function toggle() {
    setEnabled(!readStored());
  }

  window.Privacy = {
    isEnabled: readStored,
    setEnabled: setEnabled,
    toggle: toggle
  };

  // Injecao do botao de privacidade no .user-area
  (function injectPrivacyToggle() {
    var userArea = document.querySelector('.app-header .user-area');
    if (!userArea) return;

    var existing = userArea.querySelector('.privacy-toggle');
    if (existing) return;

    var logoutButton = document.getElementById('logout-button');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost-button privacy-toggle';
    button.setAttribute('aria-pressed', 'false');

    var SVG_EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var SVG_EYE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

button.innerHTML = SVG_EYE;

    function updateIcon() {
      var enabled = Privacy.isEnabled();
      button.setAttribute('aria-pressed', String(enabled));
      button.innerHTML = enabled ? SVG_EYE_OFF : SVG_EYE;
      button.setAttribute('aria-label', enabled ? 'Ocultar valores' : 'Mostrar valores');
      button.title = enabled ? 'Ocultar valores' : 'Mostrar valores';
    }

    button.addEventListener('click', function () {
      Privacy.toggle();
      updateIcon();
    });

    window.addEventListener('hourflow:privacy-changed', function (e) {
      if (e && e.detail && typeof e.detail.enabled === 'boolean') {
        updateIcon();
      }
    });

    updateIcon();

    if (logoutButton) {
      userArea.insertBefore(button, logoutButton);
    } else {
      userArea.appendChild(button);
    }
  })();

  // Aplica o estado salvo na inicializacao (sem disparar evento).
  applyState(readStored());
})();
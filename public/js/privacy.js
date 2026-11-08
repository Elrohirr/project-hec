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

  // Aplica o estado salvo na inicializacao (sem disparar evento).
  applyState(readStored());
})();
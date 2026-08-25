/**
 * Componente de modal reutilizável (overlay + caixa centralizada).
 *
 * Uso:
 *   var m = createModal({ title, body (HTML), onClose });
 *   m.open();  m.close();
 *
 * Fechamento: botão ×, clique fora da caixa e tecla Esc.
 * O ody recebe HTML (string); para conteúdo seguro, use
 * elementos criados via DOM antes de passar .innerHTML.
 */
function createModal(options) {
  var opts = options || {};
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');

  var dialog = document.createElement('div');
  dialog.className = 'modal';

  var head = document.createElement('div');
  head.className = 'modal-head';

  var title = document.createElement('h3');
  title.className = 'modal-title';
  title.textContent = opts.title || '';

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Fechar');

  head.appendChild(title);
  head.appendChild(closeBtn);

  var body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = opts.body || '';

  dialog.appendChild(head);
  dialog.appendChild(body);
  overlay.appendChild(dialog);

  var opened = false;

  function open() {
    if (opened) return;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    opened = true;
    overlay.setAttribute('aria-hidden', 'false');
    dialog.focus();
  }

  function close() {
    if (!opened) return;
    document.body.removeChild(overlay);
    document.body.classList.remove('modal-open');
    opened = false;
    if (typeof opts.onClose === 'function') opts.onClose();
  }

  closeBtn.addEventListener('click', close);

  // Fechar ao clicar fora (no overlay, fora da caixa)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  // Fechar com a tecla Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  return { open: open, close: close, el: overlay };
}
/**
 * Selecao multipla e acao em lote (Horas Extras e Turno Noturno).
 *
 * O modulo e agnostico: quem chama informa os rotulos e os callbacks.
 * Ele cuida de:
 *   - marcar/desmarcar linhas (checkbox por linha + "selecionar todos");
 *   - bloquear linhas que nao podem ser selecionadas (com motivo no title);
 *   - exibir a barra de acao em lote com a contagem de selecionados;
 *   - pedir confirmacao em modal antes de excluir.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Selection = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var Selection = {};

  // Limite de registros por requisicao de exclusao em lote.
  // O backend (utils/helper.js -> validadeIdArray) rejeita arrays com 50 ou
  // mais ids, entao o front seleciona no maximo 49.
  Selection.MAX_TOTAL = 49;

  function createState() {
    return {
      selectedIds: [],
      selectedSet: {},
      rowCheckboxes: {},
      rowCheckboxesList: [],
      allCheckbox: null,
      table: null,
      disabledReasons: {},
      isAllDisabled: false,
      // true quando o modo de exclusão em massa está ativo (coluna de
      // checkboxes visível). Fora desse modo a coluna fica oculta por CSS.
      selectionEnabled: false,
      onSelectionChange: null,
      onBatchDelete: null,
      onLimitReached: null
    };
  }

  function removeFromSelection(state, id) {
    if (state.selectedSet[id]) {
      var idx = state.selectedIds.indexOf(id);
      if (idx !== -1) state.selectedIds.splice(idx, 1);
      delete state.selectedSet[id];
    }
  }

  function addToSelection(state, id) {
    if (state.selectedSet[id]) return true;
    if (state.selectedIds.length >= Selection.MAX_TOTAL) {
      if (state.onLimitReached) state.onLimitReached(Selection.MAX_TOTAL);
      return false;
    }
    state.selectedIds.push(id);
    state.selectedSet[id] = true;
    return true;
  }

  function registerRow(state, id, checkbox) {
    state.rowCheckboxes[id] = checkbox;
    if (state.rowCheckboxesList.indexOf(id) === -1) state.rowCheckboxesList.push(id);
    checkbox.addEventListener('change', function () {
      if (checkbox.checked) {
        if (!addToSelection(state, id)) {
          // Limite atingido: desfaz a marcação.
          checkbox.checked = false;
          return;
        }
      } else {
        removeFromSelection(state, id);
      }
      Selection.refreshSelectAll(state);
      Selection.updateToolbar(state);
    });
  }

  function unregisterRow(state, id) {
    delete state.rowCheckboxes[id];
    var idx = state.rowCheckboxesList.indexOf(id);
    if (idx !== -1) state.rowCheckboxesList.splice(idx, 1);
    removeFromSelection(state, id);
    Selection.refreshSelectAll(state);
    Selection.updateToolbar(state);
  }

  function setAllCheckbox(state, el, disabled) {
    state.allCheckbox = el;
    el.disabled = !!disabled;
    el.addEventListener('change', function () {
      if (!el.checked) {
        for (var i = 0; i < state.rowCheckboxesList.length; i++) {
          var id = state.rowCheckboxesList[i];
          if (!state.disabledReasons[id]) {
            var cb = state.rowCheckboxes[id];
            if (cb) cb.checked = false;
            removeFromSelection(state, id);
          }
        }
      } else {
        for (var k = 0; k < state.rowCheckboxesList.length; k++) {
          var rid = state.rowCheckboxesList[k];
          if (!state.disabledReasons[rid]) {
            var cb2 = state.rowCheckboxes[rid];
            if (!addToSelection(state, rid)) {
              // Limite de seleção atingido: desmarca os que ficaram de fora.
              if (cb2) cb2.checked = false;
              continue;
            }
            if (cb2 && !cb2.checked) cb2.checked = true;
          }
        }
      }
      Selection.refreshSelectAll(state);
      Selection.updateToolbar(state);
    });
    state.isAllDisabled = !!disabled;
    Selection.refreshSelectAll(state);
  }

  function setDisabledReasons(state, reasons) {
    state.disabledReasons = reasons || {};
    Selection.refreshRowCheckboxes(state);
  }

  function setAllCheckboxDisabled(state, disabled) {
    state.isAllDisabled = !!disabled;
    if (state.allCheckbox) state.allCheckbox.disabled = !!disabled;
    Selection.refreshSelectAll(state);
  }

  function refreshSelectAll(state) {
    var el = state.allCheckbox;
    if (!el) return;
    var total = state.rowCheckboxesList.length;
    var disabled = state.isAllDisabled || total === 0;
    el.disabled = disabled;
    if (disabled) {
      el.checked = false;
      el.indeterminate = false;
      return;
    }
    var selected = 0;
    for (var i = 0; i < state.rowCheckboxesList.length; i++) {
      var id = state.rowCheckboxesList[i];
      if (state.selectedSet[id]) selected++;
    }
    if (selected === 0) {
      el.checked = false;
      el.indeterminate = false;
    } else if (selected === total) {
      el.checked = true;
      el.indeterminate = false;
    } else {
      el.checked = false;
      el.indeterminate = true;
    }
  }

  function refreshRowCheckboxes(state) {
    for (var i = 0; i < state.rowCheckboxesList.length; i++) {
      var id = state.rowCheckboxesList[i];
      var cb = state.rowCheckboxes[id];
      if (!cb) continue;
      var disabled = !!state.disabledReasons[id];
      cb.disabled = disabled;
      cb.title = disabled ? state.disabledReasons[id] : '';
      cb.indeterminate = false;
    }
  }

  /**
   * Limpa a seleção e descarta os registros de checkbox já renderizados.
   * Usado quando a tabela é redesenhada (troca de página/filtro).
   */
  function resetRows(state) {
    Selection.clearSelection(state);
    state.rowCheckboxesList.length = 0;
    state.rowCheckboxes = {};
    Selection.refreshSelectAll(state);
  }

  /**
   * Liga/desliga o modo de exclusão em massa.
   *
   * Quando ligado, a coluna de checkboxes da tabela fica visível (a classe
   * `selection-active` é aplicada no elemento <table>). Quando desligado, a
   * coluna some, a seleção é limpa e a barra de ação em lote é ocultada.
   *
   * opts:
   *   table - elemento <table> que recebe a classe `selection-active`
   */
  function setTableSelectionMode(state, enabled, opts) {
    var options = opts || {};
    var table = options.table || state.table;
    var active = !!enabled;

    state.selectionEnabled = active;

    if (table && table.classList) {
      table.classList.toggle('selection-active', active);
    }

    // Em ambos os sentidos a seleção é zerada: nada fica marcado por
    // engano e a barra de ação em lote some ao sair do modo.
    clearSelection(state);
    if (state.allCheckbox) {
      state.allCheckbox.checked = false;
      state.allCheckbox.indeterminate = false;
    }

    Selection.refreshSelectAll(state);
    Selection.updateToolbar(state);
  }

  function clearSelection(state) {
    for (var i = 0; i < state.rowCheckboxesList.length; i++) {
      var id = state.rowCheckboxesList[i];
      var cb = state.rowCheckboxes[id];
      if (cb) cb.checked = false;
      removeFromSelection(state, id);
    }
    Selection.refreshSelectAll(state);
    Selection.updateToolbar(state);
  }

  function getSelectedIds(state) {
    return state.selectedIds.slice();
  }

  function getSelectedCount(state) {
    return state.selectedIds.length;
  }

  function updateToolbar(state) {
    if (state.onSelectionChange) state.onSelectionChange(getSelectedCount(state));
  }

  /**
   * Monta a barra de acao em lote dentro de `parent`.
   *
   * opts:
   *   countLabel   - texto apos o numero ("selecionados")
   *   deleteLabel  - texto do botao de excluir
   *   clearLabel   - texto do botao de limpar
   *   idPrefix     - prefixo dos ids dos botoes (evita colisao entre telas)
   */
  function buildBatchToolbar(state, parent, opts) {
    var options = opts || {};
    var toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar';
    toolbar.hidden = true;

    var countLabel = options.countLabel || 'selecionados';
    var deleteLabel = options.deleteLabel || 'Apagar selecionados';
    var clearLabel = options.clearLabel || 'Limpar selecao';
    var idPrefix = options.idPrefix || '';

    toolbar.innerHTML = ''
      + '<div class="selection-count-wrap">'
      + '<span class="selection-count" id="' + idPrefix + 'selection-count">0 ' + countLabel + '</span>'
      + '</div>'
      + '<div class="selection-actions">'
      + '<button type="button" class="button-danger" id="' + idPrefix + 'batch-delete" disabled>'
      + deleteLabel + '</button>'
      + '<button type="button" class="button-ghost" id="' + idPrefix + 'clear-selection">'
      + clearLabel + '</button>'
      + '</div>';

    parent.appendChild(toolbar);

    var countEl = document.getElementById(idPrefix + 'selection-count');
    var deleteBtn = document.getElementById(idPrefix + 'batch-delete');
    var clearBtn = document.getElementById(idPrefix + 'clear-selection');

    clearBtn.addEventListener('click', function () {
      Selection.clearSelection(state);
    });

    deleteBtn.addEventListener('click', function () {
      if (state.onBatchDelete) state.onBatchDelete();
    });

    state.onSelectionChange = function (count) {
      toolbar.hidden = count === 0;
      if (countEl) countEl.textContent = count + ' ' + countLabel;
      deleteBtn.disabled = count === 0;
    };

    return {
      toolbar: toolbar,
      countEl: countEl,
      deleteBtn: deleteBtn,
      clearBtn: clearBtn
    };
  }

  /**
   * Cria o corpo do modal de confirmacao da exclusao em lote.
   */
  function buildBatchConfirmBody(count, opts) {
    var options = opts || {};
    var warning = options.warning || 'Esta acao nao pode ser desfeita.';
    var submitLabel = options.submitLabel || 'Excluir';
    var cancelLabel = options.cancelLabel || 'Cancelar';
    var confirmAria = options.confirmAria || 'Confirmar exclusao em lote';
    var cancelAria = options.cancelAria || 'Cancelar exclusao em lote';

    return '<p class="batch-confirm-text">Deseja realmente excluir <strong>' + count + '</strong> registro'
      + (count === 1 ? '' : 's') + '?</p>'
      + '<p class="batch-warning-text">' + warning + '</p>'
      + '<div class="batch-actions">'
      + '<button type="button" class="primary-button" data-batch-submit aria-label="' + confirmAria + '">'
      + submitLabel + '</button>'
      + '<button type="button" class="ghost-button-light" data-batch-cancel aria-label="' + cancelAria + '">'
      + cancelLabel + '</button>'
      + '</div>';
  }

  /**
   * Abre o modal de confirmacao e, ao confirmar, chama onConfirm(ids).
   * onResult(result, state, recordsCache) recebe a resposta do backend.
   * onNetworkError(err) e chamado quando a requisicao falha.
   */
  function confirmAndDeleteBatch(state, recordsCache, opts) {
    var options = opts || {};
    var title = options.title || 'Excluir registros';
    var onConfirm = options.onConfirm;
    var onResult = options.onResult;
    var onNetworkError = options.onNetworkError;

    var modal = createModal({
      title: title,
      body: buildBatchConfirmBody(state.selectedIds.length, options),
      onClose: function () {}
    });
    modal.open();

    var submitBtn = modal.el.querySelector('[data-batch-submit]');
    var cancelBtn = modal.el.querySelector('[data-batch-cancel]');
    var spinner = document.createElement('span');
    spinner.className = 'batch-delete-spinner';
    spinner.hidden = true;
    submitBtn.appendChild(spinner);

    function finish() {
      submitBtn.disabled = false;
      spinner.hidden = true;
      modal.close();
    }

    cancelBtn.addEventListener('click', function () {
      finish();
    });

    submitBtn.addEventListener('click', function () {
      submitBtn.disabled = true;
      spinner.hidden = false;
      var ids = getSelectedIds(state);
      onConfirm(ids)
        .then(function (result) {
          onResult(result, state, recordsCache);
          finish();
        })
        .catch(function (err) {
          finish();
          // 401 ja foi tratado pelo Api (logout automatico).
          if (err && err.status === 401) return;
          if (onNetworkError) onNetworkError(err);
        });
    });

    return modal;
  }

  Selection.createState = createState;
  Selection.buildBatchToolbar = buildBatchToolbar;
  Selection.buildBatchConfirmBody = buildBatchConfirmBody;
  Selection.confirmAndDeleteBatch = confirmAndDeleteBatch;
  Selection.registerRow = registerRow;
  Selection.unregisterRow = unregisterRow;
  Selection.setTableSelectionMode = setTableSelectionMode;
  Selection.setAllCheckbox = setAllCheckbox;
  Selection.setAllCheckboxDisabled = setAllCheckboxDisabled;
  Selection.setDisabledReasons = setDisabledReasons;
  Selection.refreshSelectAll = refreshSelectAll;
  Selection.refreshRowCheckboxes = refreshRowCheckboxes;
  Selection.clearSelection = clearSelection;
  Selection.resetRows = resetRows;
  Selection.getSelectedIds = getSelectedIds;
  Selection.getSelectedCount = getSelectedCount;
  Selection.updateToolbar = updateToolbar;

  return Selection;
});

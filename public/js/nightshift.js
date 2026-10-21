document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('nightshift-form');
  const formTitle = document.getElementById('form-title');
  const totalNightHoursInput = document.getElementById('total-night-hours');
  const dateInput = document.getElementById('date');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  const formErrorBox = document.getElementById('form-error-box');
  const formSuccessBox = document.getElementById('form-success-box');

  const tableBody = document.getElementById('nightshift-table-body');
  const emptyState = document.getElementById('empty-state');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPageButton = document.getElementById('prev-page-button');
  const nextPageButton = document.getElementById('next-page-button');
  const pageLimitSelect = document.getElementById('page-limit');

  const FILTER_PAGE_KEY = 'nightshift';

  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterPayMonthStart = document.getElementById('filter-pay-month-start');
  const filterPayMonthEnd = document.getElementById('filter-pay-month-end');
  const filterSort = document.getElementById('filter-sort');
  const applyFiltersButton = document.getElementById('apply-filters-button');
  const clearFiltersButton = document.getElementById('clear-filters-button');

  const summaryTotalClock = document.getElementById('summary-total-clock');
  const summaryTotalReduced = document.getElementById('summary-total-reduced');
  const summaryTotalNightValue = document.getElementById('summary-total-night-value');
  const summaryTotal = document.getElementById('summary-total');

  const infoReducedButton = document.getElementById('info-reduced');
  const infoPopup = document.getElementById('info-popup');
  const infoPopupClose = document.getElementById('info-popup-close');

  let editingId = null; // null = criando novo registro; string = editando esse _id
  let recordsCache = []; // registros carregados, usados para preencher o form ao editar
  let currentPage = 1;
  let pageLimit = 10;
  let totalPages = 1;

  // Seleção múltipla / ação em lote
  const selectionState = Selection.createState();
  const selectionToolbarContainer = document.getElementById('selection-toolbar');
  const selectAllCheckbox = document.getElementById('select-all-nightshifts');
  const toggleBatchSelectButton = document.getElementById('toggle-batch-select-button');
  const nightshiftTable = document.getElementById('nightshift-table');
  selectionState.table = nightshiftTable;

  // Liga/desliga o modo de exclusão em massa (mostra a coluna de checkboxes).
  function setBatchMode(enabled) {
    Selection.setTableSelectionMode(selectionState, enabled, { table: nightshiftTable });
    if (!toggleBatchSelectButton) return;
    toggleBatchSelectButton.classList.toggle('active', enabled);
    toggleBatchSelectButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggleBatchSelectButton.textContent = enabled ? 'Cancelar' : 'Excluir em massa';
  }

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function formatPayDate(isoString) {
    if (!isoString) return '—';
    return payDateFormatter.format(new Date(isoString));
  }

  // Formato esperado pelo <input type="date">: YYYY-MM-DD
  function toDateInputValue(isoString) {
    return new Date(isoString).toISOString().slice(0, 10);
  }

  function hhmmToMinutes(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function updateSummary(totals) {
    summaryTotalClock.textContent = minutesToHHMM(totals?.nightMinutesClock || 0);
    summaryTotalReduced.textContent = minutesToHHMM(totals?.nightMinutesReduced || 0);
    summaryTotalNightValue.textContent = currencyFormatter.format(totals?.nightShiftValue || 0);
    summaryTotal.textContent = currencyFormatter.format(totals?.nightShiftValue || 0);
  }

  function renderRow(record) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td class="select-column">
        <input type="checkbox" class="table-row-select" data-id="${record._id}"
          aria-label="Selecionar registro de ${formatDate(record.date)}">
      </td>
      <td>${formatDate(record.date)}</td>
      <td class="numeric">${record.nightHoursClock ?? '07:00'}</td>
      <td class="numeric">${record.nightHoursReduced ?? '08:00'}</td>
      <td class="numeric">${currencyFormatter.format(record.nightShiftValue ?? 0)}</td>
      <td class="numeric">${currencyFormatter.format(record.wageAtCalculation ?? 0)}</td>
      <td>${formatPayDate(record.payDate)}</td>
      <td class="actions-cell">
        <div class="actions-menu">
          <button type="button" class="icon-button actions-toggle" data-id="${record._id}">⋮</button>
          <div class="actions-dropdown" hidden>
            <button type="button" class="dropdown-item edit" data-id="${record._id}">Editar</button>
            <button type="button" class="dropdown-item delete" data-id="${record._id}">Excluir</button>
          </div>
        </div>
      </td>
    `;

    const actionsMenu = tr.querySelector('.actions-menu');
    const dropdown = tr.querySelector('.actions-dropdown');
    const rowCheckbox = tr.querySelector('.table-row-select');
    if (rowCheckbox) {
      Selection.registerRow(selectionState, record._id, rowCheckbox);
    }
    tr.querySelector('.actions-toggle').addEventListener('click', (event) => {
      event.stopPropagation();
      toggleActionsMenu(actionsMenu, dropdown);
    });
    tr.querySelector('.dropdown-item.edit').addEventListener('click', (event) => {
      event.stopPropagation();
      dropdown.hidden = true;
      handleEditClick(record._id);
    });
    tr.querySelector('.dropdown-item.delete').addEventListener('click', (event) => {
      event.stopPropagation();
      dropdown.hidden = true;
      handleDelete(record._id);
    });
    return tr;
  }

  // ---- Menu de ações (⋮): abre/fecha o dropdown de cada linha ----------
  function closeAllDropdowns(keepMenu = null) {
    document.querySelectorAll('.actions-dropdown').forEach((d) => {
      if (d.closest('.actions-menu') !== keepMenu) d.hidden = true;
    });
  }

  function toggleActionsMenu(menu, dropdown) {
    if (!dropdown.hidden) {
      dropdown.hidden = true;
      return;
    }
    closeAllDropdowns(menu);
    dropdown.hidden = false;
  }

  // Clicar fora de qualquer menu fecha todos os dropdowns abertos.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.actions-menu')) closeAllDropdowns();
  });

  function renderTable(records) {
    tableBody.innerHTML = '';
    // A página mudou: a seleção da página anterior não é mais válida.
    Selection.resetRows(selectionState);
    if (!records.length) {
      emptyState.hidden = false;
      Selection.setAllCheckboxDisabled(selectionState, true);
      return;
    }
    emptyState.hidden = true;
    Selection.setAllCheckboxDisabled(selectionState, false);
    records.forEach((record) => tableBody.appendChild(renderRow(record)));
    Selection.refreshSelectAll(selectionState);
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este registro de turno noturno?')) return;
    try {
      await Api.deleteNightShift(id);
      // se o registro excluído era o que estava sendo editado, sai do modo edição
      if (editingId === id) exitEditMode();
      await loadNightShifts(currentPage);
    } catch (err) {
      alert(err.message || 'Não foi possível excluir o registro.');
    }
  }

  /**
   * Exclusão em lote dos registros selecionados.
   */
  async function handleBatchDelete() {
    const ids = Selection.getSelectedIds(selectionState);
    if (!ids.length) return;

    Selection.confirmAndDeleteBatch(selectionState, recordsCache, {
      title: 'Excluir turnos noturnos',
      warning: 'Esta ação não pode ser desfeita.',
      submitLabel: 'Excluir',
      onConfirm: (batchIds) => Api.multiDeleteNightShifts(batchIds),
      onResult: async (result) => {
        const deleted = result?.deleted?.length ?? 0;
        const rejected = result?.rejected?.length ?? 0;
        await loadNightShifts(currentPage);
        // Sai do modo de exclusão em massa: as checkboxes somem.
        setBatchMode(false);
        if (rejected > 0) {
          alert(`${deleted} registro(s) excluído(s). ${rejected} registro(s) não puderam ser excluídos.`);
        }
      },
      onNetworkError: (err) => {
        alert(err?.message || 'Não foi possível excluir os registros selecionados.');
      }
    });
  }

  async function handleEditClick(id) {
    hideFormMessages();
    const record = recordsCache.find((r) => r._id === id);
    if (!record) {
      showFormError('Não foi possível carregar o registro para edição.');
      return;
    }
    enterEditMode(record);
  }

  function enterEditMode(record) {
    editingId = record._id;
    totalNightHoursInput.value = record.nightHoursClock ?? '07:00';
    dateInput.value = toDateInputValue(record.date);

    formTitle.textContent = 'Editar turno noturno';
    submitButton.textContent = 'Salvar alterações';
    cancelEditButton.hidden = false;

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitEditMode() {
    editingId = null;
    form.reset();
    formTitle.textContent = 'Registrar turno noturno';
    submitButton.textContent = 'Registrar';
    cancelEditButton.hidden = true;
  }

  cancelEditButton.addEventListener('click', exitEditMode);

  function getActiveFilters() {
    const filters = {};
    if (filterStartDate.value) filters.startDate = filterStartDate.value;
    if (filterEndDate.value) filters.endDate = filterEndDate.value;
    if (filterPayMonthStart.value) filters.startPayDate = monthStartDate(filterPayMonthStart.value);
    if (filterPayMonthEnd.value) filters.endPayDate = monthEndDate(filterPayMonthEnd.value);
    if (filterSort.value) filters.sort = filterSort.value;
    return filters;
  }

  function saveCurrentFilterState() {
    return saveFilterState(FILTER_PAGE_KEY, {
      startDate: filterStartDate.value,
      endDate: filterEndDate.value,
      startPayDate: filterPayMonthStart.value,
      endPayDate: filterPayMonthEnd.value,
      sort: filterSort.value,
      limit: pageLimitSelect.value
    });
  }

  async function loadNightShifts(page = 1) {
    try {
      const data = await Api.getNightShifts({ page, limit: pageLimit, ...getActiveFilters() });
      const records = data.nightShift || [];

      currentPage = data.currentPage || page;
      totalPages = data.numberOfPages || 1;

      recordsCache = records;
      renderTable(records);
      updateSummary(data.totals);

      pageIndicator.textContent = `Página ${currentPage} de ${totalPages} · ${data.totalRecords} registro(s)`;
      prevPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;
    } catch (err) {
      emptyState.hidden = false;
      emptyState.textContent = err.message || 'Não foi possível carregar os registros.';
    }
  }

  applyFiltersButton.addEventListener('click', () => {
    saveCurrentFilterState()
    loadNightShifts(1);
  });

  clearFiltersButton.addEventListener('click', () => {
    clearFilterState(FILTER_PAGE_KEY);
    filterStartDate.value = '';
    filterEndDate.value = '';
    filterPayMonthStart.value = '';
    filterPayMonthEnd.value = '';
    filterSort.value = '-date';
    loadNightShifts(1);
  });

  prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) loadNightShifts(currentPage - 1);
  });

  nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) loadNightShifts(currentPage + 1);
  });

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading
      ? (editingId ? 'Salvando…' : 'Registrando…')
      : (editingId ? 'Salvar alterações' : 'Registrar');
  }

  function showFormError(message) {
    formSuccessBox.hidden = true;
    formErrorBox.textContent = message;
    formErrorBox.hidden = false;
  }

  function showFormSuccess(message) {
    formErrorBox.hidden = true;
    formSuccessBox.textContent = message;
    formSuccessBox.hidden = false;
  }

  function hideFormMessages() {
    formErrorBox.hidden = true;
    formSuccessBox.hidden = true;
  }

  // Popup explicativo: hora noturna reduzida (art. 73, §1º CLT)
  function openInfoPopup() {
    infoPopup.hidden = false;
  }

  function closeInfoPopup() {
    infoPopup.hidden = true;
  }

  infoReducedButton.addEventListener('click', openInfoPopup);
  infoPopupClose.addEventListener('click', closeInfoPopup);

  document.addEventListener('click', (event) => {
    if (!infoPopup.hidden && !infoPopup.contains(event.target) && event.target !== infoReducedButton) {
      closeInfoPopup();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormMessages();

    const date = dateInput.value;
    // Se o campo vier vazio, usa o fallback '07:00' (mesmo padrão do backend).
    const nightHoursClock = totalNightHoursInput.value || '07:00';

    if (!date) {
      showFormError('Informe a data do turno noturno.');
      return;
    }

    setLoading(true);
    try {
      const wasEditing = !!editingId;
      if (editingId) {
        await Api.updateNightShift(editingId, { date, nightHoursClock });
        showFormSuccess('Turno noturno atualizado com sucesso!');
      } else {
        await Api.createNightShift({ date, nightHoursClock });
        showFormSuccess('Turno noturno registrado com sucesso!');
      }
      exitEditMode();
      await loadNightShifts(wasEditing ? currentPage : 1);
    } catch (err) {
      showFormError(err.message || 'Não foi possível salvar o registro.');
    } finally {
      setLoading(false);
    }
  });

  pageLimitSelect.addEventListener('change', () => {
    pageLimit = Number(pageLimitSelect.value);
    saveCurrentFilterState()
    loadNightShifts(1);
  });

  restoreFilterState(FILTER_PAGE_KEY, {
    'filter-start-date': 'startDate',
    'filter-end-date': 'endDate',
    'filter-pay-month-start': 'startPayDate',
    'filter-pay-month-end': 'endPayDate',
    'filter-sort': 'sort',
    'page-limit': 'limit'
  });
  pageLimit = Number(pageLimitSelect.value) || pageLimit;

  // Seleção múltipla: barra de ação em lote + "selecionar todos"
  Selection.buildBatchToolbar(selectionState, selectionToolbarContainer, {
    idPrefix: 'nightshift-',
    countLabel: 'registro(s) selecionado(s)',
    deleteLabel: 'Excluir selecionados',
    clearLabel: 'Limpar seleção'
  });
  selectionState.onBatchDelete = handleBatchDelete;
  selectionState.onLimitReached = (max) => {
    alert(`É possível selecionar no máximo ${max} registros por vez.`);
  };
  Selection.setAllCheckbox(selectionState, selectAllCheckbox, false);
  if (toggleBatchSelectButton) {
    toggleBatchSelectButton.addEventListener('click', () => {
      setBatchMode(!selectionState.selectionEnabled);
    });
  }

  loadNightShifts();
});
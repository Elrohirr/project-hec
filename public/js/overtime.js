document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('overtime-form');
  const formTitle = document.getElementById('form-title');
  const workedHoursInput = document.getElementById('worked-hours');
  const dateInput = document.getElementById('date');
  const isDayOffInput = document.getElementById('is-day-off');
  const isHolidayInput = document.getElementById('is-holiday');
  const submitButton = document.getElementById('submit-button');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  const formErrorBox = document.getElementById('form-error-box');
  const formSuccessBox = document.getElementById('form-success-box');

  const tableBody = document.getElementById('overtime-table-body');
  const emptyState = document.getElementById('empty-state');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPageButton = document.getElementById('prev-page-button');
  const nextPageButton = document.getElementById('next-page-button');
  const pageLimitSelect = document.getElementById('page-limit');

  const FILTER_PAGE_KEY = 'overtime';

  const summaryHe50 = document.getElementById('summary-he50');
  const summaryHe50Value = document.getElementById('summary-he50-value')
  const summaryHe75 = document.getElementById('summary-he75');
  const summaryHe75Value = document.getElementById('summary-he75-value')
  const summaryHe100 = document.getElementById('summary-he100');
  const summaryHe100Value = document.getElementById('summary-he100-value')
  const summaryHeHoliday = document.getElementById('summary-he-holiday');
  const summaryHeHolidayValue = document.getElementById('summary-he-holiday-value')
  const summaryTotal = document.getElementById('summary-total');

  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterIsHoliday = document.getElementById('filter-is-holiday');
  const filterIsDayOff = document.getElementById('filter-is-day-off');
  const filterPayMonthStart = document.getElementById('filter-pay-month-start');
  const filterPayMonthEnd = document.getElementById('filter-pay-month-end');
  const filterSort = document.getElementById('filter-sort');
  const applyFiltersButton = document.getElementById('apply-filters-button');
  const clearFiltersButton = document.getElementById('clear-filters-button');

  let currentPage = 1;
  let pageLimit = 10;
  let totalPages = 1;
  let editingId = null; // null = criando um novo registro; string = editando esse _id

  // Seleção múltipla / ação em lote
  const selectionState = Selection.createState();
  const selectionToolbarContainer = document.getElementById('selection-toolbar');
  const selectAllCheckbox = document.getElementById('select-all-overtimes');
  const toggleBatchSelectButton = document.getElementById('toggle-batch-select-button');
  const overtimeTable = document.getElementById('overtime-table');
  selectionState.table = overtimeTable;
  let currentRecords = []; // cache da página atual, usada pela exclusão em lote

  // Liga/desliga o modo de exclusão em massa (mostra a coluna de checkboxes).
  function setBatchMode(enabled) {
    Selection.setTableSelectionMode(selectionState, enabled, { table: overtimeTable });
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

  function updateSummary({ distribution, values }) {
    const he100Minutes = distribution?.he100 || 0;
    const heHolidayMinutes = distribution?.heHoliday || 0;
    const valueHe100 = values?.valueHe100 || 0;
    const valueHeHoliday = values?.valueHeHoliday || 0;

    summaryHe50.textContent = hoursWithDecimal(distribution?.he50);
    summaryHe75.textContent = hoursWithDecimal(distribution?.he75);
    // HE 100% sem os minutos que já são contados como feriado (card HE (Feriado))
    summaryHe100.textContent = hoursWithDecimal(he100Minutes - heHolidayMinutes);
    summaryHeHoliday.textContent = hoursWithDecimal(heHolidayMinutes);
    summaryTotal.textContent = currencyFormatter.format(values?.total ?? 0);

    summaryHe50Value.textContent = currencyFormatter.format(values?.valueHe50 ?? 0)
    summaryHe75Value.textContent = currencyFormatter.format(values?.valueHe75 ?? 0)
    summaryHe100Value.textContent = currencyFormatter.format(valueHe100 - valueHeHoliday)
    summaryHeHolidayValue.textContent = currencyFormatter.format(valueHeHoliday)

  }

  function renderRow(record) {
    const tr = document.createElement('tr');

    const badges = [];
    if (record.isHoliday) badges.push('<span class="badge holiday">Feriado</span>');
    if (record.isDayOff) badges.push('<span class="badge day-off">Folga</span>');

    const STATUS_BADGES = {
      compensated: '<span class="badge status-compensated">Compensada</span>',
      partially_compensated: '<span class="badge status-partial">Parcial</span>',
      paid: '<span class="badge status-paid">Pago</span>',
      banked: '<span class="badge status-banked">No banco</span>',
      // non-banked: sem badge próprio, já coberto por isHoliday acima
    }

    if (STATUS_BADGES[record.status]) badges.push(STATUS_BADGES[record.status]);

    let netValueToolTip = '';
    if (record.values.total !== record.netValue) {
      netValueToolTip = ` title="Bruto: ${currencyFormatter.format(record.values.total)}"`
    }

    // Registros compensados não podem ser excluídos (o backend bloqueia),
    // então o checkbox fica desabilitado com o motivo no title.
    const selectionDisabled = (record.compensatedMinutes || 0) > 0;
    const selectionTitle = selectionDisabled
      ? 'Horas compensadas não podem ser excluídas.'
      : '';

    tr.innerHTML = `
      <td class="select-column">
        <input type="checkbox" class="table-row-select" data-id="${record._id}"
          ${selectionDisabled ? 'disabled' : ''} title="${selectionTitle}"
          aria-label="Selecionar registro de ${formatDate(record.date)}">
      </td>
      <td>${formatDate(record.date)}</td>
      <td class="numeric">${record.workedHours ?? '00:00'}</td>
      <td class="numeric">${record.distributionHours?.he50hours ?? '00:00'}</td>
      <td class="numeric">${record.distributionHours?.he75hours ?? '00:00'}</td>
      <td class="numeric">${record.distributionHours?.he100hours ?? '00:00'}</td>
      <td class="numeric${netValueToolTip ? ' has-tooltip' : ''}"${netValueToolTip}>${currencyFormatter.format(record.netValue ?? 0)}</td>
      <td class="numeric">${currencyFormatter.format(record.wageAtCalculation ?? 0)}</td>
      <td>${formatPayDate(record.payDate)}</td>
      <td>${badges.join(' ') || '—'}</td>
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
    if (rowCheckbox && !rowCheckbox.disabled) {
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
    currentRecords = records.slice();
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
    if (!confirm('Excluir este registro de hora extra?')) return;
    try {
      await Api.deleteOvertime(id);
      // se o registro excluído era o que estava sendo editado, sai do modo edição
      if (editingId === id) exitEditMode();
      await loadOvertimes(currentPage);
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

    Selection.confirmAndDeleteBatch(selectionState, currentRecords, {
      title: 'Excluir horas extras',
      warning: 'Registros compensados não serão excluídos.',
      submitLabel: 'Excluir',
      onConfirm: (batchIds) => Api.multiDeleteOvertimes(batchIds),
      onResult: async (result) => {
        const deleted = result?.deleted?.length ?? 0;
        const rejected = result?.rejected?.length ?? 0;
        await loadOvertimes(currentPage);
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
    try {
      const { overtime: record } = await Api.getOvertime(id);
      enterEditMode(record);
    } catch (err) {
      showFormError(err.message || 'Não foi possível carregar o registro.');
    }
  }

  function enterEditMode(record) {
    editingId = record._id;
    workedHoursInput.value = record.workedHours ?? '00:00';
    dateInput.value = toDateInputValue(record.date);
    isDayOffInput.checked = !!record.isDayOff;
    isHolidayInput.checked = !!record.isHoliday;

    formTitle.textContent = 'Editar hora extra';
    submitButton.textContent = 'Salvar alterações';
    cancelEditButton.hidden = false;

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitEditMode() {
    editingId = null;
    form.reset();
    formTitle.textContent = 'Registrar hora extra';
    submitButton.textContent = 'Registrar';
    cancelEditButton.hidden = true;
  }

  cancelEditButton.addEventListener('click', exitEditMode);

  function getActiveFilters() {
    const filters = {};
    if (filterStartDate.value) filters.startDate = filterStartDate.value;
    if (filterEndDate.value) filters.endDate = filterEndDate.value;
    if (filterIsHoliday.value) filters.isHoliday = filterIsHoliday.value;
    if (filterIsDayOff.value) filters.isDayOff = filterIsDayOff.value;
    if (filterPayMonthStart.value) filters.startPayDate = monthStartDate(filterPayMonthStart.value);
    if (filterPayMonthEnd.value) filters.endPayDate = monthEndDate(filterPayMonthEnd.value);
    if (filterSort.value) filters.sort = filterSort.value;
    return filters;
  }

  function saveCurrentFilterState() {
    return saveFilterState(FILTER_PAGE_KEY, {
      startDate: filterStartDate.value,
      endDate: filterEndDate.value,
      isHoliday: filterIsHoliday.value,
      isDayOff: filterIsDayOff.value,
      startPayDate: filterPayMonthStart.value,
      endPayDate: filterPayMonthEnd.value,
      sort: filterSort.value,
      limit: pageLimitSelect.value
    });
  }

  async function loadOvertimes(page = 1) {
    try {
      const data = await Api.getOvertimes({ page, limit: pageLimit, ...getActiveFilters() });
      currentPage = data.currentPage || page;
      totalPages = data.numberOfPages || 1;

      renderTable(data.overtime || []);
      updateSummary(data);

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
    loadOvertimes(1);
  });

  clearFiltersButton.addEventListener('click', () => {
    clearFilterState(FILTER_PAGE_KEY);
    filterStartDate.value = '';
    filterEndDate.value = '';
    filterIsHoliday.value = '';
    filterIsDayOff.value = '';
    filterPayMonthStart.value = '';
    filterPayMonthEnd.value = '';
    filterSort.value = '-date';
    loadOvertimes(1);
  });

  prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) loadOvertimes(currentPage - 1);
  });

  nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) loadOvertimes(currentPage + 1);
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

  function hideFormMessages() {
    formErrorBox.hidden = true;
    formSuccessBox.hidden = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormMessages();

    const workedHours = workedHoursInput.value;
    const date = dateInput.value;
    const isDayOff = isDayOffInput.checked;
    const isHoliday = isHolidayInput.checked;

    if (!workedHours || !date) {
      showFormError('Informe as horas extras e a data.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await Api.updateOvertime(editingId, { workedHours, date, isDayOff, isHoliday });
        formSuccessBox.textContent = 'Registro atualizado com sucesso!';
      } else {
        await Api.createOvertime({ workedHours, date, isDayOff, isHoliday });
        formSuccessBox.textContent = 'Hora extra registrada com sucesso!';
      }
      formSuccessBox.hidden = false;
      const wasEditing = !!editingId;
      exitEditMode();
      await loadOvertimes(wasEditing ? currentPage : 1);
    } catch (err) {
      showFormError(err.message || 'Não foi possível salvar o registro.');
    } finally {
      setLoading(false);
    }
  });

  pageLimitSelect.addEventListener('change', () => {
    pageLimit = Number(pageLimitSelect.value);
    saveCurrentFilterState()
    loadOvertimes(1);
  });

  restoreFilterState(FILTER_PAGE_KEY, {
    'filter-start-date': 'startDate',
    'filter-end-date': 'endDate',
    'filter-is-holiday': 'isHoliday',
    'filter-is-day-off': 'isDayOff',
    'filter-pay-month-start': 'startPayDate',
    'filter-pay-month-end': 'endPayDate',
    'filter-sort': 'sort',
    'page-limit': 'limit'
  });
  pageLimit = Number(pageLimitSelect.value) || pageLimit;

  // Seleção múltipla: barra de ação em lote + "selecionar todos"
  Selection.buildBatchToolbar(selectionState, selectionToolbarContainer, {
    idPrefix: 'overtime-',
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

  loadOvertimes(1);
});
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

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  // timeZone: 'UTC' evita que o navegador "puxe" a data pro fuso local
  // e mostre um dia a menos (o backend salva as datas como UTC meia-noite).
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

  const payDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    month: '2-digit',
    year: 'numeric'
  });

  let editingId = null; // null = criando novo registro; string = editando esse _id
  let recordsCache = []; // registros carregados, usados para preencher o form ao editar
  let currentPage = 1;
  let totalPages = 1;

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

  function minutesToHHMM(totalMinutes) {
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function updateSummary(records) {
    const totalClockMinutes = records.reduce((sum, r) => sum + hhmmToMinutes(r.nightHoursClock), 0);
    const totalReducedMinutes = records.reduce((sum, r) => sum + hhmmToMinutes(r.nightHoursReduced), 0);
    const totalValue = records.reduce((sum, r) => sum + (r.nightShiftValue || 0), 0);

    summaryTotalClock.textContent = minutesToHHMM(totalClockMinutes);
    summaryTotalReduced.textContent = minutesToHHMM(totalReducedMinutes);
    summaryTotalNightValue.textContent = currencyFormatter.format(totalValue);
    summaryTotal.textContent = currencyFormatter.format(totalValue);
  }

  function renderRow(record) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${formatDate(record.date)}</td>
      <td class="numeric">${record.nightHoursClock ?? '07:00'}</td>
      <td class="numeric">${record.nightHoursReduced ?? '08:00'}</td>
      <td class="numeric">${currencyFormatter.format(record.nightShiftValue ?? 0)}</td>
      <td class="numeric">${currencyFormatter.format(record.wageAtCalculation ?? 0)}</td>
      <td>${formatPayDate(record.payDate)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-button edit" data-id="${record._id}">Editar</button>
          <button type="button" class="icon-button" data-id="${record._id}">Excluir</button>
        </div>
      </td>
    `;

    tr.querySelector('.icon-button.edit').addEventListener('click', () => handleEditClick(record._id));
    tr.querySelector('.icon-button:not(.edit)').addEventListener('click', () => handleDelete(record._id));
    return tr;
  }

  function renderTable(records) {
    tableBody.innerHTML = '';
    if (!records.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;
    records.forEach((record) => tableBody.appendChild(renderRow(record)));
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

  function monthStartDate(monthValue) {
    return `${monthValue}-01`;
  }

  function monthEndDate(monthValue) {
    const [year, month] = monthValue.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthValue}-${String(lastDay).padStart(2, '0')}`;
  }

  function getActiveFilters() {
    const filters = {};
    if (filterStartDate.value) filters.startDate = filterStartDate.value;
    if (filterEndDate.value) filters.endDate = filterEndDate.value;
    if (filterPayMonthStart.value) filters.startPayDate = monthStartDate(filterPayMonthStart.value);
    if (filterPayMonthEnd.value) filters.endPayDate = monthEndDate(filterPayMonthEnd.value);
    if (filterSort.value) filters.sort = filterSort.value;
    return filters;
  }

  async function loadNightShifts(page = 1) {
    try {
      const data = await Api.getNightShifts({ page, limit: 10, ...getActiveFilters() });
      const records = data.nightShift || [];

      currentPage = data.currentPage || page;
      totalPages = data.numberOfPages || 1;

      recordsCache = records;
      renderTable(records);
      updateSummary(records);

      pageIndicator.textContent = `Página ${currentPage} de ${totalPages} · ${data.totalRecords} registro(s)`;
      prevPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;
    } catch (err) {
      emptyState.hidden = false;
      emptyState.textContent = err.message || 'Não foi possível carregar os registros.';
    }
  }

  applyFiltersButton.addEventListener('click', () => loadNightShifts(1));

  clearFiltersButton.addEventListener('click', () => {
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
    const nightHoursClock = totalNightHoursInput.value;

    if (!date) {
      showFormError('Informe a data do turno noturno.');
      return;
    }

    if (!nightHoursClock) {
      showFormError('Informe as horas noturnas.');
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

  loadNightShifts();
});
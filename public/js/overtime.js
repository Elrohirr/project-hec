document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('overtime-form');
  const formTitle = document.getElementById('form-title');
  const quantityInput = document.getElementById('quantity');
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

  const summaryHe50 = document.getElementById('summary-he50');
  const summaryHe75 = document.getElementById('summary-he75');
  const summaryHe100 = document.getElementById('summary-he100');
  const summaryTotal = document.getElementById('summary-total');

  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterIsHoliday = document.getElementById('filter-is-holiday');
  const filterIsDayOff = document.getElementById('filter-is-day-off');
  const filterSort = document.getElementById('filter-sort');
  const applyFiltersButton = document.getElementById('apply-filters-button');
  const clearFiltersButton = document.getElementById('clear-filters-button');

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  // timeZone: 'UTC' evita que o navegador "puxe" a data pro fuso local
  // e mostre um dia a menos (o backend salva as datas como UTC meia-noite).
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

  const payDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC',
    month:'2-digit',
    year:'numeric',
   });

  let currentPage = 1;
  let totalPages = 1;
  let editingId = null; // null = criando um novo registro; string = editando esse _id

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
    summaryHe50.textContent = `${distribution?.he50 ?? 0}h`;
    summaryHe75.textContent = `${distribution?.he75 ?? 0}h`;
    summaryHe100.textContent = `${distribution?.he100 ?? 0}h`;
    summaryTotal.textContent = currencyFormatter.format(values?.total ?? 0);
  }

  function renderRow(record) {
    const tr = document.createElement('tr');

    const badges = [];
    if (record.isHoliday) badges.push('<span class="badge holiday">Feriado</span>');
    if (record.isDayOff) badges.push('<span class="badge day-off">Folga</span>');

    tr.innerHTML = `
      <td>${formatDate(record.date)}</td>
      <td class="numeric">${record.quantity}h</td>
      <td class="numeric">${record.distribution?.he50 ?? 0}h</td>
      <td class="numeric">${record.distribution?.he75 ?? 0}h</td>
      <td class="numeric">${record.distribution?.he100 ?? 0}h</td>
      <td class="numeric">${currencyFormatter.format(record.values?.total ?? 0)}</td>
      <td>${formatPayDate(record.payDate)}</td>
      <td>${badges.join(' ') || '—'}</td>
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
    quantityInput.value = record.quantity;
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
    if (filterSort.value) filters.sort = filterSort.value;
    return filters;
  }

  async function loadOvertimes(page = 1) {
    try {
      const data = await Api.getOvertimes({ page, limit: 10, ...getActiveFilters() });
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

  applyFiltersButton.addEventListener('click', () => loadOvertimes(1));

  clearFiltersButton.addEventListener('click', () => {
    filterStartDate.value = '';
    filterEndDate.value = '';
    filterIsHoliday.value = '';
    filterIsDayOff.value = '';
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

    const quantity = Number(quantityInput.value);
    const date = dateInput.value;
    const isDayOff = isDayOffInput.checked;
    const isHoliday = isHolidayInput.checked;

    if (!quantity || quantity <= 0 || !date) {
      showFormError('Informe a quantidade de horas e a data.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await Api.updateOvertime(editingId, { quantity, date, isDayOff, isHoliday });
        formSuccessBox.textContent = 'Registro atualizado com sucesso!';
      } else {
        await Api.createOvertime({ quantity, date, isDayOff, isHoliday });
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

  loadOvertimes(1);
});

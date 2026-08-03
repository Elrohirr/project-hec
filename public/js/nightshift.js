document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('nightshift-form');
  const totalNightHoursInput = document.getElementById('total-night-hours');
  const dateInput = document.getElementById('date');
  const submitButton = document.getElementById('submit-button');
  const formErrorBox = document.getElementById('form-error-box');
  const formSuccessBox = document.getElementById('form-success-box');

  const tableBody = document.getElementById('nightshift-table-body');
  const emptyState = document.getElementById('empty-state');
  const pageIndicator = document.getElementById('page-indicator');

  const summaryTotalNightHours = document.getElementById('summary-total-night-hours');
  const summaryTotalNightValue = document.getElementById('summary-total-night-value');
  const summaryTotal = document.getElementById('summary-total');

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

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function formatPayDate(isoString) {
    if (!isoString) return '—';
    return payDateFormatter.format(new Date(isoString));
  }

  function updateSummary(records) {
    const totalHours = records.reduce((sum, r) => sum + (r.totalNightHours || 0), 0);
    const totalValue = records.reduce((sum, r) => sum + (r.nightShiftValue || 0), 0);

    summaryTotalNightHours.textContent = `${totalHours}h`;
    summaryTotalNightValue.textContent = currencyFormatter.format(totalValue);
    summaryTotal.textContent = currencyFormatter.format(totalValue);
  }

  function renderRow(record) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${formatDate(record.date)}</td>
      <td class="numeric">${record.totalNightHours ?? 0}h</td>
      <td class="numeric">${currencyFormatter.format(record.nightShiftValue ?? 0)}</td>
      <td>${formatPayDate(record.payDate)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-button" data-id="${record._id}">Excluir</button>
        </div>
      </td>
    `;

    tr.querySelector('.icon-button').addEventListener('click', () => handleDelete(record._id));
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
      await loadNightShifts();
    } catch (err) {
      alert(err.message || 'Não foi possível excluir o registro.');
    }
  }

  async function loadNightShifts() {
    try {
      const data = await Api.getNightShifts();
      const records = Array.isArray(data) ? data : [];

      renderTable(records);
      updateSummary(records);

      pageIndicator.textContent = `${records.length} registro(s)`;
    } catch (err) {
      emptyState.hidden = false;
      emptyState.textContent = err.message || 'Não foi possível carregar os registros.';
    }
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Registrando…' : 'Registrar';
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormMessages();

    const date = dateInput.value;
    const totalNightHours = Number(totalNightHoursInput.value);

    if (!date) {
      showFormError('Informe a data do turno noturno.');
      return;
    }

    /*if (!totalNightHours || totalNightHours <= 0) {
      showFormError('Informe a quantidade de horas noturnas.');
      return;
    }*/

    setLoading(true);
    try {
      await Api.createNightShift({ date, totalNightHours });
      showFormSuccess('Turno noturno registrado com sucesso!');
      form.reset();
      await loadNightShifts();
    } catch (err) {
      showFormError(err.message || 'Não foi possível salvar o registro.');
    } finally {
      setLoading(false);
    }
  });

  loadNightShifts();
});
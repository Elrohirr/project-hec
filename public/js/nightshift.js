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

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function formatPayDate(isoString) {
    if (!isoString) return '—';
    return payDateFormatter.format(new Date(isoString));
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
      await Api.createNightShift({ date, nightHoursClock });
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
/**
 * Lógica da tela "Banco de Horas".
 * Consume a API /api/v1/bank:
 *   GET  /bank          -> [{ totalBankedMinutes }, compensações]
 *   POST /bank/preview  -> entries[] (hoursNeeded em branco usa o padrão 08:00)
 * A confirmação/cancelamento ficam DESABILITADOS na UI por agora
 * (módulo em fase de testes). Os botões existem, mas não disparam
 * chamadas à API.
 */
document.addEventListener('DOMContentLoaded', () => {
  const balanceEl = document.getElementById('bank-balance');
  const errorBox = document.getElementById('bank-error-box');

  const dateInput = document.getElementById('bank-date');
  const hoursInput = document.getElementById('bank-hours');
  const simulateButton = document.getElementById('simulate-button');

  const previewSection = document.getElementById('bank-preview-section');
  const previewBody = document.getElementById('bank-preview-body');
  const previewTotals = document.getElementById('bank-preview-totals');
  const previewEmpty = document.getElementById('bank-preview-empty');
  const previewRequested = document.getElementById('bank-preview-requested');

  const historyBody = document.getElementById('bank-history-body');
  const historyEmpty = document.getElementById('bank-history-empty');

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const BETA_TOOLTIP = 'Disponível em breve — módulo em fase de testes.';
  const DEFAULT_COMPENSATION_HOURS = '08:00'; // mesmo padrão do backend (simulateBankCompensation)

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function tierClock(tiers) {
    return `${minutesToHHMM(tiers?.he50)}/${minutesToHHMM(tiers?.he75)}/${minutesToHHMM(tiers?.he100)}`;
  }

  function tierValue(tiers) {
    return `${currencyFormatter.format(tiers?.he50 || 0)}/${currencyFormatter.format(tiers?.he75 || 0)}/${currencyFormatter.format(tiers?.he100 || 0)}`;
  }

  function renderPreview(entries) {
    const list = entries || [];
    let totalMinutes = 0;
    let totalValue = 0;

    previewBody.innerHTML = '';
    if (!list.length) {
      previewEmpty.hidden = false;
      previewTotals.innerHTML = '';
    } else {
      previewEmpty.hidden = true;
      list.forEach((entry) => {
        const used = Number(entry.minutesUsed) || 0;
        const lost = Number(entry.valueLost) || 0;
        totalMinutes += used;
        totalValue += lost;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(entry.overtimeDate)}</td>
          <td class="numeric">${minutesToHHMM(used)}</td>
          <td class="numeric">${tierClock(entry.minutesUsedByTier)}</td>
          <td class="numeric">${currencyFormatter.format(lost)}</td>
          <td class="numeric">${tierValue(entry.valueLostByTier)}</td>
        `;
        previewBody.appendChild(tr);
      });

      previewTotals.innerHTML = `
        <tr>
          <th>Total</th>
          <td class="numeric">${minutesToHHMM(totalMinutes)}</td>
          <td></td>
          <td class="numeric">${currencyFormatter.format(totalValue)}</td>
          <td></td>
        </tr>
      `;
    }

    previewSection.hidden = false;
  }

  function buildCancelButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost-button-light small bank-disabled-cta';
    button.disabled = true;
    button.title = BETA_TOOLTIP;
    button.textContent = 'Cancelar';
    return button;
  }

  /** Constrói a tabela de entries (HTML) usada no modal "Abrir detalhes". */
  function entriesTableHtml(entries) {
    const list = entries || [];
    let totalMinutes = 0;
    let totalValue = 0;

    const rows = list.map((entry) => {
      const used = Number(entry.minutesUsed) || 0;
      const lost = Number(entry.valueLost) || 0;
      totalMinutes += used;
      totalValue += lost;

      return `
        <tr>
          <td>${formatDate(entry.overtimeDate)}</td>
          <td class="numeric">${minutesToHHMM(used)}</td>
          <td class="numeric">${tierClock(entry.minutesUsedByTier)}</td>
          <td class="numeric">${currencyFormatter.format(lost)}</td>
          <td class="numeric">${tierValue(entry.valueLostByTier)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="overtime-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Min. usados</th>
            <th>Min. por tier (50/75/100)</th>
            <th>Valor perdido</th>
            <th>Valor por tier (50/75/100)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td class="numeric">${minutesToHHMM(totalMinutes)}</td>
            <td></td>
            <td class="numeric">${currencyFormatter.format(totalValue)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  /** Abre um modal com os detalhes (entries) de uma compensação do histórico. */
  function openEntryDetails(item) {
    const list = Array.isArray(item.entries) ? item.entries : [];
    if (!list.length) return;

    const modal = createModal({
      title: `Detalhes da compensação — ${formatDate(item.date)}`,
      body: entriesTableHtml(list)
    });

    // Modal um pouco mais largo para acomodar melhor a tabela de entries.
    const dialog = modal.el.querySelector('.modal');
    if (dialog) dialog.classList.add('bank-entry-modal');

    modal.open();
  }

  function buildDetailsButton(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button details';
    button.textContent = 'Abrir detalhes';
    button.addEventListener('click', () => openEntryDetails(item));
    return button;
  }

  function renderHistory(list) {
    historyBody.innerHTML = '';
    const rows = Array.isArray(list) ? list : [];

    if (!rows.length) {
      historyEmpty.hidden = false;
      return;
    }
    historyEmpty.hidden = true;

    rows.forEach((item) => {
      const totalValueLost = (item.entries || []).reduce(
        (sum, entry) => sum + (Number(entry.valueLost) || 0),
        0
      );
      const isCancelled = item.status === 'cancelled';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(item.date)}</td>
        <td class="numeric">${minutesToHHMM(item.totalMinutes)}</td>
        <td class="numeric">${currencyFormatter.format(totalValueLost)}</td>
        <td><span class="badge ${isCancelled ? 'bank-cancelled' : 'bank-active'}">${isCancelled ? 'Cancelado' : 'Ativo'}</span></td>
        <td><span class="source-tag">${item.source === 'pdf_import' ? 'PDF import' : 'Manual'}</span></td>
        <td><div class="row-actions"></div></td>
      `;
      const actions = tr.querySelector('.row-actions');
      if (Array.isArray(item.entries) && item.entries.length) {
        actions.appendChild(buildDetailsButton(item));
      }
      actions.appendChild(buildCancelButton());
      historyBody.appendChild(tr);
    });
  }

  async function loadBank() {
    const data = await Api.getBankCompensations();
    const totalsDoc = Array.isArray(data) ? data[0] : null;
    const list = Array.isArray(data) ? data[1] : [];

    balanceEl.textContent = minutesToHHMM(totalsDoc?.totalBankedMinutes || 0);
    renderHistory(list);
  }

  simulateButton.addEventListener('click', async () => {
    const date = dateInput.value;
    // Se o campo de horas vier vazio, usa o fallback '08:00' (mesmo padrão do backend).
    const hoursNeeded = hoursInput.value || DEFAULT_COMPENSATION_HOURS;

    errorBox.hidden = true;
    if (!date) {
      showError('Informe a data da compensação.');
      return;
    }

    simulateButton.disabled = true;
    simulateButton.textContent = 'Simulando…';
    try {
      const entries = await Api.previewBankCompensation({ date, hoursNeeded });
      previewRequested.textContent = hoursNeeded;
      renderPreview(entries);
    } catch (err) {
      previewSection.hidden = true;
      showError(err.message || 'Não foi possível simular a compensação.');
    } finally {
      simulateButton.disabled = false;
      simulateButton.textContent = 'Simular';
    }
  });

  loadBank().catch((err) => {
    balanceEl.textContent = '—';
    showError(err.message || 'Não foi possível carregar o saldo e o histórico do banco de horas.');
  });
});
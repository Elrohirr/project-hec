/**
 * Lógica da tela "Banco de Horas".
 * Consume a API /api/v1/bank:
 *   GET  /bank          -> { bankedMinutesTotal: { balance }, totalValueCompensated: { compensatedValue },
 *                           totalValueCompensatedByTier: { valueLost50, valueLost75, valueLost100 }, bankCompensation[] }
 *   POST /bank/preview  -> entries[] (hoursNeeded em branco usa o padrão 08:00)
 *   POST /bank/confirm  -> {} (body { date, hoursNeeded })
 *   PATCH /bank/cancel/:id -> { msg }
 * Simular e Confirmar são ações independentes (botões sempre habilitados);
 * o backend re-deriva a elegibilidade em confirm. Cancelar restaura horas.
 */
document.addEventListener('DOMContentLoaded', () => {
  const balanceEl = document.getElementById('bank-balance');
  const compTotalEl = document.getElementById('bank-comp-total');
  const comp50El = document.getElementById('bank-comp-50');
  const comp75El = document.getElementById('bank-comp-75');
  const comp100El = document.getElementById('bank-comp-100');
  const errorBox = document.getElementById('bank-error-box');

  const dateInput = document.getElementById('bank-date');
  const hoursInput = document.getElementById('bank-hours');
  const simulateButton = document.getElementById('simulate-button');

  const previewSection = document.getElementById('bank-preview-section');
  const previewBody = document.getElementById('bank-preview-body');
  const previewTotals = document.getElementById('bank-preview-totals');
  const previewEmpty = document.getElementById('bank-preview-empty');
  const previewRequested = document.getElementById('bank-preview-requested');
  const resultBadge = document.getElementById('bank-result-badge');
  const resultTableWrap = document.getElementById('bank-result-table-wrap');

  const historyBody = document.getElementById('bank-history-body');
  const historyEmpty = document.getElementById('bank-history-empty');

  const confirmButton = document.getElementById('confirm-bank-button');
  const successBox = document.getElementById('bank-success-box');

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const DEFAULT_COMPENSATION_HOURS = '08:00'; // mesmo padrão do backend (simulateBankCompensation)

  // Dados da última simulação válida — usados pelo "Confirmar banco".
  let lastSimulation = null;

  function showError(message) {
    successBox.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function setSuccess(message) {
    errorBox.hidden = true;
    successBox.textContent = message;
    successBox.hidden = false;
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
    previewTotals.innerHTML = '';

    if (!list.length) {
      previewEmpty.hidden = false;
      resultTableWrap.hidden = true;
      return;
    }

    previewEmpty.hidden = true;
    resultTableWrap.hidden = false;

    list.forEach((entry) => {
      const used = Number(entry.minutesUsed) || 0;
      const lost = Number(entry.valueLost) || 0;
      totalMinutes += used;
      totalValue += lost;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(entry.overtimeDate)}</td>
        <td class="numeric">${minutesToHHMM(used)}</td>
        <td class="numeric">${currencyFormatter.format(lost)}</td>
        <td class="numeric">${tierClock(entry.minutesUsedByTier)}</td>
        <td class="numeric">${tierValue(entry.valueLostByTier)}</td>
      `;
      previewBody.appendChild(tr);
    });

    previewTotals.innerHTML = `
      <tr>
        <th>Total</th>
        <td class="numeric">${minutesToHHMM(totalMinutes)}</td>
        <td class="numeric">${currencyFormatter.format(totalValue)}</td>
        <td>-----</td>
        <td>-----</td>
      </tr>
    `;
  }

  function buildCancelButton(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.textContent = 'Cancelar';
    button.addEventListener('click', () => cancelCompensation(item, button));
    return button;
  }

  /** Cancela uma compensação ativa após confirmação do usuário e recarrega. */
  async function cancelCompensation(item, button) {
    const confirmed = window.confirm(
      'Tem certeza que deseja cancelar esta compensação? As horas extras usadas serão restauradas.'
    );
    if (!confirmed) return;

    button.disabled = true;
    button.textContent = 'Cancelando…';

    try {
      await Api.cancelBankCompensation(item._id);
      setSuccess('Compensação cancelada com sucesso.');
      await loadBank();
    } catch (err) {
      showError(err.message || 'Não foi possível cancelar a compensação.');
      button.disabled = false;
      button.textContent = 'Cancelar';
    }
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
          <td class="numeric">${currencyFormatter.format(lost)}</td>
          <td class="numeric">${tierClock(entry.minutesUsedByTier)}</td>
          <td class="numeric">${tierValue(entry.valueLostByTier)}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="overtime-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Horas usadas</th>
            <th>Valor perdido</th>
            <th>Horas por adicional (50/75/100)</th>
            <th>Valor por adicional (50/75/100)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td class="numeric">${minutesToHHMM(totalMinutes)}</td>
            <td class="numeric">${currencyFormatter.format(totalValue)}</td>
            <td>-----</td>
            <td>-----</td>
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
      if (isCancelled) {
        const noAction = document.createElement('span');
        noAction.className = 'no-action';
        noAction.textContent = '—';
        actions.appendChild(noAction);
      } else {
        actions.appendChild(buildCancelButton(item));
      }
      historyBody.appendChild(tr);
    });
  }

  async function loadBank() {
    const data = await Api.getBankCompensations();
    // Nova estrutura de resposta (objeto):
    //   bankedMinutesTotal: { balance }
    //   totalValueCompensated: { compensatedValue }
    //   totalValueCompensatedByTier: { valueLost50, valueLost75, valueLost100 }
    //   bankCompensation: [...]
    const totalsDoc = data?.bankedMinutesTotal || {};
    const totalsCompensated = data?.totalValueCompensated || {};
    const tierTotals = data?.totalValueCompensatedByTier || {};
    const list = Array.isArray(data?.bankCompensation) ? data.bankCompensation : [];

    balanceEl.textContent = minutesToHHMM(totalsDoc.balance || 0);
    compTotalEl.textContent = currencyFormatter.format(totalsCompensated.compensatedValue || 0);
    comp50El.textContent = currencyFormatter.format(tierTotals.valueLost50 || 0);
    comp75El.textContent = currencyFormatter.format(tierTotals.valueLost75 || 0);
    comp100El.textContent = currencyFormatter.format(tierTotals.valueLost100 || 0);
    renderHistory(list);
  }

  // ---- Estado do painel de resultado ----------------------------------------
  // 'vazio' | 'simulacao' | 'confirmado'
  function setResultState(state, entries) {
    if (state === 'simulacao') {
      resultBadge.textContent = 'Prévia';
      resultBadge.classList.add('bank-preview');
      resultBadge.classList.remove('bank-confirmed');
      resultBadge.hidden = false;
      renderPreview(entries || []);
    } else if (state === 'confirmado') {
      resultBadge.textContent = 'Confirmado';
      resultBadge.classList.add('bank-confirmed');
      resultBadge.classList.remove('bank-preview');
      resultBadge.hidden = false;
      renderPreview(entries || []);
    } else {
      resultBadge.textContent = '';
      resultBadge.hidden = true;
      previewEmpty.hidden = false;
      resultTableWrap.hidden = true;
      previewBody.innerHTML = '';
      previewTotals.innerHTML = '';
      previewRequested.textContent = '—';
    }
  }

  function currentFormValues() {
    return {
      date: dateInput.value,
      hoursNeeded: hoursInput.value || DEFAULT_COMPENSATION_HOURS
    };
  }

  function sameAsLastSimulation(date, hoursNeeded) {
    return lastSimulation && lastSimulation.date === date && lastSimulation.hoursNeeded === hoursNeeded;
  }

  // ---- Simular compensação (POST /bank/preview) ------------------------------
  async function simularCompensacao() {
    const { date, hoursNeeded } = currentFormValues();

    errorBox.hidden = true;
    if (!date) {
      showError('Informe a data da compensação.');
      return;
    }

    simulateButton.disabled = true;
    simulateButton.textContent = 'Simulando…';
    try {
      const entries = await Api.previewBankCompensation({ date, hoursNeeded });
      lastSimulation = { date, hoursNeeded };
      previewRequested.textContent = hoursNeeded;
      setResultState('simulacao', entries);
    } catch (err) {
      showError(err.message || 'Não foi possível simular a compensação.');
    } finally {
      simulateButton.disabled = false;
      simulateButton.textContent = 'Simular';
    }
  }

  // ---- Confirmar compensación (POST /bank/confirm) ---------------------------
  async function confirmarCompensacao() {
    const { date, hoursNeeded } = currentFormValues();

    errorBox.hidden = true;
    if (!date) {
      showError('Informe a data da compensação.');
      return;
    }

    // Guard: passa direto só se já simulou com ESTOS valores na sessão.
    if (!sameAsLastSimulation(date, hoursNeeded)) {
      const ok = window.confirm(`Tem certeza? Isso vai usar ${hoursNeeded} horas do banco.`);
      if (!ok) return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Confirmando…';
    try {
      const result = await Api.confirmBankCompensation({ date, hoursNeeded });
      setSuccess('Compensação confirmada com sucesso.');
      previewRequested.textContent = hoursNeeded;
      lastSimulation = { date, hoursNeeded };
      setResultState('confirmado', result?.entries || []);
      await loadBank();
    } catch (err) {
      showError(err.message || 'Não foi possível confirmar a compensação.');
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = 'Confirmar banco';
    }
  }

  simulateButton.addEventListener('click', simularCompensacao);
  confirmButton.addEventListener('click', confirmarCompensacao);

  setResultState('vazio');

  loadBank().catch((err) => {
    balanceEl.textContent = '—';
    compTotalEl.textContent = '—';
    comp50El.textContent = '—';
    comp75El.textContent = '—';
    comp100El.textContent = '—';
    showError(err.message || 'Não foi possível carregar o saldo e o histórico do banco de horas.');
  });
});
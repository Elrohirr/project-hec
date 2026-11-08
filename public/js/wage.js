document.addEventListener('DOMContentLoaded', () => {
  // ---- Referências do DOM ---------------------------------------------------
  const wageError = document.getElementById('wage-error-box');
  const wageSuccess = document.getElementById('wage-success-box');
  const wageLoading = document.getElementById('wage-loading');
  const wageEmpty = document.getElementById('wage-empty-state');
  const wageTableBody = document.getElementById('wage-table-body');

  const wageForm = document.getElementById('wage-form');
  const newWageInput = document.getElementById('new-wage');
  const newWageDateInput = document.getElementById('new-wage-date');
  const wageSubmit = document.getElementById('wage-submit-button');

  // ---- Helpers --------------------------------------------------------------
  function setMessages(errorBox, successBox, { error = '', success = '' } = {}) {
    errorBox.textContent = error;
    errorBox.hidden = !error;
    successBox.textContent = success;
    successBox.hidden = !success;
  }

  function setLoading(button, isLoading, baseText, loadingText) {
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : baseText;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
  }

  // Converte texto monetário pt-BR (vírgula decimal) para número.
  function parseWage(text) {
    return Number(String(text).trim().replace(',', '.'));
  }

  // Data de hoje como YYYY-MM-DD (fuso local).
  function todayISO() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  }

  // Formata data ISO UTC (meia-noite) para dd/mm/YYYY sem deslocamento de fuso.
  function formatWageDate(isoString) {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d);
  }

  // Formata valor como R$ pt-BR.
  function formatWage(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  // ---- Carregar lista de salários ------------------------------------------
  async function loadWages() {
    setMessages(wageError, wageSuccess);
    wageLoading.hidden = false;
    wageEmpty.hidden = true;
    wageTableBody.innerHTML = '';

    try {
      const wages = await Api.getWages();
      // Ordena por vigência decrescente (mais recente primeiro).
      wages.sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let hasCurrent = false;

      if (wages.length === 0) {
        wageEmpty.hidden = false;
        return;
      }

      for (const w of wages) {
        const eff = new Date(w.effectiveFrom);
        eff.setHours(0, 0, 0, 0);
        const current = eff <= today && !hasCurrent;
        if (current) hasCurrent = true;

        const tr = document.createElement('tr');
        tr.className = current ? 'wage-row-current' : '';
        tr.innerHTML =
          '<td>' + escapeHtml(formatWageDate(w.effectiveFrom)) + '</td>' +
          '<td class="numeric">' + escapeHtml(formatWage(w.wage)) + '</td>' +
          '<td>' + (current ? '<span class="wage-badge">Vigente</span>' : '') + '</td>' +
          '<td class="wage-actions">' +
          '<button type="button" class="wage-delete" data-wage-id="' + escapeHtml(w._id) + '">Excluir</button>' +
          '</td>';
        wageTableBody.appendChild(tr);
      }
    } catch (err) {
      setMessages(wageError, wageSuccess, {
        error: err.message || 'Não foi possível carregar os salários.'
      });
    } finally {
      wageLoading.hidden = true;
    }
  }

  // ---- Criar novo salário ----------------------------------------------------
  newWageDateInput.max = todayISO();

  wageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessages(wageError, wageSuccess);

    const wage = parseWage(newWageInput.value);
    const date = newWageDateInput.value;

    if (!newWageInput.value || !date) {
      setMessages(wageError, wageSuccess, { error: 'Preencha valor e data de vigência.' });
      return;
    }

    if (!Number.isFinite(wage) || wage <= 0) {
      setMessages(wageError, wageSuccess, { error: 'Informe um salário-hora válido.' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    if (selected > today) {
      setMessages(wageError, wageSuccess, { error: 'A data de vigência não pode ser futura.' });
      return;
    }

    setLoading(wageSubmit, true, 'Cadastrar salário', 'Cadastrando…');
    try {
      await Api.createWage({ wage, date });
      setMessages(wageError, wageSuccess, { success: 'Salário cadastrado com sucesso!' });
      wageForm.reset();
      newWageDateInput.max = todayISO();
      await loadWages();
    } catch (err) {
      setMessages(wageError, wageSuccess, { error: err.message || 'Não foi possível cadastrar o salário.' });
    } finally {
      setLoading(wageSubmit, false, 'Cadastrar salário', 'Cadastrando…');
    }
  });

  // ---- Excluir salário-hora ----------------------------------------------------
  wageTableBody.addEventListener('click', async (event) => {
    const btn = event.target.closest('.wage-delete');
    if (!btn) return;

    const wageId = btn.getAttribute('data-wage-id');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Excluindo…';

    try {
      await Api.deleteWage(wageId);
      setMessages(wageError, wageSuccess, { success: 'Salário-hora deletado com sucesso!' });
      loadWages();
    } catch (err) {
      setMessages(wageError, wageSuccess, { error: err.message || 'Não foi possível excluir o salário.' });
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  loadWages();
});
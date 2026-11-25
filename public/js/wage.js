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
  // Data de hoje como YYYY-MM-DD em UTC.
  function todayISOUTC() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Converte qualquer string de data (ISO com fuso ou YYYY-MM-DD) para YYYY-MM-DD em UTC,
  // adequado para <input type="date">.
  function toDateInputValue(isoString) {
    const d = new Date(isoString);
    return d.toISOString().split('T')[0];
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
          '<button type="button" class="wage-edit" data-wage-id="' + escapeHtml(w._id) +
          '" data-wage-effectivefrom="' + escapeHtml(w.effectiveFrom) + '">Alterar vigência</button> ' +
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

  // ---- Editar vigência de salário-hora -------------------------------------------
  let editRequestInFlight = false;
  let editWageId = null;
  let editCurrentEffectiveFrom = null;

  function formatDateBR(isoString) {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d);
  }

  function openEditModal(btn) {
    if (editRequestInFlight) return;

    const wageId = btn.getAttribute('data-wage-id');
    const effectiveFrom = btn.getAttribute('data-wage-effectivefrom');
    const row = btn.closest('tr');

    editWageId = wageId;
    editCurrentEffectiveFrom = toDateInputValue(effectiveFrom);

    const wageValueCell = row.querySelector('td:nth-child(2)');
    const wageValueText = wageValueCell ? wageValueCell.textContent : '';

    const rows = Array.from(wageTableBody.querySelectorAll('tr'));
    const currentIndex = rows.indexOf(row);
    let minDate = '';
    let maxDate = todayISOUTC();

    const nextRow = rows[currentIndex - 1]; // vigência MAIS recente (maior effectiveFrom) -> define o max
    const prevRow = rows[currentIndex + 1]; // vigência MAIS antiga (menor effectiveFrom) -> define o min

    if (nextRow) {
      const nextEff = nextRow.querySelector('.wage-edit').getAttribute('data-wage-effectivefrom');
      const nextDate = new Date(nextEff);
      nextDate.setUTCDate(nextDate.getUTCDate() - 1);
      maxDate = nextDate.toISOString().split('T')[0];
    }
    if (prevRow) {
      const prevEff = prevRow.querySelector('.wage-edit').getAttribute('data-wage-effectivefrom');
      const prevDate = new Date(prevEff);
      prevDate.setUTCDate(prevDate.getUTCDate() + 1);
      minDate = prevDate.toISOString().split('T')[0];
    }

    const valueLabel = document.createElement('div');
    valueLabel.className = 'field';
    valueLabel.innerHTML =
      '<label>Valor por hora (contexto)</label>' +
      '<input type="text" disabled value="' + escapeHtml(wageValueText) +
      '" style="width:100%;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:8px;color:var(--ink-soft);">';

    const dateField = document.createElement('div');
    dateField.className = 'field';
    dateField.innerHTML =
      '<label>Nova vigência</label>' +
      '<input type="date" id="edit-wage-date" value="' + escapeHtml(toDateInputValue(effectiveFrom)) +
      '" min="' + escapeHtml(minDate) + '" max="' + escapeHtml(maxDate) + '" style="width:100%;">';

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent =
      'Mudar a vigência recalcula horas extras, turnos noturnos, compensações e dívidas do período entre a data antiga e a nova. ' +
      'A data não pode ser futura nem igual à atual, e deve ficar entre a vigência do salário anterior e do próximo.';

    const errorBox = document.createElement('div');
    errorBox.id = 'edit-wage-error';
    errorBox.className = 'error-box';
    errorBox.hidden = true;

    const modal = createModal({
      title: 'Alterar vigência do salário-hora',
      body: '',
      onClose: () => {
        editRequestInFlight = false;
        editWageId = null;
        editCurrentEffectiveFrom = null;
      }
    });

    const modalBody = modal.el.querySelector('.modal-body');
    modalBody.appendChild(valueLabel);
    modalBody.appendChild(dateField);
    modalBody.appendChild(hint);
    modalBody.appendChild(errorBox);

    const dateInput = modalBody.querySelector('#edit-wage-date');
    const errorBoxEl = modalBody.querySelector('#edit-wage-error');

    function setEditError(msg) {
      errorBoxEl.textContent = msg;
      errorBoxEl.hidden = !msg;
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'primary-button';
    confirmBtn.textContent = 'Confirmar alteração';
    confirmBtn.style.marginTop = '12px';

    confirmBtn.addEventListener('click', async () => {
      try {
        if (editRequestInFlight) return;
        if (!dateInput) {
          setEditError('Erro interno: campo de data não encontrado.');
          return;
        }
        const newDate = dateInput.value;
        if (!newDate) {
          setEditError('Informe a nova data de vigência.');
          return;
        }

        const currentMs = new Date(editCurrentEffectiveFrom).getTime();
        const newMs = new Date(newDate + 'T00:00:00Z').getTime();

        const todayMs = new Date();
        todayMs.setHours(0, 0, 0, 0);

        if (newMs === currentMs) {
          setEditError('A data é igual à vigência atual. Nada a alterar.');
          return;
        }
        if (newMs > todayMs.getTime()) {
          setEditError('A data de vigência não pode ser futura.');
          return;
        }

        const confirmModal = createModal({
          title: 'Confirmar alteração de vigência',
          body:
            '<p>De <strong>' + escapeHtml(formatDateBR(editCurrentEffectiveFrom)) +
            '</strong> para <strong>' + escapeHtml(formatDateBR(newDate)) + '</strong>.</p>' +
            '<p>Horas extras, turnos noturnos, compensações e dívidas desse período serão recalculados.</p>',
          onClose: () => { }
        });

        const confirmYes = document.createElement('button');
        confirmYes.type = 'button';
        confirmYes.className = 'primary-button';
        confirmYes.textContent = 'Sim, alterar';

        const confirmBody = confirmModal.el.querySelector('.modal-body');
        confirmBody.appendChild(confirmYes);


        confirmYes.addEventListener('click', async () => {
          confirmModal.close();

          editRequestInFlight = true;
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Atualizando…';

          const originalClose = modal.close;
          modal.close = function () { };

          try {
            const result = await Api.updateWage(editWageId, { effectiveFrom: newDate });

            modal.close = originalClose;
            modal.close();
            await loadWages();

            const parts = [];
            if (result.overtimes > 0) parts.push(result.overtimes + ' horas extras');
            if (result.nightShifts > 0) parts.push(result.nightShifts + ' turnos noturnos');
            if (result.compensations > 0) parts.push(result.compensations + ' compensações');
            if (result.debts > 0) parts.push(result.debts + ' dívidas');

            let msg = 'Vigência atualizada.';
            if (parts.length > 0) {
              msg += ' Recalculados: ' + parts.join(', ') + '.';
            }
            setMessages(wageError, wageSuccess, { success: msg });

            editRequestInFlight = false;
            editWageId = null;
            editCurrentEffectiveFrom = null;
          } catch (err) {
            modal.close = originalClose;
            setEditError(err.message || 'Não foi possível atualizar a vigência.');
            editRequestInFlight = false;
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirmar alteração';
          }
        });

        confirmModal.open();
      } catch (err) {
        setEditError(err.message || 'Erro inesperado ao abrir confirmação.');
        editRequestInFlight = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar alteração';
      }
    });

    modalBody.appendChild(confirmBtn);

    modal.open();
  }

  // ---- Excluir salário-hora ----------------------------------------------------
  wageTableBody.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('.wage-edit');
    if (editBtn) {
      openEditModal(editBtn);
      return;
    }

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
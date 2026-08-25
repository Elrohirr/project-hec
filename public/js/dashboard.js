/**
 * Lógica dos cards "A receber" do dashboard.
 *
  * Consome três endpoints agregados do backend:
 *  - GET /overtime/receivable?scope=next|total|previous
 *  - GET /nightShift/receivable?scope=next|total|previous
 *  - GET /mealvoucher/receivable?scope=next|total|previous
 *
 * As faixas de data de pagamento (payDate) são resolvidas integralmente
 * pelo backend; aqui o frontend apenas alterna o `scope` e exibe o resultado.
 * Os dados são sempre buscados frescos (sem cache em localStorage).
 */
document.addEventListener('DOMContentLoaded', () => {
  const overtimeSelect = document.getElementById('overtime-scope-select');
  const overtimeLines = document.getElementById('overtime-receivable-lines');
  const overtimeError = document.getElementById('overtime-receivable-error');

  const nightShiftSelect = document.getElementById('nightshift-scope-select');
  const nightShiftLines = document.getElementById('nightshift-receivable-lines');
  const nightShiftError = document.getElementById('nightshift-receivable-error');

  const mealVoucherSelect = document.getElementById('mealvoucher-scope-select');
  const mealVoucherLines = document.getElementById('mealvoucher-receivable-lines');
  const mealVoucherError = document.getElementById('mealvoucher-receivable-error');

  // Persistência dos escopos selecionados (sessionStorage).
  const FILTER_PAGE_KEY = 'dashboard';
  // Contadores de requisição: se o seletor for alternado rápido, somente a
  // resposta mais recente é renderizada (evita resposta fora de ordem).
  let overtimeRequestId = 0;
  let nightShiftRequestId = 0;
  let hasOvertimeData = false;
  let hasNightShiftData = false;

  let mealVoucherRequestId = 0;
  let hasMealVoucherData = false;

  // ---- Helpers de DOM -----------------------------------------------------

  function renderRow({ label, value, hint, hintBelow = false, total = false }) {
    const row = document.createElement('div');
    row.className = 'receivable-row' + (total ? ' total' : '');

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;

    let hintEl = null;
    if (hint) {
      hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = hint;
    }

    // `hintBelow` coloca a dica embaixo do rótulo (usado no card noturno),
    // deixando o valor da hora isolado à direita.
    if (hintEl && hintBelow) {
      const labelGroup = document.createElement('span');
      labelGroup.className = 'label-group';
      labelGroup.appendChild(labelEl);
      labelGroup.appendChild(hintEl);
      row.appendChild(labelGroup);
    } else {
      row.appendChild(labelEl);
    }

    const groupEl = document.createElement('span');
    groupEl.className = 'group';

    const valueEl = document.createElement('span');
    valueEl.className = 'value';
    valueEl.textContent = value;

    groupEl.appendChild(valueEl);

    if (hintEl && !hintBelow) {
      groupEl.appendChild(hintEl);
    }

    row.appendChild(groupEl);
    return row;
  }

  function renderLines(container, rows) {
    container.innerHTML = '';
    rows.forEach((row) => container.appendChild(row));
  }

  function setLoading(select, container, hasData) {
    select.disabled = true;
    // Na primeira carga exibe um aviso; nas recargas mantém o último valor
    // visível até a resposta chegar (evita "piscar" a cada troca de escopo).
    if (!hasData && !container.hasChildNodes()) {
      container.appendChild(renderRow({ label: 'Carregando…', value: '' }));
    }
  }

  function showError(box, message) {
    box.textContent = message;
    box.hidden = !message;
  }

  // ---- Card: Horas extras a receber ---------------------------------------

  function renderOvertime(distribution, values) {
    const dist = distribution || {};
    const val = values || {};

    renderLines(overtimeLines, [
      renderRow({
        label: 'HE 50%',
        value: minutesToHHMM(dist.he50),
        hint: formatCurrencyBRL(val.valueHe50)
      }),
      renderRow({
        label: 'HE 75%',
        value: minutesToHHMM(dist.he75),
        hint: formatCurrencyBRL(val.valueHe75)
      }),
      renderRow({
        label: 'HE 100%',
        value: minutesToHHMM(dist.he100),
        hint: formatCurrencyBRL(val.valueHe100)
      }),
      renderRow({
        label: 'HE Feriado',
        value: minutesToHHMM(dist.heHoliday),
        hint: formatCurrencyBRL(val.valueHeHoliday)
      }),
      renderRow({
        label: 'Total a receber',
        value: formatCurrencyBRL(val.total),
        total: true
      })
    ]);
  }

  async function loadOvertime(scope) {
    const requestId = ++overtimeRequestId;
    const scoped = scope || overtimeSelect.value;
    setLoading(overtimeSelect, overtimeLines, hasOvertimeData);
    showError(overtimeError);

    try {
      const data = await Api.getOvertimeReceivable(scoped);
      if (requestId !== overtimeRequestId) return; // resposta desatualizada
      const [distribution, values] = Array.isArray(data) ? data : [];
      hasOvertimeData = true;
      renderOvertime(distribution, values);
    } catch (err) {
      if (requestId !== overtimeRequestId) return;
      if (!hasOvertimeData) overtimeLines.innerHTML = '';
      showError(overtimeError, err.message || 'Não foi possível carregar as horas extras a receber.');
    } finally {
      if (requestId === overtimeRequestId) {
        overtimeSelect.disabled = false;
      }
    }
  }

  overtimeSelect.addEventListener('change', () => {
    saveFilterState(FILTER_PAGE_KEY, {
      overtimeScope: overtimeSelect.value,
      nightShiftScope: nightShiftSelect.value,
      mealVoucherScope: mealVoucherSelect.value
    });
    loadOvertime(overtimeSelect.value);
  });

  // ---- Card: Adicional noturno / vale-refeição a receber ------------------

  function renderNightShift(totals) {
    const safe = totals || {};

    // `nightMinutesReduced` é o valor principal porque já embute o fator legal
    // 8/7 da hora noturna (art. 73, §1º CLT) — é o formato que sai no
    // contracheque. As horas de "relógio" são exibidas como complemento.
    renderLines(nightShiftLines, [
      renderRow({
        label: 'Horas de relógio',
        value: minutesToHHMM(safe.nightMinutesClock),
        hint: 'Horário do ponto',
        hintBelow: true
      }),
      renderRow({
        label: 'Horas reduzidas',
        value: minutesToHHMM(safe.nightMinutesReduced),
        hint: 'Formato do contracheque',
        hintBelow: true
      }),
      renderRow({
        label: 'Adicional noturno',
        value: formatCurrencyBRL(safe.nightShiftValue),
        total: true
      })
    ]);
  }

  async function loadNightShift(scope) {
    const requestId = ++nightShiftRequestId;
    const scoped = scope || nightShiftSelect.value;
    setLoading(nightShiftSelect, nightShiftLines, hasNightShiftData);
    showError(nightShiftError);

    try {
      const data = await Api.getNightShiftReceivable(scoped);
      if (requestId !== nightShiftRequestId) return;
      hasNightShiftData = true;
      renderNightShift(data);
    } catch (err) {
      if (requestId !== nightShiftRequestId) return;
      if (!hasNightShiftData) nightShiftLines.innerHTML = '';
      showError(nightShiftError, err.message || 'Não foi possível carregar o adicional noturno a receber.');
    } finally {
      if (requestId === nightShiftRequestId) {
        nightShiftSelect.disabled = false;
      }
    }
  }

  nightShiftSelect.addEventListener('change', () => {
    saveFilterState(FILTER_PAGE_KEY, {
      overtimeScope: overtimeSelect.value,
      nightShiftScope: nightShiftSelect.value,
      mealVoucherScope: mealVoucherSelect.value
    });
    loadNightShift(nightShiftSelect.value);
  });

  // ---- Card: Vale-refeição a receber ------------------------------------

  function renderMealVoucher(totals) {
    const safe = totals || {};
    // O aggregate do backend retorna os totais por origem e nao inclui um
    // campo `total`; a soma e calculada aqui no frontend.
    const overtimeVales = Number(safe.mealVoucherOvertime) || 0;
    const nightShiftVales = Number(safe.mealVoucherNightShift) || 0;

    renderLines(mealVoucherLines, [
      renderRow({
        label: 'Vales (Hora extra)',
        value: formatCurrencyBRL(overtimeVales)
      }),
      renderRow({
        label: 'Vales (Turno noturno)',
        value: formatCurrencyBRL(nightShiftVales)
      }),
      renderRow({
        label: 'Total a receber',
        value: formatCurrencyBRL(overtimeVales + nightShiftVales),
        total: true
      })
    ]);
  }

  async function loadMealVoucher(scope) {
    const requestId = ++mealVoucherRequestId;
    const scoped = scope || mealVoucherSelect.value;
    setLoading(mealVoucherSelect, mealVoucherLines, hasMealVoucherData);
    showError(mealVoucherError);

    try {
      const data = await Api.getMealVoucherReceivable(scoped);
      if (requestId !== mealVoucherRequestId) return;
      hasMealVoucherData = true;
      renderMealVoucher(data);
    } catch (err) {
      if (requestId !== mealVoucherRequestId) return;
      if (!hasMealVoucherData) mealVoucherLines.innerHTML = '';
      showError(mealVoucherError, err.message || 'Não foi possível carregar os vales a receber.');
    } finally {
      if (requestId === mealVoucherRequestId) {
        mealVoucherSelect.disabled = false;
      }
    }
  }

  mealVoucherSelect.addEventListener('change', () => {
    saveFilterState(FILTER_PAGE_KEY, {
      overtimeScope: overtimeSelect.value,
      nightShiftScope: nightShiftSelect.value,
      mealVoucherScope: mealVoucherSelect.value
    });
    loadMealVoucher(mealVoucherSelect.value);
  });

  // ---- Carga inicial ------------------------------------------------------ 
  // Restaura escopos salvos antes da primeira carga.
  const dashboardState = getFilterState(FILTER_PAGE_KEY);
  if (dashboardState) {
    if (dashboardState.overtimeScope) overtimeSelect.value = dashboardState.overtimeScope;
    if (dashboardState.nightShiftScope) nightShiftSelect.value = dashboardState.nightShiftScope;
    if (dashboardState.mealVoucherScope) mealVoucherSelect.value = dashboardState.mealVoucherScope;
  }

  loadOvertime(overtimeSelect.value);
  loadNightShift(nightShiftSelect.value);
  loadMealVoucher(mealVoucherSelect.value);
});
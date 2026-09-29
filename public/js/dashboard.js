/**
 * Lógica dos cards "A receber" do dashboard.
 *
 * Consome um único endpoint agregado do backend:
 *  - GET /receivables?scope=current|total|previous
 *
 * A resposta traz os quatro agregados filtrados pelo MESMO scope:
 *  - overtimeReceivables: distribuição/valores (bruto) das horas extras
 *  - overtimeNetReceivables: descontos por tier e líquido das horas extras
 *  - nightShiftReceivables: adicional noturno
 *  - mealVoucherReceivables: vales por origem
 *
 * O frontend apenas alterna o scope do seletor único e popula os quatro
 * cards a partir da mesma resposta. Comportamento esperado do backend:
 * qualquer scope fora de previous/current (incl. total) cae no fallback
 * "tudo a partir do mês atual, sem limite superior" — exibido sem erro.
 */
document.addEventListener('DOMContentLoaded', () => {
  const scopeSelect = document.getElementById('receivables-scope-select');
  const receivablesError = document.getElementById('receivables-error');

  const overtimeLines = document.getElementById('overtime-receivable-lines');
  const overtimeLiquidLines = document.getElementById('overtime-liquid-receivable-lines');
  const nightShiftLines = document.getElementById('nightshift-receivable-lines');
  const mealVoucherLines = document.getElementById('mealvoucher-receivable-lines');

  const liquidInfoButton = document.getElementById('liquid-info-button');

  // ---- Explicação do card "Horas extras – Líquido" --------------------------
  // O "?" abre o modal de ajuda (o mesmo componente usado no botão "Novidades").
  liquidInfoButton?.addEventListener('click', () => {
    const modal = createModal({
      title: 'Horas extras – Líquido',
      body: 'Valor após desconto de compensações do banco de horas.'
    });
    modal.open();
  });

  // Persistência do escopo selecionado (sessionStorage).
  const FILTER_PAGE_KEY = 'dashboard';
  // Contador de requisição: se o seletor for alternado rápido, somente a
  // resposta mais recente é renderizada (evita respostas fora de ordem).
  let requestId = 0;
  let hasData = false;

  // ---- Helpers de DOM -----------------------------------------------------

  function renderRow({ label, value, hint, hintBelow = false, total = false, subnote = '' }) {
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

    // Linha pequena e discreta abaixo da linha principal (ex.: compensação no banco).
    if (subnote) {
      const subnoteEl = document.createElement('div');
      subnoteEl.className = 'receivable-subnote';
      subnoteEl.textContent = subnote;
      row.appendChild(subnoteEl);
    }

    return row;
  }

  function renderLines(container, rows) {
    container.innerHTML = '';
    rows.forEach((row) => container.appendChild(row));
  }

  function setLoading(isLoading) {
    scopeSelect.disabled = isLoading;
    // Na primeira carga mostra um aviso; nas recargas mantém o último valor
    // visível até a resposta chegar (evita "piscar" a cada troca de escopo).
    if (isLoading && !hasData) {
      const placeholder = [renderRow({ label: 'Carregando…' })];
      const containers = [overtimeLines, overtimeLiquidLines, nightShiftLines, mealVoucherLines];
      containers.forEach((container) => renderLines(container, placeholder));
    }
  }

  function showError(message) {
    if (message) {
      receivablesError.textContent = message;
      receivablesError.hidden = false;
    } else {
      receivablesError.textContent = '';
      receivablesError.hidden = true;
    }
  }
  // ---- Card: Horas extras (bruto) -----------------------------------------

  function renderOvertimeBruto(data) {
    const safe = data || {};
    const distribution = safe.distribution || {};
    const values = safe.values || {};

    const he100Minutes = Number(distribution.he100) || 0;
    const heHolidayMinutes = Number(distribution.heHoliday) || 0;
    const valueHe100 = Number(values.valueHe100) || 0;
    const valueHeHoliday = Number(values.valueHeHoliday) || 0;

    renderLines(overtimeLines, [
      renderRow({
        label: 'HE 50%',
        value: hoursWithDecimal(distribution.he50),
        hint: formatCurrencyBRL(values.valueHe50)
      }),
      renderRow({
        label: 'HE 75%',
        value: hoursWithDecimal(distribution.he75),
        hint: formatCurrencyBRL(values.valueHe75)
      }),
      renderRow({
        label: 'HE 100%',
        value: hoursWithDecimal(he100Minutes - heHolidayMinutes),
        hint: formatCurrencyBRL(valueHe100 - valueHeHoliday)
      }),
      renderRow({
        label: 'HE Feriado',
        value: hoursWithDecimal(heHolidayMinutes),
        hint: formatCurrencyBRL(valueHeHoliday)
      }),
      renderRow({
        label: 'Total bruto',
        value: formatCurrencyBRL(values.total),
        total: true
      })
    ]);
  }

  // ---- Card: Horas extras (líquido) ---------------------------------------

  function renderOvertimeLiquido(data, grossData) {
    const safe = data || {};
    const gross = grossData || {};
    const grossDistribution = gross.distribution || {};
    const grossValues = gross.values || {};

    // Minutos compensados por tier são derivados da diferença bruto − líquido
    // (ambos já vêm do endpoint /receivables — apenas exibição, sem API nova).
    const compensatedMinutes = (grossMinutes, netMinutes) =>
      Math.max(0, Number(grossMinutes || 0) - Number(netMinutes || 0));

    const tiers = [
      {
        label: 'HE 50%',
        netMinutes: safe.netHe50minutes,
        netValue: Number(grossValues.valueHe50 || 0) - Number(safe.valueLost50 || 0),
        compensated: compensatedMinutes(grossDistribution.he50, safe.netHe50minutes)
      },
      {
        label: 'HE 75%',
        netMinutes: safe.netHe75minutes,
        netValue: Number(grossValues.valueHe75 || 0) - Number(safe.valueLost75 || 0),
        compensated: compensatedMinutes(grossDistribution.he75, safe.netHe75minutes)
      },
      {
        label: 'HE 100%',
        netMinutes: safe.netHe100minutes,
        netValue: Number(grossValues.valueHe100 || 0) - Number(safe.valueLost100 || 0),
        compensated: compensatedMinutes(grossDistribution.he100, safe.netHe100minutes)
      }
    ];

    // Mesmo formato do card Bruto: "HE X%" + HH:MM (X,XXh) + R$ líquido do tier.
    const rows = tiers.map((tier) =>
      renderRow({
        label: tier.label,
        value: hoursWithDecimal(tier.netMinutes),
        hint: formatCurrencyBRL(tier.netValue),
        subnote: tier.compensated > 0
          ? `−${minutesToHHMM(tier.compensated)} compensado no banco`
          : ''
      })
    );

    rows.push(renderRow({
      label: 'Total líquido',
      value: formatCurrencyBRL(safe.overtimeNetReceivable),
      total: true
    }));

    renderLines(overtimeLiquidLines, rows);
  }

  // ---- Card: Adicional noturno ----------------------------------------------

  function renderNightShift(totals) {
    const safe = totals || {};

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

  // ---- Card: Vale-refeição ---------------------------------------------------

  function renderMealVoucher(totals) {
    const safe = totals || {};
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
  // ---- Requisição única ------------------------------------------------------

  async function fetchReceivables(scope) {
    const currentRequest = ++requestId;
    const scoped = scope || scopeSelect.value;
    setLoading(true);

    try {
      const data = await Api.getReceivables(scoped);
      if (currentRequest !== requestId) return; // resposta desatualizada
      hasData = true;
      renderOvertimeBruto(data?.overtimeReceivables);
      renderOvertimeLiquido(data?.overtimeNetReceivables, data?.overtimeReceivables);
      renderNightShift(data?.nightShiftReceivables);
      renderMealVoucher(data?.mealVoucherReceivables);
    } catch (err) {
      if (currentRequest !== requestId) return;
      if (!hasData) {
        [overtimeLines, overtimeLiquidLines, nightShiftLines, mealVoucherLines]
          .forEach((container) => renderLines(container, []));
      }
      showError(err.message || 'Não foi possível carregar os valores a receber.');
    } finally {
      if (currentRequest === requestId) {
        scopeSelect.disabled = false;
      }
    }
  }

  scopeSelect.addEventListener('change', () => {
    saveFilterState(FILTER_PAGE_KEY, { receivablesScope: scopeSelect.value });
    fetchReceivables(scopeSelect.value);
  });

  // ---- Carga inicial --------------------------------------------------------
  // Restaura o escopo salvo antes da primeira carga (migrado da chave antiga).
  const dashboardState = getFilterState(FILTER_PAGE_KEY);
  if (dashboardState && dashboardState.receivablesScope) {
    scopeSelect.value = dashboardState.receivablesScope;
  }

  fetchReceivables(scopeSelect.value);
});
const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CHART_MODO_HORAS = 'horas';
const CHART_MODO_VALORES = 'valores';

let chartHorasMes = null;
/** Resposta bruta da API (12 itens { month, minutes, values }). Reuso ao trocar só o modo. */
let respostaGrafico = [];
let chartModo = CHART_MODO_HORAS;
let chartAnoAtual = null;
let chartRequestId = 0;

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function modoGraficoValido(modo) {
  return modo === CHART_MODO_VALORES ? CHART_MODO_VALORES : CHART_MODO_HORAS;
}

/** "XhYY" no tooltip (ex.: 490 min -> "8h10"). Recebe horas decimais. */
function formatarHorasTooltip(horasDecimais) {
  const totalMin = Math.max(0, Math.round((Number(horasDecimais) || 0) * 60));
  const h = Math.floor(totalMin / 60);
  const m = String(totalMin % 60).padStart(2, '0');
  return `${h}h${m}`;
}

function formatarValorGrafico(valor, modo) {
  if (modo === CHART_MODO_VALORES) return formatadorBRL.format(Number(valor) || 0);
  return formatarHorasTooltip(valor);
}

/** 4 arrays de 12 posições (índice = month - 1). Horas: minutes/60. Valores: values direto. */
function extrairSeries(resposta, modo) {
  const series = { he50: Array(12).fill(0), he75: Array(12).fill(0), he100: Array(12).fill(0), holiday: Array(12).fill(0) };
  (resposta || []).forEach((item) => {
    const idx = Number(item?.month) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx > 11) return;
    if (modo === CHART_MODO_VALORES) {
      const v = item?.values || {};
      series.he50[idx] = Number(v.he50 ?? 0) || 0;
      series.he75[idx] = Number(v.he75 ?? 0) || 0;
      series.he100[idx] = Number(v.he100 ?? 0) || 0;
      series.holiday[idx] = Number(v.holiday ?? 0) || 0;
    } else {
      const m = item?.minutes || {};
      const paraHoras = (min) => Math.round(((Number(min ?? 0) || 0) / 60) * 100) / 100;
      series.he50[idx] = paraHoras(m.he50);
      series.he75[idx] = paraHoras(m.he75);
      series.he100[idx] = paraHoras(m.he100);
      series.holiday[idx] = paraHoras(m.holiday);
    }
  });
  return series;
}

function somarMeses(series) {
  return MESES_LABELS.map((_, i) => {
    const total = (Number(series.he50[i]) || 0) + (Number(series.he75[i]) || 0)
      + (Number(series.he100[i]) || 0) + (Number(series.holiday[i]) || 0);
    return Math.round(total * 100) / 100;
  });
}

function acumular(valores) {
  let total = 0;
  return (valores || []).map((valor) => {
    total = Math.round((total + (Number(valor) || 0)) * 100) / 100;
    return total;
  });
}

function lerCssVar(nome, fallback, elemento) {
  const alvo = elemento || document.documentElement;
  const valor = getComputedStyle(alvo).getPropertyValue(nome);
  const normalizado = (valor || '').trim();
  return normalizado || fallback;
}

/** Cores das faixas ficam escopadas em .chart-card (não colidem com --line global da grade). */
function elementoCoresGrafico() {
  const canvas = document.getElementById('chartHorasMes');
  const card = canvas ? canvas.closest('.chart-card') : null;
  return card || document.documentElement;
}

function montarDados(modo) {
  const el = elementoCoresGrafico();
  const cores = {
    he50: lerCssVar('--t50', '#4f46e5', el),
    he75: lerCssVar('--t75', '#0284c7', el),
    he100: lerCssVar('--t100', '#d97706', el),
    holiday: lerCssVar('--tfer', '#dc2626', el),
    linha: lerCssVar('--tline', '#111827', el)
  };
  const series = extrairSeries(respostaGrafico, modo);
  const totais = somarMeses(series);
  const acumulados = acumular(totais);
  const barra = (label, data, cor) => ({
    type: 'bar', label, data, yAxisID: 'y', order: 2, backgroundColor: cor, stack: 'faixas'
  });
  return {
    labels: MESES_LABELS,
    datasets: [
      barra('50%', series.he50, cores.he50),
      barra('75%', series.he75, cores.he75),
      barra('100%', series.he100, cores.he100),
      barra('100% feriado', series.holiday, cores.holiday),
      {
        type: 'line', label: 'Acumulado', data: acumulados, yAxisID: 'yAcum', order: 1,
        borderColor: cores.linha, backgroundColor: cores.linha, tension: 0.3
      }
    ]
  };
}

function montarOpcoes(modo) {
  const corTexto = lerCssVar('--text', '#161f2b');
  const corGrade = lerCssVar('--line', '#d8dcd3');
  const tituloY = modo === CHART_MODO_VALORES ? 'Valor líquido no mês (R$)' : 'Horas no mês';
  const noEixo = (v) => (modo === CHART_MODO_VALORES
    ? formatadorBRL.format(Number(v) || 0)
    : String(v ?? 0));
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: corTexto } },
      tooltip: {
        callbacks: {
          label(ctx) {
            return `${ctx.dataset?.label || ''}: ${formatarValorGrafico(ctx.parsed?.y, modo)}`;
          },
          footer(items) {
            if (!items || !items.length) return '';
            const idx = items[0].dataIndex;
            const sets = items[0].chart?.data?.datasets || [];
            let total = 0;
            sets.forEach((ds) => {
              if (ds?.yAxisID !== 'y') return;
              total += Number(ds?.data?.[idx]) || 0;
            });
            total = Math.round(total * 100) / 100;
            return `Total do mês: ${formatarValorGrafico(total, modo)}`;
          }
        }
      }
    },
    scales: {
      x: { stacked: true, ticks: { color: corTexto }, grid: { color: corGrade } },
      y: {
        stacked: true, beginAtZero: true,
        title: { display: true, text: tituloY, color: corTexto },
        ticks: { color: corTexto, callback: noEixo }, grid: { color: corGrade }
      },
      yAcum: {
        stacked: false, position: 'right', beginAtZero: true,
        title: { display: true, text: 'Acumulado', color: corTexto },
        ticks: { color: corTexto, callback: noEixo }, grid: { drawOnChartArea: false }
      }
    }
  };
}

function atualizarTextosGrafico(modo) {
  const titulo = document.getElementById('chart-horas-heading');
  if (titulo) {
    titulo.textContent = modo === CHART_MODO_VALORES
      ? 'Valor líquido recebido por mês'
      : 'Horas extras realizadas por mês';
  }
  const hint = document.getElementById('chart-horas-hint');
  if (hint) {
    hint.textContent = modo === CHART_MODO_VALORES
      ? 'Mês do pagamento (valor líquido, já descontado o banco de horas).'
      : 'Mês de realização (quando a hora extra foi feita).';
  }
}

function renderGrafico() {
  const canvas = document.getElementById('chartHorasMes');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    const erro = document.getElementById('chart-horas-error');
    if (erro) {
      erro.textContent = 'Não foi possível carregar o gráfico (Chart.js indisponível).';
      erro.hidden = false;
    }
    return;
  }
  atualizarTextosGrafico(chartModo);
  const dados = montarDados(chartModo);
  const opcoes = montarOpcoes(chartModo);
  if (chartHorasMes) {
    chartHorasMes.data = dados;
    chartHorasMes.options = opcoes;
    chartHorasMes.update();
    return;
  }
  chartHorasMes = new Chart(canvas, { type: 'bar', data: dados, options: opcoes });
}

async function carregarChartHorasMes(ano) {
  const erroBox = document.getElementById('chart-horas-error');
  const anoNumero = Number(ano);
  if (!Number.isInteger(anoNumero)) return;
  if (anoNumero === chartAnoAtual && respostaGrafico.length) {
    renderGrafico();
    return;
  }
  const atual = ++chartRequestId;
  try {
    const bruto = await Api.getOvertimeMonthlyTotals(anoNumero);
    if (atual !== chartRequestId) return;
    const lista = Array.isArray(bruto) ? bruto : (bruto?.totals || bruto?.data || []);
    respostaGrafico = Array.isArray(lista) ? lista : [];
    chartAnoAtual = anoNumero;
    renderGrafico();
    if (erroBox) {
      erroBox.textContent = '';
      erroBox.hidden = true;
    }
  } catch (err) {
    if (atual !== chartRequestId) return;
    if (erroBox) {
      erroBox.textContent = err?.message || 'Não foi possível carregar o gráfico de horas extras.';
      erroBox.hidden = false;
      erroBox.scrollIntoView({ block: 'nearest' });
    }
  }
}

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
    persistirEstadoDashboard();
    fetchReceivables(scopeSelect.value);
  });

  // ---- Gráfico "Horas extras por mês" --------------------------------------
  const chartYearSelect = document.getElementById('chart-year-select');

  function anoPadraoChart() {
    return new Date().getFullYear();
  }

  function anoValidoChart(valor) {
    const ano = Number(valor);
    return Number.isInteger(ano) ? ano : anoPadraoChart();
  }

  function preencherAnosChart(anoSelecionado) {
    if (!chartYearSelect) return;
    const atual = anoPadraoChart();
    const salvo = Number(anoSelecionado);
    // Janela fixa ao redor do ano corrente: o ano corrente precisa estar
    // sempre disponível. Antes a janela era montada ao redor do ano salvo,
    // então um chartYear obsoleto (ex.: 2020) prendia o select em 2022–2018
    // sem opção de voltar ao ano corrente — gráfico vazio persistente.
    // Anos salvos fora da janela são considerados obsoletos e descartados.
    const anos = [];
    for (let i = 2; i >= -3; i -= 1) anos.push(atual + i);
    const base = (Number.isInteger(salvo) && anos.includes(salvo)) ? salvo : atual;
    chartYearSelect.innerHTML = '';
    anos.forEach((ano) => {
      const opt = document.createElement('option');
      opt.value = String(ano);
      opt.textContent = String(ano);
      chartYearSelect.appendChild(opt);
    });
    chartYearSelect.value = String(base);
  }

  function lerEstadoDashboard() {
    return getFilterState(FILTER_PAGE_KEY) || {};
  }

  function persistirEstadoDashboard() {
    saveFilterState(FILTER_PAGE_KEY, {
      ...lerEstadoDashboard(),
      receivablesScope: scopeSelect.value,
      chartYear: chartYearSelect ? chartYearSelect.value : undefined,
      chartMode: chartModo
    });
  }

  // ---- Gráfico: seletor Horas | Valores (segmentado, sem nova requisição) ----
  const chartModeHoras = document.getElementById('chart-mode-horas');
  const chartModeValores = document.getElementById('chart-mode-valores');

  function sincronizarBotoesModo() {
    if (chartModeHoras) chartModeHoras.setAttribute('aria-pressed', String(chartModo === CHART_MODO_HORAS));
    if (chartModeValores) chartModeValores.setAttribute('aria-pressed', String(chartModo === CHART_MODO_VALORES));
  }

  function trocarModoGrafico(novoModo) {
    const modo = modoGraficoValido(novoModo);
    if (modo === chartModo) {
      sincronizarBotoesModo();
      return;
    }
    chartModo = modo; // só o modo: reusa respostaGrafico, sem fetch
    sincronizarBotoesModo();
    persistirEstadoDashboard();
    renderGrafico();
  }

  chartModeHoras?.addEventListener('click', () => trocarModoGrafico(CHART_MODO_HORAS));
  chartModeValores?.addEventListener('click', () => trocarModoGrafico(CHART_MODO_VALORES));

  if (chartYearSelect) {
    const estadoInicial = lerEstadoDashboard();
    preencherAnosChart(estadoInicial.chartYear);
    chartModo = modoGraficoValido(estadoInicial.chartMode);
    sincronizarBotoesModo();
    chartYearSelect.addEventListener('change', () => {
      persistirEstadoDashboard();
      carregarChartHorasMes(anoValidoChart(chartYearSelect.value));
    });
  } else {
    sincronizarBotoesModo();
  }

  window.addEventListener('hourflow:theme-changed', () => {
    if (respostaGrafico.length) renderGrafico(); // relê getComputedStyle, sem fetch
  });

  // ---- Carga inicial --------------------------------------------------------
  // Restaura o escopo salvo antes da primeira carga (migrado da chave antiga).
  const dashboardState = lerEstadoDashboard();
  if (dashboardState && dashboardState.receivablesScope) {
    scopeSelect.value = dashboardState.receivablesScope;
  }

  fetchReceivables(scopeSelect.value);
  carregarChartHorasMes(
    chartYearSelect ? anoValidoChart(chartYearSelect.value) : anoPadraoChart()
  );
});
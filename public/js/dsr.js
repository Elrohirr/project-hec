document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('dsr-year');
  const tableBody = document.getElementById('dsr-table-body');
  const loading = document.getElementById('dsr-loading');
  const errorBox = document.getElementById('dsr-error');
  const dsrSection = document.getElementById('dsr-section');
  const feriadosSection = document.getElementById('feriados-section');
  const feriadosTableBody = document.getElementById('feriados-table-body');
  const feriadosLoading = document.getElementById('feriados-loading');
  const feriadosEmpty = document.getElementById('feriados-empty');
  const feriadosError = document.getElementById('feriados-error');

  // Mesma janela do gráfico do dashboard: atual+2 até atual-3, em ordem decrescente.
  // Retorna o ano efetivo (o da URL, se estiver na janela; senão, o ano atual).
  function preencherAnos(anoSolicitado) {
    const atual = new Date().getFullYear();
    const anos = [];
    for (let i = 2; i >= -3; i -= 1) anos.push(atual + i);

    const base = anos.includes(anoSolicitado) ? anoSolicitado : atual;

    yearSelect.innerHTML = '';
    anos.forEach((ano) => {
      const opt = document.createElement('option');
      opt.value = String(ano);
      opt.textContent = String(ano);
      yearSelect.appendChild(opt);
    });
    yearSelect.value = String(base);
    return base;
  }

  // Função para obter o ano da query string, com fallback para ano atual
  function getYearFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const yearParam = params.get('year');
    if (yearParam) {
      const yearNum = Number(yearParam);
      if (Number.isInteger(yearNum) && yearNum > 0) {
        return yearNum;
      }
    }
    return new Date().getFullYear();
  }

  // Função para definir o ano na query string
  function setYearInQuery(ano) {
    const params = new URLSearchParams();
    params.set('year', ano);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  }

  // Função para formatar mês referência em MM/AAAA
  function formatReferenceMonth(mesPagamento, ano) {
    // Mês de referência é o mês anterior ao do pagamento
    // Para janeiro (mes=1), referência é dezembro do ano anterior
    if (mesPagamento === 1) {
      const month = 12;
      const year = ano - 1;
      return `${String(month).padStart(2, '0')}/${year}`;
    }
    const month = mesPagamento - 1;
    const year = ano;
    return `${String(month).padStart(2, '0')}/${year}`;
  }

  // Função para formatar valor monetário (mesmo padrão das outras páginas)
  function formatCurrency(value) {
    return formatCurrencyBRL(value);
  }

  // Função para atualizar a cor do dsrValue baseado no tema
  function atualizarCorDsrValue(tdElement) {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      tdElement.style.color = 'var(--teal)';
    } else {
      tdElement.style.color = 'var(--amber-ink)';
    }
  }

  // Função para carregar os dados DSR
  async function carregarDSR(ano) {
    setYearInQuery(ano);
    loading.hidden = false;
    errorBox.hidden = true;
    tableBody.innerHTML = '';

    try {
      const response = await Api.request(`/dsr?year=${ano}`);
      if (!Array.isArray(response) || response.length === 0) {
        // Sem dados - tabela vazia, mas não mostramos "nenhum dado disponível"
        // Apenas garantimos que o tbody fique vazio
        return;
      }

      // Renderizar 12 linhas (um por mês)
      response.forEach((item) => {
        const mesPagamento = item.month; // 1 a 12
        const mesRef = formatReferenceMonth(mesPagamento, ano);

        const tr = document.createElement('tr');

        // Célula: Mês de pagamento
        const tdMesPagamento = document.createElement('td');
        tdMesPagamento.textContent = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][mesPagamento];
        tr.appendChild(tdMesPagamento);

        // Célula: Mês Referência (MM/AAAA)
        const tdMesReferencia = document.createElement('td');
        tdMesReferencia.textContent = mesRef;
        tr.appendChild(tdMesReferencia);

        // Célula: referenceDaysInMonth
        const tdReferenceDays = document.createElement('td');
        tdReferenceDays.className = 'numeric';
        tdReferenceDays.textContent = item.referenceDaysInMonth;
        tr.appendChild(tdReferenceDays);

        // Célula: referenceDsrDays
        const tdReferenceDsrDays = document.createElement('td');
        tdReferenceDsrDays.className = 'numeric';
        tdReferenceDsrDays.textContent = item.referenceDsrDays;
        tr.appendChild(tdReferenceDsrDays);

        // Célula: referenceWorkingDays
        const tdReferenceWorkingDays = document.createElement('td');
        tdReferenceWorkingDays.className = 'numeric';
        tdReferenceWorkingDays.textContent = item.referenceWorkingDays;
        tr.appendChild(tdReferenceWorkingDays);

        // Célula: overtimeValue (R$)
        const tdOvertimeValue = document.createElement('td');
        tdOvertimeValue.className = 'numeric';
        tdOvertimeValue.textContent = formatCurrency(item.overtimeValue);
        tr.appendChild(tdOvertimeValue);

        // Célula: nightShiftValue (R$)
        const tdNightShiftValue = document.createElement('td');
        tdNightShiftValue.className = 'numeric';
        tdNightShiftValue.textContent = formatCurrency(item.nightShiftValue);
        tr.appendChild(tdNightShiftValue);

        // Célula: dsrValue (R$) - com destaque visual leve
        const tdDsrValue = document.createElement('td');
        tdDsrValue.className = 'numeric';
        tdDsrValue.textContent = formatCurrency(item.dsrValue);
        tdDsrValue.style.fontWeight = '500';
        // Cor baseada no tema: --teal no dark mode, --amber-ink no light mode
        atualizarCorDsrValue(tdDsrValue);
        tr.appendChild(tdDsrValue);

        tableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar DSR:', err);
      errorBox.textContent = err.message || 'Não foi possível carregar os dados DSR. Tente novamente em instantes.';
      errorBox.hidden = false;
    } finally {
      loading.hidden = true;
    }
  }

  // Função para carregar os feriados do ano selecionado
  async function carregarFeriados(ano) {
    feriadosLoading.hidden = false;
    feriadosError.hidden = true;
    feriadosEmpty.hidden = true;
    feriadosTableBody.innerHTML = '';

    try {
      const response = await Api.request(`/dsr/holidays?year=${ano}`);
      const entries = Object.entries(response || {});

      if (entries.length === 0) {
        feriadosEmpty.hidden = false;
        return;
      }

      // Ordena pela data: YYYY-MM-DD ordena corretamente como string
      entries.sort((a, b) => a[0].localeCompare(b[0]));

      for (const [dataISO, nome] of entries) {
        const [anoStr, mesStr, diaStr] = dataISO.split('-');
        const anoNum = Number(anoStr);
        const mesNum = Number(mesStr);
        const diaNum = Number(diaStr);

        // Constrói a data localmente para evitar problemas de fuso horário
        const dataLocal = new Date(anoNum, mesNum - 1, diaNum);
        const diaSemana = dataLocal.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataBR = `${String(diaNum).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${anoStr}`;

        const tr = document.createElement('tr');

        // Célula: Data (com tag discreta quando cair em domingo)
        const tdData = document.createElement('td');
        tdData.textContent = dataBR;
        if (dataLocal.getDay() === 0) {
          const tagDomingo = document.createElement('span');
          tagDomingo.className = 'feriado-domingo';
          tagDomingo.textContent = 'domingo';
          tdData.appendChild(document.createTextNode(' '));
          tdData.appendChild(tagDomingo);
        }
        tr.appendChild(tdData);

        // Célula: Dia da semana
        const tdDiaSemana = document.createElement('td');
        tdDiaSemana.textContent = diaSemana;
        tr.appendChild(tdDiaSemana);

        // Célula: Nome do feriado
        const tdNome = document.createElement('td');
        tdNome.textContent = nome;
        tr.appendChild(tdNome);

        feriadosTableBody.appendChild(tr);
      }
    } catch (err) {
      console.error('Erro ao carregar feriados:', err);
      feriadosError.textContent = err.message || 'Não foi possível carregar os feriados. Tente novamente em instantes.';
      feriadosError.hidden = false;
    } finally {
      feriadosLoading.hidden = true;
    }
  }

  // Alterna entre as abas DSR e Feriados
  function alternarAba(nomeAba) {
    const tabs = document.querySelectorAll('.dsr-tab');
    tabs.forEach((tab) => {
      const ativo = tab.dataset.tab === nomeAba;
      tab.classList.toggle('active', ativo);
      tab.setAttribute('aria-selected', ativo);
    });

    if (nomeAba === 'feriados') {
      dsrSection.hidden = true;
      feriadosSection.hidden = false;
    } else {
      dsrSection.hidden = false;
      feriadosSection.hidden = true;
    }
  }

  // Event listener para seleção de ano (controla ambas as abas)
  yearSelect.addEventListener('change', () => {
    const ano = Number(yearSelect.value);
    carregarDSR(ano);
    carregarFeriados(ano);
  });

  // Event listeners das abas
  document.querySelectorAll('.dsr-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      alternarAba(tab.dataset.tab);
      if (tab.dataset.tab === 'feriados') {
        carregarFeriados(Number(yearSelect.value));
      }
    });
  });

  // Carregamento inicial: ler ano da query string ou usar ano atual
  const anoInicial = preencherAnos(getYearFromQuery());
  carregarDSR(anoInicial);
  carregarFeriados(anoInicial);
});
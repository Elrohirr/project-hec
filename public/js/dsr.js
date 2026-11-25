document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('dsr-year');
  const tableBody = document.getElementById('dsr-table-body');
  const loading = document.getElementById('dsr-loading');
  const errorBox = document.getElementById('dsr-error');

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

  // Event listener para seleção de ano
  yearSelect.addEventListener('change', () => {
    carregarDSR(Number(yearSelect.value));
  });

  // Carregamento inicial: ler ano da query string ou usar ano atual
  const anoInicial = preencherAnos(getYearFromQuery());
  carregarDSR(anoInicial);
});
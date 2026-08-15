document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('mealvoucher-table-body');
  const emptyState = document.getElementById('empty-state');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPageButton = document.getElementById('prev-page-button');
  const nextPageButton = document.getElementById('next-page-button');
  const sourceFilter = document.getElementById('source-filter');
  const filterPayMonthStart = document.getElementById('filter-pay-month-start');
  const filterPayMonthEnd = document.getElementById('filter-pay-month-end');
  const filterSort = document.getElementById('filter-sort');
  const applyFiltersButton = document.getElementById('apply-filters-button');
  const clearFiltersButton = document.getElementById('clear-filters-button');

  const summaryCount = document.getElementById('summary-count');
  const summarySubtotal = document.getElementById('summary-subtotal');

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  // timeZone: 'UTC' evita que o navegador mostre um dia a menos
  // (o backend salva as datas como UTC meia-noite).
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

  const payDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    month: '2-digit',
    year: 'numeric'
  });

  const sourceLabels = {
    overtime: 'Hora extra',
    nightShift: 'Turno noturno'
  };

  let currentPage = 1;
  let totalPages = 1;

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function formatPayDate(isoString) {
    if (!isoString) return '—';
    return payDateFormatter.format(new Date(isoString));
  }

  function monthStartDate(monthValue) {
    return `${monthValue}-01`;
  }

  function monthEndDate(monthValue) {
    const [year, month] = monthValue.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthValue}-${String(lastDay).padStart(2, '0')}`;
  }

  function getActiveFilters() {
    const filters = {};
    if (sourceFilter.value) filters.source = sourceFilter.value;
    if (filterPayMonthStart.value) filters.startPayDate = monthStartDate(filterPayMonthStart.value);
    if (filterPayMonthEnd.value) filters.endPayDate = monthEndDate(filterPayMonthEnd.value);
    if (filterSort.value) filters.sort = filterSort.value;
    return filters;
  }

  function renderRow(voucher) {
    const tr = document.createElement('tr');
    const sourceLabel = sourceLabels[voucher.source] || voucher.source;

    tr.innerHTML = `
      <td>${formatDate(voucher.date)}</td>
      <td><span class="source-tag">${sourceLabel}</span></td>
      <td>${voucher.ruleCode}</td>
      <td class="numeric">${voucher.quantity}</td>
      <td class="numeric">${currencyFormatter.format(voucher.unitValue)}</td>
      <td class="numeric">${currencyFormatter.format(voucher.totalValue)}</td>
      <td>${formatPayDate(voucher.payDate)}</td>
    `;
    return tr;
  }

  function renderTable(vouchers) {
    tableBody.innerHTML = '';
    if (!vouchers.length) {
      emptyState.hidden = false;
      summaryCount.textContent = '0';
      summarySubtotal.textContent = currencyFormatter.format(0);
      return;
    }
    emptyState.hidden = true;
    vouchers.forEach((voucher) => tableBody.appendChild(renderRow(voucher)));

    const subtotal = vouchers.reduce((sum, voucher) => sum + (voucher.totalValue || 0), 0);
    summaryCount.textContent = String(vouchers.length);
    summarySubtotal.textContent = currencyFormatter.format(subtotal);
  }

  async function loadMealVouchers(page = 1) {
    try {
      const data = await Api.getMealVouchers({ page, limit: 10, ...getActiveFilters() });
      currentPage = data.currentPage || page;
      totalPages = data.numberOfPages || 1;

      renderTable(data.mealVoucher || []);

      pageIndicator.textContent = `Página ${currentPage} de ${totalPages} · ${data.totalRecords} registro(s)`;
      prevPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;
    } catch (err) {
      emptyState.hidden = false;
      emptyState.textContent = err.message || 'Não foi possível carregar os vales.';
    }
  }

  applyFiltersButton.addEventListener('click', () => loadMealVouchers(1));

  clearFiltersButton.addEventListener('click', () => {
    sourceFilter.value = '';
    filterPayMonthStart.value = '';
    filterPayMonthEnd.value = '';
    filterSort.value = '-date';
    loadMealVouchers(1);
  });

  prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) loadMealVouchers(currentPage - 1);
  });

  nextPageButton.addEventListener('click', () => {
    if (currentPage < totalPages) loadMealVouchers(currentPage + 1);
  });

  loadMealVouchers(1);
});

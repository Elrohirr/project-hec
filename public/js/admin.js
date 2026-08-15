/**
 * Página de administração: gestão das configurações de vale-refeição.
 * Usa GET /api/v1/admin (listar), POST /api/v1/admin (criar)
 * e PATCH /api/v1/admin/:id (ativar).
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-create-form');
  const codeSelect = document.getElementById('config-code');
  const unitValueInput = document.getElementById('config-unit-value');
  const createSubmit = document.getElementById('create-submit-button');
  const createErrorBox = document.getElementById('create-error-box');
  const createSuccessBox = document.getElementById('create-success-box');

  const tableBody = document.getElementById('config-table-body');
  const emptyState = document.getElementById('empty-state');

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });

  let configs = []; // todas as configurações vindas do backend (GET /admin)

  // ---- Helpers -----------------------------------------------------------------
  function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
  }

  function setLoading(isLoading) {
    createSubmit.disabled = isLoading;
    createSubmit.textContent = isLoading ? 'Criando…' : 'Criar configuração';
  }

  function setMessages({ error = '', success = '' } = {}) {
    createErrorBox.textContent = error;
    createErrorBox.hidden = !error;
    createSuccessBox.textContent = success;
    createSuccessBox.hidden = !success;
  }

  // ---- Carregar e renderizar configurações --------------------------------------
  async function loadConfigs() {
    try {
      const data = await Api.getMealVoucherConfigs();
      // o backend retorna um array já ordenado por -active (ativos primeiro)
      configs = Array.isArray(data) ? data : [];
      renderTable();
    } catch (err) {
      emptyState.hidden = false;
      emptyState.textContent = err.message || 'Não foi possível carregar as configurações.';
    }
  }

  function renderRow(config) {
    const tr = document.createElement('tr');
    tr.dataset.id = config._id;

    const statusClass = config.active ? 'source-tag' : 'source-tag source-tag--inactive';
    const statusText = config.active ? 'Ativo' : 'Inativo';

    const actionsCell = document.createElement('td');
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'row-actions';

    if (!config.active) {
      const activateButton = document.createElement('button');
      activateButton.type = 'button';
      activateButton.className = 'icon-button activate';
      activateButton.textContent = 'Ativar';
      activateButton.addEventListener('click', () => activateConfig(config));
      actionsWrapper.appendChild(activateButton);
    } else {
      // mesmo container do botão para manter o alinhamento com a coluna "Ações"
      const noAction = document.createElement('span');
      noAction.className = 'no-action';
      noAction.textContent = '—';
      actionsWrapper.appendChild(noAction);
    }

    actionsCell.appendChild(actionsWrapper);

    tr.innerHTML = `
      <td><code>${config.code || '—'}</code></td>
      <td>${config.label || '—'}</td>
      <td class="numeric">${config.quantity ?? '—'}</td>
      <td class="numeric">${currencyFormatter.format(config.unitValue || 0)}</td>
      <td>${formatDate(config.effectiveDate)}</td>
      <td><span class="${statusClass}">${statusText}</span></td>
    `;
    tr.appendChild(actionsCell);
    return tr;
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (!configs.length) {
      emptyState.hidden = false;
      emptyState.textContent = 'Nenhuma configuração cadastrada ainda.';
      return;
    }

    emptyState.hidden = true;
    configs.forEach((config) => tableBody.appendChild(renderRow(config)));
  }

  // ---- Ativar uma configuração existente (PATCH /admin/:id) --------------------
  async function activateConfig(config) {
    if (!config?._id) return;

    const row = tableBody.querySelector(`tr[data-id="${config._id}"]`);
    const button = row?.querySelector('button');
    if (button) {
      button.disabled = true;
      button.textContent = 'Ativando…';
    }

    try {
      const updated = await Api.activateMealVoucherConfig(config._id);
      // recarrega do backend para refletir a troca de status entre as configs
      await loadConfigs();
      setMessages({
        success: `Configuração "${updated.label || config.label || config.code}" ativada com sucesso!`
      });
    } catch (err) {
      setMessages({ error: err.message || 'Não foi possível ativar a configuração.' });
      if (button) {
        button.disabled = false;
        button.textContent = 'Ativar';
      }
    }
  }

  // ---- Criar nova configuração (POST /admin) -------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessages();

    const code = codeSelect.value;
    const unitValue = unitValueInput.value;

    if (!code) {
      setMessages({ error: 'Selecione a regra da configuração.' });
      return;
    }
    if (unitValue === '' || Number(unitValue) <= 0) {
      setMessages({ error: 'Informe um valor unitário válido (maior que zero).' });
      return;
    }

    setLoading(true);
    try {
      const created = await Api.createMealVoucherConfig({
        code,
        unitValue: Number(unitValue)
      });

      form.reset();
      await loadConfigs();
      setMessages({
        success: `Configuração "${created.label || code}" criada e ativada com sucesso!`
      });
    } catch (err) {
      setMessages({ error: err.message || 'Não foi possível criar a configuração.' });
    } finally {
      setLoading(false);
    }
  });

  loadConfigs();
});
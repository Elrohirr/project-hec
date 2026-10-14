/**
 * Lógica da tela "Importar ponto via PDF" (import.html).
 * Fluxo:
 *   1. Upload do espelho -> POST /preview (multipart, campo "file").
 *      Resposta: { array: { previewArray, needsReviewArray } }
 *   2. Tabela com Status inicial "Prévia" em todas as linhas.
 *   3. "Confirmar importação" -> POST /preview/confirm { registers }.
 *      Resposta (200): { created, rejected }.
 *   4. Atualização ÚNICA da tabela: Criado / Rejeitado (+ msg auxiliar).
 */
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'pdfImportPreview';

  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');
  const browseButton = document.getElementById('import-browse-button');
  const fileNameEl = document.getElementById('import-file-name');
  const uploadButton = document.getElementById('import-upload-button');
  const errorBox = document.getElementById('import-error-box');
  const successBox = document.getElementById('import-success-box');

  const previewSection = document.getElementById('import-preview-section');
  const previewBody = document.getElementById('import-preview-body');
  const emptyState = document.getElementById('import-empty-state');
  const reviewSection = document.getElementById('import-review-section');
  const reviewList = document.getElementById('import-review-list');
  const confirmButton = document.getElementById('confirm-import-button');

  let currentPreview = [];
  let selectedFile = null;

  function showError(message) {
    successBox.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function showSuccess(message) {
    errorBox.hidden = true;
    successBox.textContent = message;
    successBox.hidden = false;
  }

  function hideMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
  }

  function formatDate(isoString) {
    return dateFormatter.format(new Date(isoString));
  }

  function detailOf(item) {
    if (item.type === 'Hora extra') return item.workedHours || '—';
    if (item.type === 'Turno noturno') return item.nightHours || '—';
    if (item.type === 'Compensação') return item.hoursNeeded || '—';
    return '—';
  }

  function toISODate(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function previewKeyOf(item) {
    return `${item.type}@@${toISODate(item.date)}`;
  }

  // "created" traz documentos do Mongoose, não o shape do preview.
  // Deriva o tipo pelos campos conhecidos de cada modelo.
  function createdKeyOf(doc) {
    const date = toISODate(doc && (doc.date || (doc.overtime && doc.overtime.date) || (doc.nightShift && doc.nightShift.date)));
    let type = 'Hora extra';
    if (doc && (doc.nightMinutesClock != null || doc.nightHoursClock || (doc.nightShift && doc.nightShift.date))) {
      type = 'Turno noturno';
    } else if (doc && (Array.isArray(doc.entries) || doc.totalMinutes != null)) {
      type = 'Compensação';
    }
    return `${type}@@${date}`;
  }

  function renderPreview(items) {
    currentPreview = Array.isArray(items) ? items : [];
    previewBody.innerHTML = '';
    previewSection.hidden = false;
    emptyState.hidden = currentPreview.length > 0;

    currentPreview.forEach((item) => {
      const tr = document.createElement('tr');
      tr.dataset.key = previewKeyOf(item);

      const dateTd = document.createElement('td');
      dateTd.textContent = formatDate(item.date);

      const typeTd = document.createElement('td');
      typeTd.textContent = item.type;

      const detailTd = document.createElement('td');
      detailTd.className = 'numeric';
      detailTd.textContent = detailOf(item);

      const statusTd = document.createElement('td');
      statusTd.className = 'status-cell';
      const badge = document.createElement('span');
      badge.className = 'badge status-preview';
      badge.textContent = 'Prévia';
      statusTd.appendChild(badge);

      tr.append(dateTd, typeTd, detailTd, statusTd);
      previewBody.appendChild(tr);
    });

    confirmButton.disabled = currentPreview.length === 0;
  }

  function renderNeedsReview(items) {
    const list = Array.isArray(items) ? items : [];
    reviewList.innerHTML = '';
    reviewSection.hidden = list.length === 0;

    list.forEach((entry) => {
      const li = document.createElement('li');
      const date = document.createElement('strong');
      date.textContent = formatDate(entry.date);
      li.append(date, document.createTextNode(` — ${entry.msg || 'Revisar manualmente.'}`));
      reviewList.appendChild(li);
    });
  }

  function applyConfirmResult(result) {
    const created = (result && result.created) || [];
    const rejected = (result && result.rejected) || [];
    const createdKeys = new Set(created.map(createdKeyOf));
    const rejectedMap = new Map(rejected.map((entry) => [previewKeyOf(entry), entry.msg || 'Registro rejeitado.']));

    previewBody.querySelectorAll('tr').forEach((tr) => {
      const statusCell = tr.querySelector('.status-cell');
      if (!statusCell) return;
      statusCell.innerHTML = '';
      const badge = document.createElement('span');
      const key = tr.dataset.key;

      if (rejectedMap.has(key)) {
        const msg = rejectedMap.get(key);
        badge.className = 'badge status-rejected';
        badge.textContent = 'Rejeitado';
        badge.title = msg;
        const helper = document.createElement('small');
        helper.className = 'import-row-error';
        helper.textContent = msg;
        statusCell.append(badge, helper);
      } else if (createdKeys.has(key)) {
        badge.className = 'badge status-created';
        badge.textContent = 'Criado';
        statusCell.appendChild(badge);
      } else {
        badge.className = 'badge status-preview';
        badge.textContent = 'Prévia';
        statusCell.appendChild(badge);
      }
    });
  }

  function setSelectedFile(file) {
    selectedFile = file || null;
    fileNameEl.textContent = selectedFile ? selectedFile.name : '';
    uploadButton.disabled = !selectedFile;
    if (!selectedFile) return;

    // Validação suave de extensão: só avisa, o backend é a validação real.
    if (!/\.pdf$/i.test(selectedFile.name || '')) {
      showError('O arquivo selecionado não tem extensão .pdf. O envio será tentado mesmo assim — o servidor fará a validação final.');
    } else {
      hideMessages();
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      showError('Selecione um arquivo PDF antes de enviar.');
      return;
    }

    hideMessages();
    uploadButton.disabled = true;
    uploadButton.textContent = 'Enviando…';
    try {
      const data = await Api.previewPdfImport(selectedFile);
      const previewArray = (data && data.array && data.array.previewArray) || [];
      const needsReviewArray = (data && data.array && data.array.needsReviewArray) || [];
      renderPreview(previewArray);
      renderNeedsReview(needsReviewArray);
      showSuccess(`Prévia carregada: ${previewArray.length} item(ns). Confira antes de confirmar.`);
    } catch (err) {
      showError((err && err.message) || 'Não foi possível processar o PDF.');
    } finally {
      uploadButton.disabled = !selectedFile;
      uploadButton.textContent = 'Enviar PDF';
    }
  }

  async function handleConfirm() {
    hideMessages();

    // Guarda anti-recarregamento: se não há prévia na tela nem salva,
    // pede reimportação e NÃO dispara a requisição.
    const savedBefore = sessionStorage.getItem(STORAGE_KEY);
    if ((!savedBefore || savedBefore === '[]') && currentPreview.length === 0) {
      showError('Não há prévia salva. Reimporte o PDF antes de confirmar.');
      return;
    }

    // Guarda o array exibido na tela antes de enviar.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentPreview));

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      showError('Não há prévia salva. Reimporte o PDF antes de confirmar.');
      return;
    }

    let registers = null;
    try {
      registers = JSON.parse(raw);
    } catch (parseErr) {
      showError('Não há prévia salva. Reimporte o PDF antes de confirmar.');
      return;
    }

    if (!Array.isArray(registers) || registers.length === 0) {
      showError('Não há prévia salva. Reimporte o PDF antes de confirmar.');
      return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Confirmando…';
    try {
      const result = await Api.confirmPdfImport(registers);
      applyConfirmResult(result || {});
      const createdCount = (result && result.created && result.created.length) || 0;
      const rejectedCount = (result && result.rejected && result.rejected.length) || 0;
      showSuccess(`Importação concluída: ${createdCount} criado(s), ${rejectedCount} rejeitado(s).`);
    } catch (err) {
      showError((err && err.message) || 'Não foi possível confirmar a importação.');
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
      confirmButton.disabled = currentPreview.length === 0;
      confirmButton.textContent = 'Confirmar importação';
    }
  }

  browseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    setSelectedFile(file || null);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  });

  uploadButton.addEventListener('click', handleUpload);
  confirmButton.addEventListener('click', handleConfirm);
});

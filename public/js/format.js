/**
 * Utilitários de formatação compartilhados entre as páginas do frontend.
 * Evita duplicar lógica de conversão/formatação em cada tela.
 */

/**
 * Converte um total de minutos em "HH:MM" (ex.: 1230 -> "20:30").
 * Valores ausentes ou inválidos viram 0 para nunca exibir quebrado.
 */
function minutesToHHMM(totalMinutes) {
  const total = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formata um valor numérico como moeda brasileira (ex.: 1200.4 -> "R$ 1.200,40").
 */
function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}
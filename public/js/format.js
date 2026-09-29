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

/**
 * Arredonda um valor numérico para `decimals` casas (padrão 2).
 * Mesma semântica do roundCurrency do backend (utils/tools.js); incluído aqui
 * porque o frontend não exporta essas funções do Node para o escopo do <script>.
 */
function roundCurrency(value, decimals = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Converte um horário "HH:MM" em número decimal de horas (ex.: "16:44" -> 16.73).
 * Usado na exibição dos cards do dashboard ("16:44 (16,73h)").
 */
function timeToNumber(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return 0;
  const [hour, minute] = hhmm.split(":");
  return roundCurrency(Number(hour) + (Number(minute) / 60), 2);
}

/**
 * Exibe um total de minutos como "HH:MM (D,Dh)" — ex.: "16:44 (16,73h)".
 * Valor decimal com vírgula (padrão brasileiro) — usado nos cards de horas.
 */
function hoursWithDecimal(minutes) {
  const hhmm = minutesToHHMM(minutes);
  return `${hhmm} (${timeToNumber(hhmm).toFixed(2).replace('.', ',')}h)`;
}

// Formatters compartidos: evita criar uma instância Intl por página.
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const payDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: '2-digit', year: 'numeric' });

/** Converte um input type="month" (YYYY-MM) à primeira data do mês (YYYY-MM-01). */
function monthStartDate(monthValue) {
  return `${monthValue}-01`;
}

/** Converte um input type="month" (YYYY-MM) ao último dia do mês (YYYY-MM-DD). */
function monthEndDate(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthValue}-${String(lastDay).padStart(2, '0')}`;
}

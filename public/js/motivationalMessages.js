/**
 * Mensagens motivacionais para o dashboard.
 *
 * Função pura: recebe (totalHours, month) e devolve uma mensagem
 * baseada na quantidade de horas extras (mês corrente) cruzada com a
 * estação do ano (seca ou úmido). Não faz fetch nem toca no DOM.
 */

// Faixas de horas (em horas) → categoria. Ordem ascendente; cada faixa
// é [min, max). A última cobre qualquer valor acima do teto.
var HOUR_TIERS = [
  { min: 0, max: 8, category: 'baixa' },
  { min: 8, max: 16, category: 'intermediaria_baixa' },
  { min: 16, max: 24, category: 'intermediaria_alta' },
  { min: 24, max: 32, category: 'media' },
  { min: 32, max: Infinity, category: 'alta' }
];

// Mensagens por categoria. A faixa baixa varia conforme a estação.
var MESSAGES = {
  baixa: {
    seca: [
      'Época de vacas magras :(',
      'Período de seca é triste, né?',
    ],
    // TODO: mensagem específica de período úmido a definir
    umido: [
      'Tá desmotivado?',
    ],
  },
  intermediaria_baixa: ['Indo bem, mas dá pra mais'],
  intermediaria_alta: ['Tá pegando pesado, hein'],
  media: ['Tá fazendo um dinheirinho, hein'],
  alta: ['Vai quebrar a empresa, hein']
};

function isDrySeason(month) {
  // Abril (3) a setembro (8) → seca; outubro (9) a março (2) → úmido.
  return month >= 3 && month <= 8;
}

function getSeasonMessage(totalHours, month) {
  var tier = HOUR_TIERS.find(function (t) {
    return totalHours >= t.min && totalHours < t.max;
  }) || HOUR_TIERS[HOUR_TIERS.length - 1];

  var category = tier.category;

  if (category === 'baixa') {
    var pool = isDrySeason(month) ? MESSAGES.baixa.seca : MESSAGES.baixa.umido;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return MESSAGES[category][0];
}
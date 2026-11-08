/**
 * Mensagem motivacional do dashboard.
 * Busca as horas extras do mês corrente (vía GET /api/v1/overtime?startDate&endDate),
 * soma distributionMinutes e chama getSeasonMessage() para exibir a mensagem.
 */
document.addEventListener('DOMContentLoaded', function () {
  var banner = document.getElementById('motivational-banner');
  var messageEl = document.getElementById('motivational-message');
  if (!banner || !messageEl) return;

  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var firstDay = year + '-' + String(month + 1).padStart(2, '0') + '-01';
  var lastDayNum = new Date(year, month + 1, 0).getDate();
  var lastDay = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(lastDayNum).padStart(2, '0');

  async function render() {
    try {
      var data = await Api.getOvertimes({ startDate: firstDay, endDate: lastDay, limit: 500 });
      var records = (data && Array.isArray(data.overtime)) ? data.overtime : [];
      var totalMinutes = records.reduce(function (sum, r) {
        var d = (r && r.distributionMinutes) || {};
        return sum + (Number(d.he50minutes) || 0) + (Number(d.he75minutes) || 0) + (Number(d.he100minutes) || 0);
      }, 0);
      var totalHours = totalMinutes / 60;
      messageEl.textContent = getSeasonMessage(totalHours, month);
      banner.hidden = false;
    } catch (err) {
      banner.hidden = true;
    }
  }

  render();
});
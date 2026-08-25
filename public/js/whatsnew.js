/**
 * Widget 'Novidades' (What's New) do dashboard.
 *
 * Busca um arquivo estático (data/whatsnew.json) via fetch local, monta
 * um modal reutilizável (createModal) com o histórico por versão e
 * mostra um badge no botão quando houver versão não vista.
 * A última versão vista fica em localStorage (APP_CONFIG.WHATSNEW_LS_KEY).
 */
document.addEventListener('DOMContentLoaded', function () {
  var button = document.getElementById('whatsnew-button');
  if (!button) return;
  var badge = button.querySelector('.whatsnew-badge');
  var versions = [];

  function latestVersion() {
    if (!versions.length) return null;
    var sorted = versions.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    return sorted[0];
  }

  function hasUnseen() {
    var latest = latestVersion();
    if (!latest) return false;
    return localStorage.getItem(APP_CONFIG.WHATSNEW_LS_KEY) !== latest.version;
  }

  function setBadge(on) {
    if (badge) badge.hidden = !on;
  }

  function renderBody() {
    var sorted = versions.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    return sorted.map(function (v) {
      var items = (v.highlights || []).map(function (h) {
        return '<li>' + h + '</li>';
      }).join('');
      return '<div class="whatsnew-version">' +
        '<h4 class="whatsnew-version-title">v' + v.version + '</h4>' +
        '<time class="whatsnew-version-date">' + v.date + '</time>' +
        '<ul class="whatsnew-highlights">' + items + '</ul>' +
        '</div>';
    }).join('');
  }

  async function load() {
    try {
      var res = await fetch('data/whatsnew.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      versions = await res.json();
      setBadge(hasUnseen());
    } catch (err) {
      console.error('Falha ao carregar novidades:', err);
    }
  }

  function openModal() {
    var latest = latestVersion();
    if (!latest) return;
    var modal = createModal({
      title: 'Novidades',
      body: renderBody()
    });
    modal.open();
    localStorage.setItem(APP_CONFIG.WHATSNEW_LS_KEY, latest.version);
    setBadge(false);
  }

  button.addEventListener('click', function () {
    if (!versions.length) {
      load().then(function () { openModal(); });
      return;
    }
    openModal();
  });

  load();
});
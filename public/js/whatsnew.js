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

  // Compara duas versões semver (ex: "1.2.0" vs "1.1.3").
  // Retorna > 0 se a for mais nova, < 0 se b for mais nova, 0 se iguais.
  function compareVersions(a, b) {
    var partsA = String(a).split('.').map(Number);
    var partsB = String(b).split('.').map(Number);
    for (var i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      var numA = partsA[i] || 0;
      var numB = partsB[i] || 0;
      if (numA !== numB) return numA - numB;
    }
    return 0;
  }

  function sortedByVersionDesc() {
    return versions.slice().sort(function (a, b) {
      return compareVersions(b.version, a.version);
    });
  }

  function latestVersion() {
    if (!versions.length) return null;
    return sortedByVersionDesc()[0];
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
    var sorted = sortedByVersionDesc();
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
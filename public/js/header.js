/**
 * Lógica compartilhada por toda página interna (que tem o header com
 * saudação + botão de sair): dashboard.html, overtime.html, e as
 * próximas telas também devem incluir este script.
 */
document.addEventListener('DOMContentLoaded', () => {
  const user = Api.getUser();
  const greeting = document.getElementById('user-greeting');
  if (greeting) {
    greeting.textContent = user?.name ? `Olá, ${user.name}` : 'Olá!';
  }

  const logoutButton = document.getElementById('logout-button');
  logoutButton?.addEventListener('click', () => {
    Api.logout();
    window.location.href = 'index.html';
  });

  // ---- Menu mobile (hambúrguer) -------------------------------------
  // O botão é injetado aqui para valer em todas as páginas internas sem
  // duplicar marcação no HTML. Ele alterna a classe `nav-open` no <header>,
  // que o CSS usa para abrir/recolher a navegação em telas estreitas.
  const header = document.querySelector('.app-header');
  if (header) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'menu-toggle';
    toggle.className = 'menu-toggle';
    toggle.setAttribute('aria-label', 'Abrir menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML =
      '<span class="menu-toggle-bar"></span>' +
      '<span class="menu-toggle-bar"></span>' +
      '<span class="menu-toggle-bar"></span>';

    const headerLeft = header.querySelector('.header-left');
    headerLeft?.appendChild(toggle);

    const setMenu = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };

    toggle.addEventListener('click', () => {
      setMenu(!header.classList.contains('nav-open'));
    });

    // Fecha o menu ao escolher qualquer item (links e o botão "Sair").
    // Usa delegação para que links injetados depois (ex.: "Administração",
    // adicionado abaixo) também fechem o menu automaticamente.
    header.addEventListener('click', (event) => {
      if (event.target.closest('.app-nav a, .user-area a, .user-area button')) {
        setMenu(false);
      }
    });
  }

  // ---- Área administrativa: só aparece para quem é admin ----
  if (Api.isAdmin()) {
    // Card do módulo "Administração" no dashboard (existe somente lá)
    const adminModuleCard = document.getElementById('admin-module-card');
    if (adminModuleCard) adminModuleCard.hidden = false;

    // Link no menu de navegação de todas as páginas internas
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('a[href="admin.html"]')) {
      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.id = 'admin-nav-link';
      adminLink.textContent = 'Administração';
      // marca como ativo quando estiver na própria página admin
      if (window.location.pathname.endsWith('admin.html')) {
        adminLink.classList.add('active');
      }
      nav.appendChild(adminLink);
    }
  }
});

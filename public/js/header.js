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

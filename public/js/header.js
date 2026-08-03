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
});

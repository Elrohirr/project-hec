// Guarda para páginas exclusivas de admin.
// Requer login E flag isAdmin === true no payload do token.
(function protectAdminPage() {
  if (!Api.isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }
  if (!Api.isAdmin()) {
    window.location.href = 'dashboard.html';
  }
})();
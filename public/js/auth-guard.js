// Inclua este script em toda página que exigir login (dashboard, telas internas, etc.)
(function protectPage() {
  if (!Api.isAuthenticated()) {
    window.location.href = 'index.html';
  }
})();

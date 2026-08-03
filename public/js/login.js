document.addEventListener('DOMContentLoaded', () => {
  // Se já existe sessão, não faz sentido ficar na tela de login
  if (Api.isAuthenticated()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitButton = document.getElementById('submit-button');
  const errorBox = document.getElementById('error-box');

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Entrando…' : 'Entrar';
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Preencha email e senha para continuar.');
      return;
    }

    setLoading(true);
    try {
      await Api.login(email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      // err.message já vem do backend (via ApiError, lá em api.js);
      // só caímos num texto genérico se por algum motivo ele vier vazio.
      showError(err.message || 'Não foi possível entrar agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  });
});

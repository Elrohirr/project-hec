document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const surnameInput = document.getElementById('surname');
  const emailInput = document.getElementById('email');
  const wageInput = document.getElementById('wage');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password-confirm');
  const submitButton = document.getElementById('submit-button');
  const errorBox = document.getElementById('error-box');
  const successBox = document.getElementById('success-box');

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Criando conta…' : 'Criar conta';
  }

  function showError(message) {
    successBox.hidden = true;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideMessages() {
    errorBox.hidden = true;
    successBox.hidden = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessages();

    const name = nameInput.value.trim();
    const surname = surnameInput.value.trim();
    const email = emailInput.value.trim();
    const wage = wageInput.value;
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    if (!name || !surname || !email || !wage || !password) {
      showError('Preencha todos os campos para continuar.');
      return;
    }

    if (Number(wage) <= 0) {
      showError('Informe um salário-hora válido.');
      return;
    }

    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== passwordConfirm) {
      showError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await Api.register({ name, surname, email, wage: Number(wage), password });
      successBox.textContent = 'Conta criada com sucesso! Redirecionando para o login…';
      successBox.hidden = false;
      form.reset();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } catch (err) {
      // err.message já vem do backend (via ApiError, lá em api.js);
      // só caímos num texto genérico se por algum motivo ele vier vazio.
      showError(err.message || 'Não foi possível criar a conta agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  });
});

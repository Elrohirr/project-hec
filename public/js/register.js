document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const surnameInput = document.getElementById('surname');
  const emailInput = document.getElementById('email');
  const wageInput = document.getElementById('wage');
  const wageDateInput = document.getElementById('wage-date');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password-confirm');
  const submitButton = document.getElementById('submit-button');
  const errorBox = document.getElementById('error-box');
  const successBox = document.getElementById('success-box');

  // Define a data máxima de vencimento como hoje (fuso local do navegador).
  function setMaxDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    wageDateInput.max = today.toISOString().split('T')[0];
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? 'Criando conta...' : 'Criar conta';
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

  // Converte texto monetário pt-BR (vírgula decimal) para número.
  function parseWage(text) {
    return Number(String(text).trim().replace(',', '.'));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessages();

    const name = nameInput.value.trim();
    const surname = surnameInput.value.trim();
    const email = emailInput.value.trim();
    const wage = parseWage(wageInput.value);
    const wageDate = wageDateInput.value;
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    if (!name || !surname || !email || !wageInput.value || !wageDate || !password) {
      showError('Preencha todos os campos para continuar.');
      return;
    }

    if (!Number.isFinite(wage) || wage <= 0) {
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

    // Barrar data futura (defesa em camada; o input já tem max=hoje).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(wageDate);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate > today) {
      showError('A data de vigência não pode ser futura.');
      return;
    }

    setLoading(true);
    try {
      await Api.register({ name, surname, email, wage, wageDate, password });
      successBox.textContent = 'Conta criada com sucesso! Redirecionando para o login...';
      successBox.hidden = false;
      form.reset();
      setMaxDate();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } catch (err) {
      showError(err.message || 'Não foi possível criar a conta agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  });

  setMaxDate();
});

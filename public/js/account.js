document.addEventListener('DOMContentLoaded', () => {
  // ---- Referências do DOM ---------------------------------------------------
  const profileForm = document.getElementById('profile-form');
  const profileName = document.getElementById('profile-name');
  const profileSurname = document.getElementById('profile-surname');
  const profileEmail = document.getElementById('profile-email');
  const profilePassword = document.getElementById('profile-password');
  const profileSubmit = document.getElementById('profile-submit-button');
  const profileError = document.getElementById('profile-error-box');
  const profileSuccess = document.getElementById('profile-success-box');

  const passwordForm = document.getElementById('password-form');
  const currentPassword = document.getElementById('current-password');
  const newPassword = document.getElementById('new-password');
  const newPasswordConfirm = document.getElementById('new-password-confirm');
  const passwordSubmit = document.getElementById('password-submit-button');
  const passwordError = document.getElementById('password-error-box');
  const passwordSuccess = document.getElementById('password-success-box');

  const deleteForm = document.getElementById('delete-form');
  const deletePassword = document.getElementById('delete-password');
  const deleteSubmit = document.getElementById('delete-submit-button');
  const deleteError = document.getElementById('delete-error-box');
  const deleteSuccess = document.getElementById('delete-success-box');

  // ---- Helpers ---------------------------------------------------------------
  function setMessages(errorBox, successBox, { error = '', success = '' } = {}) {
    errorBox.textContent = error;
    errorBox.hidden = !error;
    successBox.textContent = success;
    successBox.hidden = !success;
  }

  function setLoading(button, isLoading, baseText, loadingText) {
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : baseText;
  }

  // ---- Carregar dados atuais do perfil (GET /user/profile) ------------------
  function loadProfile() {
    // O backend não expõe mais GET /user/profile.
    // Preenchemos nome e sobrenome a partir do nome armazenado na sessão.
    const userName = Api.getUser()?.name || '';
    const nameParts = userName.split(' ');
    profileName.value = nameParts[0] || '';
    profileSurname.value = nameParts.slice(1).join(' ') || '';
  }

  // ---- Atualizar perfil (PATCH /user/profile) -------------------------------
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessages(profileError, profileSuccess);

    const name = profileName.value.trim();
    const surname = profileSurname.value.trim();
    const email = profileEmail.value.trim();
    const password = profilePassword.value;

    if (!name && !surname && !email) {
      setMessages(profileError, profileSuccess, {
        error: 'Informe ao menos um dado para atualização: nome, sobrenome ou e-mail.',
      });
      return;
    }

    const payload = { password };
    if (name) payload.name = name;
    if (surname) payload.surname = surname;
    if (email) payload.email = email;

    setLoading(profileSubmit, true, 'Salvar alterações', 'Salvando…');
    try {
      const updated = await Api.updateProfile(payload);
      // Refletir o nome atualizado no cabeçalho (mesmo formato usado no login/registro)
      Api.setSession({ token: Api.getToken(), user: { name: `${updated.name} ${updated.surname}` } });
      const greeting = document.getElementById('user-greeting');
      if (greeting) greeting.textContent = `Olá, ${updated.name} ${updated.surname}`;
      setMessages(profileError, profileSuccess, { success: 'Perfil atualizado com sucesso!' });
      profilePassword.value = '';
    } catch (err) {
      setMessages(profileError, profileSuccess, { error: err.message || 'Não foi possível atualizar o perfil.' });
    } finally {
      setLoading(profileSubmit, false, 'Salvar alterações', 'Salvando…');
    }
  });

  // ---- Alterar senha (PATCH /user/password) ---------------------------------
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessages(passwordError, passwordSuccess);

    const current = currentPassword.value;
    const next = newPassword.value;
    const confirm = newPasswordConfirm.value;

    if (!current || !next) {
      setMessages(passwordError, passwordSuccess, { error: 'Preencha todos os campos.' });
      return;
    }
    if (next.length < 4) {
      setMessages(passwordError, passwordSuccess, { error: 'A nova senha deve ter pelo menos 4 caracteres.' });
      return;
    }
    if (next !== confirm) {
      setMessages(passwordError, passwordSuccess, { error: 'A confirmação da nova senha não confere.' });
      return;
    }

    setLoading(passwordSubmit, true, 'Alterar senha', 'Alterando…');
    try {
      const res = await Api.updatePassword({ currentPassword: current, newPassword: next });
      setMessages(passwordError, passwordSuccess, { success: res?.msg || 'Senha alterada com sucesso!' });
      passwordForm.reset();
    } catch (err) {
      setMessages(passwordError, passwordSuccess, { error: err.message || 'Não foi possível alterar a senha.' });
    } finally {
      setLoading(passwordSubmit, false, 'Alterar senha', 'Alterando…');
    }
  });

  // ---- Excluir conta (DELETE /user) ------------------------------------------
  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessages(deleteError, deleteSuccess);

    const password = deletePassword.value;
    if (!password) {
      setMessages(deleteError, deleteSuccess, { error: 'Digite sua senha para confirmar a exclusão.' });
      return;
    }

    const confirmed = window.confirm(
      'Tem certeza que deseja excluir sua conta? Esta ação é permanente e apagará todos os seus registros de horas extras, turnos noturnos e vale-refeição.'
    );
    if (!confirmed) return;

    setLoading(deleteSubmit, true, 'Excluir minha conta', 'Excluindo…');
    try {
      const res = await Api.deleteAccount({ password });
      setMessages(deleteError, deleteSuccess, { success: res?.msg || 'Conta excluída. Redirecionando…' });
      Api.clearSession();
      setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    } catch (err) {
      setMessages(deleteError, deleteSuccess, { error: err.message || 'Não foi possível excluir a conta.' });
      setLoading(deleteSubmit, false, 'Excluir minha conta', 'Excluindo…');
    }
  });

  loadProfile();
});
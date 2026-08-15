/**
 * Camada de acesso à API.
 * Toda chamada ao backend passa por aqui, para que o token e os
 * erros sejam tratados de um jeito só em todo o projeto.
 */

/**
 * Decodifica o payload de um JWT (segmento base64url) sem validar assinatura.
 * Usado no frontend apenas para ler dados não sensíveis do token,
 * como o flag `isAdmin` emitido no login (ver models/User.js -> createJWT).
 */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const Api = {
  getToken() {
    return localStorage.getItem(APP_CONFIG.TOKEN_STORAGE_KEY);
  },

  setSession({ token, user }) {
    localStorage.setItem(APP_CONFIG.TOKEN_STORAGE_KEY, token);
    if (user) {
      localStorage.setItem(APP_CONFIG.USER_STORAGE_KEY, JSON.stringify(user));
    }
  },

  getUser() {
    const raw = localStorage.getItem(APP_CONFIG.USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  clearSession() {
    localStorage.removeItem(APP_CONFIG.TOKEN_STORAGE_KEY);
    localStorage.removeItem(APP_CONFIG.USER_STORAGE_KEY);
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Decodifica o payload do token JWT armazenado (não valida assinatura).
   * @returns {object|null} payload do token ou null quando indisponível/inválido.
   */
  decodeToken() {
    const token = this.getToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  },

  /**
   * Verifica se o usuário autenticado é admin olhando o payload do token,
   * que inclui o campo `isAdmin` (ver middleware/authorizeAdmin.js no backend).
   */
  isAdmin() {
    const payload = this.decodeToken();
    return payload && payload.isAdmin === true;
  },

  /**
   * Faz uma requisição para a API já anexando o token (quando existir)
   * e tratando erros de forma padronizada.
   *
   * @param {string} path - ex: '/login', '/horas-extras'
   * @param {object} options - mesmas opções do fetch (method, body, etc.)
   */
  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(`${APP_CONFIG.API_BASE_URL}${path}`, {
        ...options,
        headers
      });
    } catch (networkError) {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está no ar.', 0);
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error || 'Ocorreu um erro inesperado.';
      throw new ApiError(message, response.status);
    }

    return data;
  },

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (!data?.token) {
      throw new ApiError('A resposta do servidor não trouxe o token de acesso.', 500);
    }

    this.setSession({ token: data.token, user: data.user || { email } });
    return data;
  },

  async register({ name, surname, email, wage, password }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, surname, email, wage, password })
    });
  },

  async getOvertimes(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/overtime${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  },

  async createOvertime({ workedHours, date, isDayOff, isHoliday }) {
    return this.request('/overtime', {
      method: 'POST',
      body: JSON.stringify({ workedHours, date, isDayOff, isHoliday })
    });
  },

  async getOvertime(id) {
    return this.request(`/overtime/${id}`, {
      method: 'GET'
    });
  },

  async getNightShifts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/nightShift${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  },

  async createNightShift({ date, nightHoursClock }) {
    return this.request('/nightShift', {
      method: 'POST',
      body: JSON.stringify({ date, nightHoursClock })
    });
  },

  async deleteNightShift(id) {
    return this.request(`/nightShift/${id}`, {
      method: 'DELETE'
    });
  },

  async updateNightShift(id, { date, nightHoursClock }) {
    return this.request(`/nightShift/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ date, nightHoursClock })
    });
  },

  async updateOvertime(id, { workedHours, date, isDayOff, isHoliday }) {
    return this.request(`/overtime/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ workedHours, date, isDayOff, isHoliday })
    });
  },

  async deleteOvertime(id) {
    return this.request(`/overtime/${id}`, {
      method: 'DELETE'
    });
  },

  async getMealVouchers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/mealvoucher${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  },

  // ---- Admin (protegido no backend por middleware/authorizeAdmin) ----------

  /** Lista todas as configurações de vale-refeição cadastradas (GET /admin). */
  async getMealVoucherConfigs() {
    return this.request('/admin', {
      method: 'GET'
    });
  },

  /** Cria uma nova configuração de vale-refeição ativa (POST /admin). */
  async createMealVoucherConfig({ code, unitValue }) {
    return this.request('/admin', {
      method: 'POST',
      body: JSON.stringify({ code, unitValue })
    });
  },

  /** Ativa uma configuração de vale-refeição existente (PATCH /admin/:id). */
  async activateMealVoucherConfig(id) {
    return this.request(`/admin/${id}`, {
      method: 'PATCH'
    });
  },

  async updateProfile({ name, surname, wage, email }) {
    return this.request('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, surname, wage, email })
    });
  },

  async updatePassword({ currentPassword, newPassword }) {
    return this.request('/user/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async deleteAccount({ password }) {
    return this.request('/user', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
  },

  logout() {
    this.clearSession();
  }
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Camada de acesso à API.
 * Toda chamada ao backend passa por aqui, para que o token e os
 * erros sejam tratados de um jeito só em todo o projeto.
 */

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

  async getNightShifts() {
    return this.request('/nightShift', {
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

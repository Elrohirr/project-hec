/**
 * Camada de acesso à API — SEU TREINO AQUI.
 *
 * Objetivo: centralizar toda a comunicação com o backend, para que
 * o resto do projeto (login.js, register.js, dashboard.js) nunca
 * precise chamar fetch() diretamente.
 *
 * Contrato da API (já definido com o backend):
 * - Base URL: vem de APP_CONFIG.API_BASE_URL (veja config.js) — é relativa
 *   ('/api/v1'), já que o front é servido pelo próprio Express (express.static).
 * - POST /auth/login    body: { email, password }   resposta: { token, user? }
 * - POST /auth/register body: { name, surname, email, wage, password }
 * - Toda rota protegida espera o header: Authorization: Bearer <token>
 */

const Api = {
  /**
   * TODO: retornar o token salvo no localStorage.
   * Use a chave em APP_CONFIG.TOKEN_STORAGE_KEY.
   */
  getToken() {},

  /**
   * TODO: salvar o token (e o usuário, se vier) no localStorage.
   * Dica: se for guardar um objeto, lembre de usar JSON.stringify.
   * @param {{ token: string, user?: object }} session
   */
  setSession(session) {},

  /**
   * TODO: retornar o usuário salvo no localStorage (ou null se não existir).
   * Dica: o que vier do localStorage é sempre string — use JSON.parse.
   */
  getUser() {},

  /**
   * TODO: remover token e usuário do localStorage (usado no logout).
   */
  clearSession() {},

  /**
   * TODO: retornar true se existir um token salvo, false caso contrário.
   */
  isAuthenticated() {},

  /**
   * TODO: função central de chamadas à API.
   *
   * Passos esperados:
   * 1. Montar os headers, sempre incluindo 'Content-Type': 'application/json'.
   * 2. Se existir um token salvo, incluir 'Authorization': `Bearer ${token}`.
   * 3. Fazer o fetch para `${APP_CONFIG.API_BASE_URL}${path}`, espalhando `options`.
   * 4. Tentar interpretar a resposta como JSON.
   * 5. Se `response.ok` for falso, lançar um ApiError com uma mensagem
   *    amigável e o status da resposta (response.status).
   * 6. Se der tudo certo, retornar os dados.
   *
   * Dica: envolva o fetch em try/catch para tratar erro de rede
   * (ex: API fora do ar) — nesse caso, lance um ApiError com status 0.
   *
   * @param {string} path - ex: '/login'
   * @param {object} options - mesmas opções do fetch (method, body, etc.)
   */
  async request(path, options = {}) {},

  /**
   * TODO: chamar this.request('/auth/login', ...) com method POST e o body
   * { email, password } em JSON.
   * Depois de receber a resposta, chamar this.setSession(...) com o
   * token (e o user, se vier) e retornar os dados.
   * Se a resposta não tiver token, lance um ApiError.
   */
  async login(email, password) {},

  /**
   * TODO: chamar this.request('/auth/register', ...) com method POST e o
   * body { name, surname, email, wage, password } em JSON.
   * Não precisa salvar sessão aqui — não há login automático.
   */
  async register({ name, surname, email, wage, password }) {},

  /**
   * TODO: buscar a lista de horas extras.
   * `params` é um objeto tipo { page: 1, limit: 10 } (ou com filtros
   * como isHoliday, isDayOff, startDate, endDate, sort).
   * Dica: dá pra transformar esse objeto em query string com
   * `new URLSearchParams(params).toString()`.
   * Chame this.request(`/overtime?${queryString}`, { method: 'GET' }).
   */
  async getOvertimes(params = {}) {},

  /**
   * TODO: chamar this.request('/overtime', ...) com method POST e o
   * body { quantity, date, isDayOff, isHoliday } em JSON.
   */
  async createOvertime({ quantity, date, isDayOff, isHoliday }) {},

  /**
   * TODO: chamar this.request(`/overtime/${id}`, ...) com method DELETE.
   */
  async deleteOvertime(id) {},

  /**
   * TODO: chamar this.clearSession().
   */
  logout() {}
};

/**
 * Erro customizado para deixar claro, em quem consome a Api, que o
 * problema veio de uma chamada HTTP (e não de um bug qualquer).
 */
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * SEU TREINO AQUI — lógica da tela de login (index.html).
 *
 * Elementos do HTML que você vai usar (confira os ids em index.html):
 * - #login-form       (o <form>)
 * - #email, #password (os inputs)
 * - #submit-button    (o botão de enviar)
 * - #error-box        (div escondida, para mostrar erro)
 *
 * Passos sugeridos:
 *
 * 1. Ao carregar a página (DOMContentLoaded):
 *    - Se Api.isAuthenticated() já for true, redirecionar direto para
 *      'dashboard.html' (evita mostrar login pra quem já tá logado).
 *
 * 2. Pegar as referências dos elementos do form pelo id.
 *
 * 3. Escutar o evento 'submit' do form:
 *    - Chamar event.preventDefault() (senão a página recarrega).
 *    - Esconder a mensagem de erro anterior.
 *    - Ler e validar email/senha (não deixar enviar vazio).
 *    - Desabilitar o botão e mudar o texto (ex: "Entrando…") enquanto
 *      espera a resposta da API — isso evita duplo clique.
 *    - Chamar Api.login(email, password).
 *    - Se der certo: redirecionar para 'dashboard.html'.
 *    - Se der erro: mostrar uma mensagem amigável no #error-box.
 *      Dica: o erro lançado por Api tem um `.status` — use isso para
 *      diferenciar "senha errada" (401) de "servidor fora do ar" (0).
 *    - No final (der certo ou não), reabilitar o botão.
 */

document.addEventListener('DOMContentLoaded', () => {
  // seu código aqui
});

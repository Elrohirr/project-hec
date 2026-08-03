/**
 * SEU TREINO AQUI — lógica da tela de cadastro (register.html).
 *
 * Elementos do HTML (confira os ids em register.html):
 * - #register-form
 * - #name, #surname, #email, #wage, #password, #password-confirm
 * - #submit-button
 * - #error-box, #success-box (ambos escondidos por padrão)
 *
 * Passos sugeridos:
 *
 * 1. Pegar as referências dos elementos pelo id.
 *
 * 2. Escutar o 'submit' do form:
 *    - preventDefault() e esconder mensagens anteriores.
 *    - Ler os valores (lembre de usar Number() no wage, já que o
 *      input devolve string).
 *    - Validar no front (tudo isso é ótimo treino de lógica):
 *        a) nenhum campo pode estar vazio
 *        b) wage deve ser um número maior que 0
 *        c) password deve ter pelo menos 6 caracteres
 *        d) password === password-confirm
 *      Se alguma validação falhar, mostrar a mensagem no #error-box
 *      e não seguir adiante (return).
 *    - Desabilitar o botão enquanto envia.
 *    - Chamar Api.register({ username, email, wage, password }).
 *    - Se der certo: mostrar mensagem no #success-box, resetar o
 *      form e redirecionar para 'index.html' depois de ~1.5s
 *      (dica: setTimeout).
 *    - Se der erro: mostrar mensagem no #error-box (trate pelo menos
 *      o status 409, de email já cadastrado, com uma mensagem própria).
 *    - No final, reabilitar o botão.
 */

document.addEventListener('DOMContentLoaded', () => {
  // seu código aqui
});

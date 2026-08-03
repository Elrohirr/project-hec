/**
 * SEU TREINO AQUI — lógica da tela de horas extras (overtime.html).
 * Esta é a tela mais completa até agora: junta um formulário de
 * criação com uma tabela que lista os registros já existentes.
 *
 * Elementos do HTML que você vai usar (confira os ids em overtime.html):
 * - Formulário: #overtime-form, #quantity, #date, #is-day-off,
 *   #is-holiday, #submit-button, #form-error-box, #form-success-box
 * - Resumo:     #summary-he50, #summary-he75, #summary-he100, #summary-total
 * - Tabela:     #overtime-table-body, #empty-state
 * - Paginação:  #page-indicator, #prev-page-button, #next-page-button
 *
 * Formato da resposta de Api.getOvertimes(...):
 * {
 *   totalRecords, numberOfPages, currtenPage,
 *   distribution: { he50, he75, he100 },      // total de horas por faixa
 *   values: { valueHe50, valueHe75, valueHe100, total }, // total em R$
 *   overtime: [
 *     { _id, quantity, date, payDate, isDayOff, isHoliday,
 *       distribution: { he50, he75, he100 } },
 *     ...
 *   ]
 * }
 *
 * Passos sugeridos:
 *
 * 1. FUNÇÕES AUXILIARES
 *    - Uma função pra formatar data (ex: usando `new Intl.DateTimeFormat`).
 *    - Uma função pra formatar moeda (ex: usando `new Intl.NumberFormat`
 *      com `style: 'currency', currency: 'BRL'`).
 *
 * 2. CARREGAR E RENDERIZAR A LISTA (a parte mais importante)
 *    - Crie uma função async `loadOvertimes(page)` que:
 *      a) chama `Api.getOvertimes({ page, limit: 10 })`
 *      b) guarda a página atual e o total de páginas em variáveis
 *      c) atualiza os cards de resumo (#summary-he50 etc.) com
 *         `data.distribution` e `data.values`
 *      d) limpa o `#overtime-table-body` e cria uma `<tr>` para cada
 *         item de `data.overtime`, preenchendo data, quantidade,
 *         he50/he75/he100, data de pagamento e um botão de excluir
 *      e) se a lista vier vazia, mostra o `#empty-state`
 *      f) atualiza o texto do `#page-indicator` e desabilita os
 *         botões de "Anterior"/"Próxima" quando fizer sentido
 *    - Chame `loadOvertimes(1)` uma vez, no final do arquivo (fora de
 *      qualquer função), para carregar a tabela assim que a página abrir.
 *
 * 3. PAGINAÇÃO
 *    - Nos cliques de #prev-page-button / #next-page-button, chame
 *      `loadOvertimes` com a página anterior/seguinte.
 *
 * 4. EXCLUIR UM REGISTRO
 *    - No botão de excluir de cada linha, pergunte confirmação (pode
 *      usar `confirm('Excluir este registro?')`), chame
 *      `Api.deleteOvertime(id)` e recarregue a lista.
 *
 * 5. FORMULÁRIO DE CRIAÇÃO
 *    - No 'submit' do #overtime-form: preventDefault, ler os campos
 *      (lembre de `Number(quantityInput.value)` na quantidade),
 *      validar que quantidade > 0 e data preenchida, desabilitar o
 *      botão, chamar `Api.createOvertime(...)`, mostrar sucesso,
 *      resetar o form e recarregar a lista (`loadOvertimes(1)`).
 *    - Trate erros mostrando a mensagem no #form-error-box.
 */

document.addEventListener('DOMContentLoaded', () => {
  // seu código aqui
});

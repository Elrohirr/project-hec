# Controle de Horas Extras — Frontend

Projeto em HTML/CSS/JS puro, sem build step: é só abrir o `index.html` no navegador (ou servir a pasta com uma extensão tipo "Live Server").

## Estrutura

```
controle-horas-extras/
├── index.html         → tela de login (pronta)
├── register.html       → tela de cadastro (pronta)
├── dashboard.html      → tela inicial pós-login (pronta)
├── css/
│   └── style.css       → todo o design do projeto (pronto)
├── js/                  ← SEU TREINO ESTÁ AQUI (esqueletos com TODOs)
│   ├── config.js        → já pronto (só constantes)
│   ├── api.js            → TODO: comunicação com a API + token
│   ├── auth-guard.js     → TODO: proteger páginas internas
│   ├── login.js          → TODO: lógica da tela de login
│   ├── register.js       → TODO: lógica da tela de cadastro
│   └── dashboard.js      → TODO: lógica da tela inicial
└── js-solucao/            → implementação de referência (só espia se travar!)
```

O HTML e o CSS já estão prontos — seu foco é implementar a lógica em `js/`. Cada arquivo tem comentários explicando o que fazer, passo a passo.

## Contrato da API (o que já está combinado com o backend)

- Base URL: `http://localhost:3000/api/v1` (veja `js/config.js`)
- `POST /login` — body `{ email, password }` → resposta `{ token, user? }`
- `POST /register` — body `{ username, email, wage, password }` → sem login automático
- Rotas protegidas esperam o header `Authorization: Bearer <token>`

## Ordem sugerida para implementar

1. **`js/api.js`** — comece por aqui, é a base de tudo. Primeiro os métodos simples (`getToken`, `setSession`, `getUser`, `clearSession`, `isAuthenticated`), depois o `request()` (o mais importante) e por último `login()` e `register()`, que usam o `request()`.
2. **`js/login.js`** — depois de testar o `api.js` (dá pra chamar `Api.login(...)` no console do navegador pra ver se funciona), implemente o formulário de login.
3. **`js/register.js`** — mesma ideia, agora com mais validações no front.
4. **`js/auth-guard.js`** — pequeno, mas importante: sem ele, dá pra acessar `dashboard.html` sem estar logado.
5. **`js/dashboard.js`** — o mais simples, bom pra fechar com uma vitória fácil.

## Se travar

A pasta `js-solucao/` tem a implementação completa de cada arquivo, com o mesmo nome. Tente resolver sozinho primeiro — só dá uma espiada lá se realmente travar, e tente entender o "porquê" e não só copiar.

## Testando

Abra `index.html` no navegador, com sua API rodando em `localhost:3000`. Abra o Console do DevTools (F12) para ver os `console.log`/erros enquanto testa.

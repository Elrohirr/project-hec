# Hour Flow — Frontend (Controle de Horas Extras)

Frontend em HTML/CSS/JS puro, sem etapa de build. Pode ser aberto direto
(`public/index.html`) ou, melhor ainda, ser servido pelo backend Express
(`app.js` usa `express.static` sobre a pasta `public`). A API fica em
`/api/v1` (configurável em `js/config.js`).

## Estrutura

```
public/
├── index.html            → tela de login (pública)
├── register.html         → tela de cadastro (pública)
├── dashboard.html        → início pós-login (painel de módulos)
├── overtime.html         → registro de horas extras
├── nightshift.html       → registro de turnos noturnos
├── mealvoucher.html      → acompanhamento de vales-refeição
├── account.html          → ajustes da conta (perfil, senha, exclusão)
├── admin.html            → administração (só admin)
├── css/
│   └── style.css         → design completo (tema "cartão de ponto")
└── js/
    ├── config.js         → constantes (URL da API, chaves do localStorage)
    ├── api.js            → camada de acesso à API (fetch + token + erros)
    ├── login.js          → lógica da tela de login
    ├── register.js       → lógica da tela de cadastro
    ├── auth-guard.js     → protege páginas com login (redireciona a index.html)
    ├── admin-guard.js    → protege páginas de admin (redireciona a dashboard.html)
    ├── header.js         → header compartilhado (saudação, sair, menu mobile, admin)
    ├── overtime.js       → lógica de horas extras
    ├── nightshift.js     → lógica de turnos noturnos
    ├── mealvoucher.js    → lógica de vales-refeição
    ├── account.js        → lógica da página "Minha conta"
    └── admin.js          → lógica de administração
```

## Fluxo das páginas

- **Acesso**: `index.html` e `register.html` são públicos. As demais exigem login.
- **Guards**: `auth-guard.js` redireciona a `index.html` se não há token;
  `admin-guard.js` redireciona a `dashboard.html` se o usuário não é admin
  (flag `isAdmin === true` no payload do token JWT).
- **Header**: `header.js` mostra o header, injeta o menu mobile e adiciona o
  link/card "Administração" só para usuários admin.

## Contrato da API (em conjunto com o backend)

Header requerido nas rotas protegidas: `Authorization: Bearer <token>`.
Base URL: `/api/v1`.

### Autenticação — `/api/v1/auth`

- `POST /register` — body `{ name, surname, email, wage, password }` →
  resposta `{ user: { name }, token }` (não inicia sessão automaticamente).
- `POST /login` — body `{ email, password }` → resposta `{ user: { name }, token }`.

### Horas extras — `/api/v1/overtime`

- `GET /` — listagem paginada com filtros `isHoliday`, `isDayOff`, `startDate`,
  `endDate`, `startPayDate`, `endPayDate`, `sort`, `page`, `limit`.
  Resposta: `{ totalRecords, numberOfPages, currentPage, distribution, values, overtime }`.
- `POST /` — corpo `{ workedHours, date, isDayOff, isHoliday }`.
- `GET /:id`, `PATCH /:id`, `DELETE /:id`.

### Turno noturno — `/api/v1/nightShift`

- `GET /` — listagem paginada (mesmo padrão que horas extras).
- `POST /` — corpo `{ date, nightHoursClock? }` (fallback `'07:00'`).
- `GET /:id`, `PATCH /:id`, `DELETE /:id`.

### Vale-refeição — `/api/v1/mealvoucher`

- `GET /` — listagem com filtros `source`, `startPayDate`, `endPayDate`, `sort`.
- `GET /receivable?scope=next|total|previous` — totais a receber por origem (`mealVoucherOvertime`, `mealVoucherNightShift`).
- `GET /:id`.

### Usuário — `/api/v1/user`

- `PATCH /profile` — atualização parcial `{ name?, surname?, email?, wage? }`.
- `PATCH /password` — `{ currentPassword, newPassword }`.
- `DELETE /` — `{ password }` (remove usuário e seus registros).

### Admin — `/api/v1/admin` (só admin)

- `GET /` — listagem de configs de vale-refeição.
- `POST /` — cria config `{ code, unitValue }`.
- `PATCH /:id` — ativa config existente.
- `GET /users` — listagem de usuários.

## Notas / workarounds

- **Perfil**: o backend não expõe `GET /api/v1/user/profile`. Em `account.js`,
  nome e sobrenome são preenchidos a partir da sessão (`Api.getUser().name`);
  o email e o salário devem ser digitados novamente para atualizar
  (`PATCH /api/v1/user/profile`).
- **Datas**: o backend guarda as datas como UTC meia-noite; o frontend formata
  com `timeZone: 'UTC'` para que o navegador não mostre um dia a menos.
- **Formato monetário**: usa-se `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`.

## Como executar

1. Inicie a API (backend); o frontend é servido pela pasta `public/`.
2. Abra `http://localhost:<PORT>/` ou `public/index.html` se você não usa o
   backend para servir os estáticos.
3. Se a API mudar de host/rota, ajuste `API_BASE_URL` em `public/js/config.js`.

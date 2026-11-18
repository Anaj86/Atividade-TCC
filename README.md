# Conect60+

Site de exercícios para a terceira idade, com servidor, banco de dados e painel de administração.

- **Site** (pasta `public/`): HTML, CSS e JavaScript puros.
- **API** (pasta `src/`): Node.js + Express.
- **Banco de dados**: MySQL, acessado pelo Prisma (`prisma/schema.prisma`).

O site e a API rodam juntos, no mesmo endereço. Nada fica mais guardado no navegador (`localStorage`), exceto as preferências de acessibilidade: contas, senhas, progresso, avaliações, mensagens e aulas ficam no banco.

---

## 1. Rodar no seu computador

Você precisa do [Node.js 20 ou mais novo](https://nodejs.org) e de um MySQL ligado (o mesmo que você já usava).

```bash
npm install          # instala as dependências e prepara o Prisma
npm run setup        # cria/atualiza as tabelas e coloca os dados iniciais
npm run dev          # liga o servidor
```

Abra **http://localhost:3000**.

Antes do `npm run setup`, abra o arquivo `.env` e preencha `ADMIN_TELEFONE` e `ADMIN_SENHA` (8 caracteres ou mais). É com eles que você entra como administrador. Se preencher depois, rode `npm run db:seed` de novo.

| Comando | O que faz |
|---|---|
| `npm run dev` | Liga o servidor e reinicia sozinho quando você salva um arquivo |
| `npm start` | Liga o servidor (modo normal) |
| `npm run db:push` | Aplica o `schema.prisma` no banco (cria/altera tabelas) |
| `npm run db:seed` | Cria categorias, exercícios, aulas, perfis de demonstração e o administrador (só o que ainda não existe) |
| `npm run db:studio` | Abre uma tela para ver e editar o banco no navegador |
| `npm run db:sql` | Mostra o SQL completo de criação das tabelas (útil para a documentação do TCC) |

---

## 2. O que existe no banco

| Tabela | Guarda |
|---|---|
| `usuarios` | Idosos, profissionais e administradores (senha sempre em hash) |
| `sessoes` | Logins ativos (cookie de 30 dias) |
| `pedidos_senha` | Pedidos de "esqueci a senha" e seus códigos |
| `categorias`, `exercicios` | Yoga suave, Postura, Em dupla, Mobilidade, Relaxamento e os passos de cada exercício |
| `aulas` | Aulas em vídeo (as de "Suas aulas" e as publicadas por profissionais) |
| `progressos` | Aulas que cada idoso concluiu |
| `avaliacoes` | Nota de 1 a 4 dada ao final das aulas |
| `mensagens_contato` | Mensagens do "Fale com a gente" |

---

## 3. Rotas da API

Todas começam com `/api`. As respostas são JSON; erros vêm como `{ "erro": "mensagem" }`.

**Autenticação**
| Método e rota | Função |
|---|---|
| `GET /auth/eu` | Quem está logado |
| `POST /auth/cadastro` | Criar conta com telefone e senha |
| `POST /auth/login` · `POST /auth/logout` | Entrar e sair |
| `GET /auth/config` · `POST /auth/google` | Entrar com o Google |
| `POST /auth/senha/pedido` | Pedir código para redefinir a senha |
| `POST /auth/senha/redefinir` | Criar a senha nova com o código |

**Perfil (logado)**
| Método e rota | Função |
|---|---|
| `PUT /perfil` | Alterar nome, telefone, título e resumo |
| `PUT /perfil/senha` | Trocar a senha |
| `PUT /perfil/foto` · `DELETE /perfil/foto` | Foto de perfil |
| `DELETE /perfil` | Excluir a conta e todos os dados |

**Conteúdo**
| Método e rota | Função |
|---|---|
| `GET /categorias` | Categorias e exercícios |
| `GET /aulas/destaque` | Aulas de "Suas aulas" |
| `GET /profissionais` | Profissionais aprovados e suas aulas |
| `GET /aulas/:id/video` | O vídeo (ou imagem) da aula |
| `GET /progresso` · `POST /progresso/:aulaId` | Ver e marcar aulas concluídas |
| `POST /avaliacoes` | Avaliar (depois de concluir todas as aulas) |
| `POST /contato` | Enviar mensagem |

**Profissional**
| Método e rota | Função |
|---|---|
| `GET /minhas-aulas` · `POST /aulas` · `DELETE /aulas/:id` | Listar, criar e apagar aulas |
| `PUT /aulas/:id/arquivo` | Enviar o vídeo/imagem da aula |

**Administração** (`/admin/...`): resumo, usuários (aprovar Crefito, desativar, excluir), aulas (destaque, excluir), mensagens, pedidos de senha (gerar código) e avaliações.

`GET /api/health` responde `{ "ok": true }` e serve para a hospedagem saber que o site está de pé.

---

## 4. Como funcionam as partes novas

**Administrador.** Entre no site com o telefone e a senha do `.env`. Aparece o botão **Painel** no topo (ou abra `/admin`).

**Profissionais.** Quem se cadastra como profissional já pode publicar, mas **só aparece para os idosos depois que o administrador aprova o Crefito** no painel. Confira o número no site do Crefito da região antes de aprovar.

**Esqueci a senha.** Como o idoso se cadastra só com telefone, não há e-mail para mandar um link. O caminho é:
1. A pessoa informa o telefone e toca em "Pedir código".
2. O pedido aparece no painel, em "Pedidos de senha".
3. Você liga para o telefone do cadastro, confirma que é a própria pessoa e toca em "Gerar código".
4. Informa os 6 números. Ela digita o código e a senha nova. O código vale 24 horas e trava depois de 5 erros.

**Aulas em destaque.** As quatro aulas de "Suas aulas" vêm criadas sem vídeo. Para trocá-las pelas aulas reais: o profissional envia o vídeo na área dele e, no painel, você marca a aula como destaque e tira o destaque (ou exclui) das de exemplo.

**Perfis de demonstração.** As três fisioterapeutas de exemplo aparecem com o selo "Perfil de demonstração". Exclua-as no painel quando houver profissionais reais.

**Vídeos.** Ficam na pasta `uploads/` (ou onde `UPLOAD_DIR` apontar). Só quem está logado consegue assistir.

---

## 5. Colocar no ar

Qualquer hospedagem que rode Node.js (ou Docker) e tenha MySQL serve. Abaixo, dois caminhos.

Em qualquer um deles, três coisas são obrigatórias:

1. **HTTPS.** Com `NODE_ENV=production` o cookie de login só funciona em `https://`.
2. **Disco persistente para os vídeos.** Aponte `UPLOAD_DIR` para um volume; sem isso os vídeos somem a cada atualização do site.
3. **Google.** No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), abra o seu ID do cliente OAuth e adicione o endereço do site (ex.: `https://conect60.com.br`) em **Origens JavaScript autorizadas**. Sem isso o botão do Google não funciona no endereço novo.

### Caminho A — Railway (mais simples)

1. Envie o projeto para um repositório **privado** no GitHub. O `.env` não vai junto (está no `.gitignore`).
2. No [Railway](https://railway.com), crie um projeto com **Deploy from GitHub repo** e escolha o repositório. Ele usa o `Dockerfile` automaticamente.
3. No mesmo projeto, adicione um banco **MySQL**.
4. No serviço do site, em **Variables**, crie:
   - `DATABASE_URL` = `${{MySQL.MYSQL_URL}}` (referência ao banco criado no passo 3)
   - `NODE_ENV` = `production`
   - `GOOGLE_CLIENT_ID`, `ADMIN_TELEFONE`, `ADMIN_SENHA`, `ADMIN_NOME`
   - `UPLOAD_DIR` = `/app/uploads`
5. No serviço do site, adicione um **Volume** montado em `/app/uploads`.
6. Em **Settings → Networking**, gere um domínio (ou conecte o seu). Coloque esse endereço em `SITE_URL` e no Google (item 3 acima).
7. A cada `git push`, o Railway publica de novo. Ao iniciar, o site atualiza as tabelas e cria os dados iniciais sozinho.

O Railway cobra por uso; confira os valores no site deles antes de começar.

### Caminho B — Servidor próprio (VPS) com Docker

Em um servidor Linux com Docker instalado e o seu domínio apontando para o IP dele:

```bash
git clone SEU_REPOSITORIO conect60 && cd conect60
cp .env.example .env
nano .env        # preencha DB_SENHA, DOMINIO, SITE_URL, ADMIN_*, GOOGLE_CLIENT_ID e NODE_ENV=production
docker compose --profile https up -d --build
```

Isso sobe o MySQL, o site e o Caddy, que emite o certificado HTTPS sozinho. Para atualizar depois: `git pull && docker compose --profile https up -d --build`.

Para testar o Docker no seu computador, sem domínio: deixe `NODE_ENV=development`, rode `docker compose up -d --build` e abra http://localhost:3000.

### Backup

- **Banco:** `docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" conect60' > backup.sql` (no Railway, use o backup do próprio painel).
- **Vídeos:** copie o conteúdo do volume `uploads`.

---

## 6. Antes de divulgar o site

- [ ] Trocar o telefone e o e-mail de contato de teste em `public/index.html` (procure por `99999-0000` e `conect60.test`).
- [ ] Enviar os vídeos reais das aulas.
- [ ] Ler e ajustar `public/privacidade.html` com o orientador (é um texto-base, não substitui revisão jurídica).
- [ ] Definir uma `ADMIN_SENHA` forte e diferente da usada nos testes.
- [ ] Excluir os perfis de demonstração quando houver profissionais reais.

---

## 7. Segurança (resumo)

- Senhas guardadas com hash `scrypt` e sal aleatório por usuário.
- Login por cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção); no banco fica só o hash do token.
- Limite de tentativas por IP em login, cadastro, senha e contato.
- Requisições que alteram dados só são aceitas quando vêm do próprio site.
- Só a pasta `public/` é servida; `src/`, `.env`, `prisma/` e `uploads/` não ficam acessíveis pelo navegador.
- Textos digitados por usuários são escapados antes de aparecer na tela.

## 8. Estrutura de pastas

```
public/            site (index.html, script.js, style.css, admin, privacidade, imagens)
src/server.js      liga o servidor
src/app.js         configura o Express
src/routes/        lista de rotas da API
src/controllers/   o que cada rota faz
src/middlewares/   login obrigatório, segurança
src/utils/         senha, sessão, arquivos, validação
prisma/            schema do banco, dados iniciais (seed)
uploads/           vídeos enviados (não vai para o GitHub)
```

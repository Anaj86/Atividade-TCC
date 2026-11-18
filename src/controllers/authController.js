const { OAuth2Client } = require('google-auth-library');
const prisma = require('../models/prismaClient');
const { gerarHash, conferir, sha256 } = require('../utils/senha');
const { abrirSessao, fecharSessao } = require('../utils/sessao');
const { digitos, texto, telefoneValido, emailValido, senhaValida, usuarioPublico } = require('../utils/validar');

let oauth;
const cliente = () => (oauth = oauth || new OAuth2Client(process.env.GOOGLE_CLIENT_ID));

// GET /api/auth/config  -> o front pega o ID do cliente Google daqui (fica só no .env)
const config = (req, res) => res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });

// GET /api/auth/eu  -> quem está logado (ou null)
const eu = (req, res) => res.json({ usuario: req.usuario ? usuarioPublico(req.usuario) : null });

// POST /api/auth/cadastro  { nome, telefone, senha, perfil: "idoso" | "pro", email?, crefito? }
const cadastro = async (req, res) => {
  const nome = texto(req.body.nome, 150);
  const telefone = digitos(req.body.telefone);
  const senha = req.body.senha;
  const pro = req.body.perfil === 'pro';
  const email = texto(req.body.email, 191).toLowerCase();
  const crefito = texto(req.body.crefito, 40);

  if (nome.length < 2) return res.status(400).json({ erro: 'Digite o seu nome completo.' });
  if (!telefoneValido(telefone)) return res.status(400).json({ erro: 'Digite um telefone válido, com DDD.' });
  if (!senhaValida(senha)) return res.status(400).json({ erro: 'A senha precisa ter 6 caracteres ou mais.' });
  if (pro && !emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (pro && !crefito) return res.status(400).json({ erro: 'Informe o número do Crefito.' });
  if (email && !emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });

  if (await prisma.usuario.findUnique({ where: { telefone } })) return res.status(409).json({ erro: 'Este telefone já tem cadastro. Use Entrar.' });
  if (email && await prisma.usuario.findUnique({ where: { email } })) return res.status(409).json({ erro: 'Este e-mail já tem cadastro. Use Entrar.' });

  const usuario = await prisma.usuario.create({
    data: { nome, telefone, email: email || null, senhaHash: await gerarHash(senha), pro, crefito: pro ? crefito : null }
  });
  await abrirSessao(res, usuario.id);
  return res.status(201).json({ usuario: usuarioPublico(usuario) });
};

// POST /api/auth/login  { telefone, senha }
const login = async (req, res) => {
  const telefone = digitos(req.body.telefone);
  const usuario = telefone ? await prisma.usuario.findUnique({ where: { telefone } }) : null;
  const ok = usuario && usuario.ativo && await conferir(req.body.senha || '', usuario.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Telefone ou senha incorretos.' });
  await abrirSessao(res, usuario.id);
  return res.json({ usuario: usuarioPublico(usuario) });
};

// POST /api/auth/logout
const logout = async (req, res) => {
  await fecharSessao(req, res);
  return res.json({ ok: true });
};

// POST /api/auth/google
// 1) { credential }                         -> entra (200) ou pede para completar o cadastro (200, precisaCompletar)
// 2) { credential, telefone, perfil, ... }  -> cria a conta (201)
const google = async (req, res) => {
  const { credential, nome, telefone, perfil, crefito } = req.body;
  if (!credential) return res.status(400).json({ erro: 'Credencial do Google ausente.' });
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).json({ erro: 'GOOGLE_CLIENT_ID não configurado no servidor.' });

  // O servidor confere a assinatura do token com o Google (não confia no que o navegador diz)
  let p;
  try {
    const ticket = await cliente().verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    p = ticket.getPayload();
  } catch {
    return res.status(401).json({ erro: 'Login do Google inválido ou expirado. Tente de novo.' });
  }
  if (!p.email || !p.email_verified) return res.status(401).json({ erro: 'Sua conta Google precisa ter um e-mail verificado.' });

  // Já cadastrado com este Google: entra direto
  const existente = await prisma.usuario.findUnique({ where: { googleId: p.sub } });
  if (existente) {
    if (!existente.ativo) return res.status(403).json({ erro: 'Esta conta está desativada. Fale com a nossa equipe.' });
    await abrirSessao(res, existente.id);
    return res.json({ usuario: usuarioPublico(existente) });
  }

  const email = p.email.toLowerCase();
  if (await prisma.usuario.findUnique({ where: { email } })) {
    return res.status(409).json({ erro: 'Já existe uma conta com este e-mail. Entre com telefone e senha.' });
  }

  const foto = /^https:\/\//.test(p.picture || '') ? p.picture.replace(/=s\d+-c$/, '=s256-c') : null;

  // Conta nova: falta o telefone e o tipo de perfil
  if (!telefone) {
    return res.json({ precisaCompletar: true, perfil: { nome: p.name || '', email: p.email, foto } });
  }

  const tel = digitos(telefone);
  if (!telefoneValido(tel)) return res.status(400).json({ erro: 'Digite um telefone válido, com DDD.' });
  if (await prisma.usuario.findUnique({ where: { telefone: tel } })) return res.status(409).json({ erro: 'Este telefone já tem cadastro.' });

  const pro = perfil === 'pro';
  if (pro && !texto(crefito)) return res.status(400).json({ erro: 'Informe o número do Crefito.' });

  const usuario = await prisma.usuario.create({
    data: {
      nome: texto(nome || p.name, 150) || p.email,
      email,
      telefone: tel,
      googleId: p.sub,
      foto,
      pro,
      crefito: pro ? texto(crefito, 40) : null
    }
  });
  await abrirSessao(res, usuario.id);
  return res.status(201).json({ usuario: usuarioPublico(usuario) });
};

// POST /api/auth/senha/pedido  { telefone }
// Registra o pedido. A equipe (painel admin) confirma a identidade por telefone e gera o código.
// A resposta é sempre igual, para não revelar quais telefones têm cadastro.
const pedirCodigo = async (req, res) => {
  const telefone = digitos(req.body.telefone);
  if (!telefoneValido(telefone)) return res.status(400).json({ erro: 'Informe um telefone com DDD.' });
  const usuario = await prisma.usuario.findUnique({ where: { telefone } });
  if (usuario && usuario.ativo) {
    const aberto = await prisma.pedidoSenha.findFirst({ where: { usuarioId: usuario.id, status: 'PENDENTE' } });
    if (!aberto) await prisma.pedidoSenha.create({ data: { usuarioId: usuario.id } });
  }
  return res.json({ ok: true, mensagem: 'Pedido registrado. Nossa equipe vai entrar em contato pelo seu telefone e informar um código de 6 números.' });
};

// POST /api/auth/senha/redefinir  { telefone, codigo, senha }
const redefinir = async (req, res) => {
  const telefone = digitos(req.body.telefone);
  const codigo = digitos(req.body.codigo);
  const invalido = () => res.status(400).json({ erro: 'Código incorreto ou vencido. Confira os números ou peça um novo código.' });
  if (!senhaValida(req.body.senha)) return res.status(400).json({ erro: 'A senha precisa ter 6 caracteres ou mais.' });
  if (codigo.length !== 6) return invalido();

  const usuario = telefone ? await prisma.usuario.findUnique({ where: { telefone } }) : null;
  if (!usuario || !usuario.ativo) return invalido();
  const pedido = await prisma.pedidoSenha.findFirst({ where: { usuarioId: usuario.id, status: 'CODIGO_GERADO' }, orderBy: { id: 'desc' } });
  if (!pedido || !pedido.expiraEm || pedido.expiraEm < new Date() || pedido.tentativas >= 5) return invalido();

  if (pedido.codigoHash !== sha256(codigo)) {
    await prisma.pedidoSenha.update({ where: { id: pedido.id }, data: { tentativas: pedido.tentativas + 1 } });
    return invalido();
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash: await gerarHash(req.body.senha) } });
  await prisma.pedidoSenha.update({ where: { id: pedido.id }, data: { status: 'USADO', codigoHash: null } });
  await prisma.sessao.deleteMany({ where: { usuarioId: usuario.id } }); // derruba logins antigos
  return res.json({ ok: true });
};

module.exports = { config, eu, cadastro, login, logout, google, pedirCodigo, redefinir };

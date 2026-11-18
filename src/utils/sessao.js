// Sessão de login: um token aleatório vai num cookie httpOnly (o JavaScript da página não consegue ler)
// e no banco fica só o hash dele. Assim, mesmo que alguém copie o banco, não consegue "virar" um usuário.
const prisma = require('../models/prismaClient');
const { sha256, tokenAleatorio } = require('./senha');

const COOKIE = 'c60_sessao';
const DIAS = 30;
const emProducao = () => process.env.NODE_ENV === 'production';

const lerCookies = req => {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(par => {
    const i = par.indexOf('=');
    if (i > 0) { try { out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim()); } catch { /* cookie malformado: ignora */ } }
  });
  return out;
};

const montarCookie = (valor, maxAgeSeg) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeg}${emProducao() ? '; Secure' : ''}`;

const abrirSessao = async (res, usuarioId) => {
  const token = tokenAleatorio();
  await prisma.sessao.create({
    data: { tokenHash: sha256(token), usuarioId, expiraEm: new Date(Date.now() + DIAS * 864e5) }
  });
  res.setHeader('Set-Cookie', montarCookie(token, DIAS * 86400));
};

const fecharSessao = async (req, res) => {
  const token = lerCookies(req)[COOKIE];
  if (token) await prisma.sessao.deleteMany({ where: { tokenHash: sha256(token) } });
  res.setHeader('Set-Cookie', montarCookie('', 0));
};

// Devolve o usuário logado (ou null)
const usuarioDaSessao = async req => {
  const token = lerCookies(req)[COOKIE];
  if (!token || token.length !== 64) return null;
  const sessao = await prisma.sessao.findUnique({ where: { tokenHash: sha256(token) }, include: { usuario: true } });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario || !sessao.usuario.ativo) return null;
  return sessao.usuario;
};

const limparSessoesVencidas = () =>
  prisma.sessao.deleteMany({ where: { expiraEm: { lt: new Date() } } }).catch(() => {});

module.exports = { abrirSessao, fecharSessao, usuarioDaSessao, limparSessoesVencidas };

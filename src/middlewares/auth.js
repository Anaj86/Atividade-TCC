const { usuarioDaSessao } = require('../utils/sessao');

// Coloca req.usuario quando há login válido (não bloqueia quem não está logado)
const carregarUsuario = async (req, res, next) => {
  req.usuario = await usuarioDaSessao(req);
  next();
};

const exigirLogin = (req, res, next) =>
  req.usuario ? next() : res.status(401).json({ erro: 'Entre na sua conta para continuar.' });

const exigirPro = (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  if (!req.usuario.pro) return res.status(403).json({ erro: 'Área exclusiva para profissionais.' });
  next();
};

const exigirAdmin = (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  if (!req.usuario.admin) return res.status(403).json({ erro: 'Área exclusiva da administração.' });
  next();
};

module.exports = { carregarUsuario, exigirLogin, exigirPro, exigirAdmin };

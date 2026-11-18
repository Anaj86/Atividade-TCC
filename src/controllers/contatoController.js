const prisma = require('../models/prismaClient');
const { texto, emailValido } = require('../utils/validar');

// POST /api/contato  { nome, email, mensagem }  -> fica guardada e aparece no painel da administração
const enviar = async (req, res) => {
  const nome = texto(req.body.nome, 150);
  const email = texto(req.body.email, 191).toLowerCase();
  const mensagem = texto(req.body.mensagem, 4000);
  if (nome.length < 2) return res.status(400).json({ erro: 'Digite o seu nome.' });
  if (!emailValido(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  if (mensagem.length < 3) return res.status(400).json({ erro: 'Escreva a sua mensagem.' });
  await prisma.mensagemContato.create({ data: { nome, email, mensagem } });
  return res.status(201).json({ ok: true });
};

module.exports = { enviar };

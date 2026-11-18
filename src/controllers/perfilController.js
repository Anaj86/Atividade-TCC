const prisma = require('../models/prismaClient');
const { gerarHash, conferir } = require('../utils/senha');
const { fecharSessao } = require('../utils/sessao');
const { digitos, texto, telefoneValido, senhaValida, usuarioPublico } = require('../utils/validar');
const { apagarArquivo } = require('../utils/arquivos');

// PUT /api/perfil  { nome, telefone, titulo?, resumo? }
const atualizar = async (req, res) => {
  const nome = texto(req.body.nome, 150);
  const telefone = digitos(req.body.telefone);
  if (nome.length < 2) return res.status(400).json({ erro: 'Digite o seu nome completo.' });
  if (!telefoneValido(telefone)) return res.status(400).json({ erro: 'Informe um telefone com DDD.' });
  if (telefone !== req.usuario.telefone && await prisma.usuario.findUnique({ where: { telefone } })) {
    return res.status(409).json({ erro: 'Este telefone já está em uso.' });
  }
  const data = { nome, telefone };
  if (req.usuario.pro) {
    data.titulo = texto(req.body.titulo, 150) || null;
    data.resumo = texto(req.body.resumo, 2000) || null;
  }
  const usuario = await prisma.usuario.update({ where: { id: req.usuario.id }, data });
  return res.json({ usuario: usuarioPublico(usuario) });
};

// PUT /api/perfil/senha  { atual?, nova }   (conta Google sem senha pode criar uma sem informar a atual)
const trocarSenha = async (req, res) => {
  const u = req.usuario;
  if (u.senhaHash) {
    if (!req.body.atual) return res.status(400).json({ erro: 'Digite a senha atual.', campo: 'atual' });
    if (!await conferir(req.body.atual, u.senhaHash)) return res.status(400).json({ erro: 'A senha atual está incorreta.', campo: 'atual' });
  }
  if (!senhaValida(req.body.nova)) return res.status(400).json({ erro: 'A nova senha precisa ter 6 caracteres ou mais.', campo: 'nova' });
  const usuario = await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await gerarHash(req.body.nova) } });
  return res.json({ usuario: usuarioPublico(usuario) });
};

// PUT /api/perfil/foto  { foto: "data:image/jpeg;base64,..." }   (o site já recorta para 256x256)
const salvarFoto = async (req, res) => {
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 250000) {
    return res.status(400).json({ erro: 'Imagem inválida ou grande demais.' });
  }
  const usuario = await prisma.usuario.update({ where: { id: req.usuario.id }, data: { foto } });
  return res.json({ usuario: usuarioPublico(usuario) });
};

// DELETE /api/perfil/foto
const removerFoto = async (req, res) => {
  const usuario = await prisma.usuario.update({ where: { id: req.usuario.id }, data: { foto: null } });
  return res.json({ usuario: usuarioPublico(usuario) });
};

// DELETE /api/perfil  -> exclui a conta e todos os dados da pessoa (direito garantido pela LGPD)
const excluirConta = async (req, res) => {
  if (req.usuario.admin) return res.status(400).json({ erro: 'A conta de administrador não pode ser excluída por aqui.' });
  const aulas = await prisma.aula.findMany({ where: { profissionalId: req.usuario.id } });
  await fecharSessao(req, res);
  await prisma.usuario.delete({ where: { id: req.usuario.id } }); // o banco apaga em cascata sessões, aulas, progresso e avaliações
  await Promise.all(aulas.map(a => apagarArquivo(a.arquivo)));
  return res.json({ ok: true });
};

module.exports = { atualizar, trocarSenha, salvarFoto, removerFoto, excluirConta };

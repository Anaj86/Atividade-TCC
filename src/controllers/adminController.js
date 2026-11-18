const prisma = require('../models/prismaClient');
const { idValido, usuarioPublico } = require('../utils/validar');
const { sha256, codigoNumerico } = require('../utils/senha');
const { apagarArquivo } = require('../utils/arquivos');

// GET /api/admin/resumo
const resumo = async (req, res) => {
  const [idosos, profissionais, crefitoPendente, aulas, mensagensNovas, pedidosSenha, avaliacoes] = await Promise.all([
    prisma.usuario.count({ where: { pro: false, admin: false } }),
    prisma.usuario.count({ where: { pro: true, demo: false } }),
    prisma.usuario.count({ where: { pro: true, demo: false, crefitoVerificado: false } }),
    prisma.aula.count(),
    prisma.mensagemContato.count({ where: { lida: false } }),
    prisma.pedidoSenha.count({ where: { status: 'PENDENTE' } }),
    prisma.avaliacao.findMany()
  ]);
  const media = avaliacoes.length ? avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length : null;
  return res.json({ idosos, profissionais, crefitoPendente, aulas, mensagensNovas, pedidosSenha, avaliacoes: avaliacoes.length, notaMedia: media });
};

// GET /api/admin/usuarios
const usuarios = async (req, res) => {
  const lista = await prisma.usuario.findMany({ orderBy: { id: 'desc' } });
  return res.json(lista.map(u => ({ ...usuarioPublico(u), foto: undefined, demo: !!u.demo, ativo: !!u.ativo, dataCriacao: u.dataCriacao })));
};

// PATCH /api/admin/usuarios/:id  { crefitoVerificado?, ativo? }
const editarUsuario = async (req, res) => {
  const id = idValido(req.params.id);
  const alvo = id && await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  const data = {};
  if (typeof req.body.crefitoVerificado === 'boolean') data.crefitoVerificado = req.body.crefitoVerificado;
  if (typeof req.body.ativo === 'boolean') {
    if (alvo.id === req.usuario.id) return res.status(400).json({ erro: 'Você não pode desativar a própria conta.' });
    data.ativo = req.body.ativo;
  }
  const u = await prisma.usuario.update({ where: { id }, data });
  if (data.ativo === false) await prisma.sessao.deleteMany({ where: { usuarioId: id } });
  return res.json({ ...usuarioPublico(u), foto: undefined, demo: !!u.demo, ativo: !!u.ativo });
};

// DELETE /api/admin/usuarios/:id
const excluirUsuario = async (req, res) => {
  const id = idValido(req.params.id);
  const alvo = id && await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (alvo.id === req.usuario.id) return res.status(400).json({ erro: 'Você não pode excluir a própria conta.' });
  const aulas = await prisma.aula.findMany({ where: { profissionalId: id } });
  await prisma.usuario.delete({ where: { id } });
  await Promise.all(aulas.map(a => apagarArquivo(a.arquivo)));
  return res.json({ ok: true });
};

// GET /api/admin/mensagens
const mensagens = async (req, res) =>
  res.json(await prisma.mensagemContato.findMany({ orderBy: { id: 'desc' }, take: 200 }));

// PATCH /api/admin/mensagens/:id  { lida }
const marcarMensagem = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id || !await prisma.mensagemContato.findUnique({ where: { id } })) return res.status(404).json({ erro: 'Mensagem não encontrada.' });
  return res.json(await prisma.mensagemContato.update({ where: { id }, data: { lida: req.body.lida !== false } }));
};

// DELETE /api/admin/mensagens/:id
const excluirMensagem = async (req, res) => {
  const id = idValido(req.params.id);
  if (id) await prisma.mensagemContato.deleteMany({ where: { id } });
  return res.json({ ok: true });
};

// GET /api/admin/pedidos-senha
const pedidosSenha = async (req, res) => {
  const lista = await prisma.pedidoSenha.findMany({ orderBy: { id: 'desc' }, take: 100, include: { usuario: true } });
  return res.json(lista.map(p => ({
    id: p.id, status: p.status, criadoEm: p.criadoEm, expiraEm: p.expiraEm,
    usuario: { id: p.usuario.id, nome: p.usuario.nome, telefone: p.usuario.telefone || '' }
  })));
};

// POST /api/admin/pedidos-senha/:id/codigo  -> gera o código de 6 números (vale 24 h). Ele aparece UMA vez, aqui.
const gerarCodigo = async (req, res) => {
  const id = idValido(req.params.id);
  const pedido = id && await prisma.pedidoSenha.findUnique({ where: { id } });
  if (!pedido || pedido.status === 'USADO') return res.status(404).json({ erro: 'Pedido não encontrado ou já usado.' });
  const codigo = codigoNumerico();
  await prisma.pedidoSenha.update({
    where: { id },
    data: { status: 'CODIGO_GERADO', codigoHash: sha256(codigo), tentativas: 0, expiraEm: new Date(Date.now() + 24 * 3600 * 1000) }
  });
  return res.json({ codigo, validoPorHoras: 24 });
};

// GET /api/admin/aulas
const aulas = async (req, res) => {
  const lista = await prisma.aula.findMany({ orderBy: [{ destaque: 'desc' }, { ordem: 'asc' }, { id: 'asc' }], include: { profissional: true } });
  return res.json(lista.map(a => ({
    id: a.id, titulo: a.titulo, duracao: a.duracao || '', destaque: !!a.destaque, ordem: a.ordem, temVideo: !!a.arquivo,
    profissional: a.profissional ? a.profissional.nome : 'Equipe Conect60+'
  })));
};

// PATCH /api/admin/aulas/:id  { destaque?, ordem? }
const editarAula = async (req, res) => {
  const id = idValido(req.params.id);
  if (!id || !await prisma.aula.findUnique({ where: { id } })) return res.status(404).json({ erro: 'Aula não encontrada.' });
  const data = {};
  if (typeof req.body.destaque === 'boolean') data.destaque = req.body.destaque;
  if (Number.isInteger(req.body.ordem)) data.ordem = req.body.ordem;
  const a = await prisma.aula.update({ where: { id }, data });
  return res.json({ id: a.id, destaque: !!a.destaque, ordem: a.ordem });
};

// GET /api/admin/avaliacoes
const avaliacoes = async (req, res) => {
  const lista = await prisma.avaliacao.findMany({ orderBy: { id: 'desc' }, take: 300, include: { aluno: true, profissional: true } });
  return res.json(lista.map(a => ({
    id: a.id, nota: a.nota, criadoEm: a.criadoEm, aluno: a.aluno.nome,
    profissional: a.profissional ? a.profissional.nome : 'Equipe Conect60+'
  })));
};

module.exports = { resumo, usuarios, editarUsuario, excluirUsuario, mensagens, marcarMensagem, excluirMensagem, pedidosSenha, gerarCodigo, aulas, editarAula, avaliacoes };

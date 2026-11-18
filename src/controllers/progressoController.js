const prisma = require('../models/prismaClient');
const { idValido } = require('../utils/validar');

// GET /api/progresso  -> ids das aulas concluídas + se já avaliou
const listar = async (req, res) => {
  const feitos = await prisma.progresso.findMany({ where: { usuarioId: req.usuario.id } });
  const avaliacao = await prisma.avaliacao.findUnique({ where: { alunoId: req.usuario.id } });
  return res.json({ concluidas: feitos.map(p => p.aulaId), avaliou: !!avaliacao });
};

// POST /api/progresso/:aulaId  -> marca a aula como concluída
const concluir = async (req, res) => {
  const aulaId = idValido(req.params.aulaId);
  const aula = aulaId && await prisma.aula.findUnique({ where: { id: aulaId } });
  if (!aula) return res.status(404).json({ erro: 'Aula não encontrada.' });
  await prisma.progresso.upsert({
    where: { usuarioId_aulaId: { usuarioId: req.usuario.id, aulaId } },
    update: {},
    create: { usuarioId: req.usuario.id, aulaId }
  });
  return res.json({ ok: true });
};

// POST /api/avaliacoes  { nota: 1..4 }  -> só depois de concluir todas as aulas de "Suas aulas"
const avaliar = async (req, res) => {
  const nota = Number(req.body.nota);
  if (![1, 2, 3, 4].includes(nota)) return res.status(400).json({ erro: 'Escolha uma das opções.' });
  if (req.usuario.pro) return res.status(403).json({ erro: 'A avaliação é feita pelos alunos.' });

  const destaque = await prisma.aula.findMany({ where: { destaque: true }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }], include: { profissional: true } });
  const feitos = (await prisma.progresso.findMany({ where: { usuarioId: req.usuario.id } })).map(p => p.aulaId);
  if (!destaque.length || destaque.some(a => !feitos.includes(a.id))) {
    return res.status(400).json({ erro: 'Conclua todas as suas aulas antes de avaliar.' });
  }
  const prof = destaque.map(a => a.profissional).find(p => p && !p.demo);
  const dados = { nota, profissionalId: prof ? prof.id : null };
  await prisma.avaliacao.upsert({ where: { alunoId: req.usuario.id }, update: dados, create: { alunoId: req.usuario.id, ...dados } });
  return res.status(201).json({ ok: true });
};

module.exports = { listar, concluir, avaliar };

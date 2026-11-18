const prisma = require('../models/prismaClient');
const { idValido, aulaPublica } = require('../utils/validar');
const { enviarArquivo } = require('../utils/arquivos');

// GET /api/categorias  -> categorias com os exercícios (conteúdo aberto)
const categorias = async (req, res) => {
  const lista = await prisma.categoria.findMany({ orderBy: { ordem: 'asc' }, include: { exercicios: true } });
  return res.json(lista.map(c => ({
    id: c.id, nome: c.nome, slug: c.slug, descricao: c.descricao, imagem: c.imagem,
    exercicios: [...c.exercicios].sort((a, b) => a.ordem - b.ordem)
      .map(e => ({ id: e.id, nome: e.nome, duracao: e.duracao, nivel: e.nivel, passos: Array.isArray(e.passos) ? e.passos : [] }))
  })));
};

// GET /api/aulas/destaque  -> as aulas de "Suas aulas" + quem será avaliado ao final
const aulasDestaque = async (req, res) => {
  const aulas = await prisma.aula.findMany({ where: { destaque: true }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }], include: { profissional: true } });
  const prof = aulas.map(a => a.profissional).find(p => p && !p.demo);
  return res.json({ aulas: aulas.map(aulaPublica), avaliado: prof ? prof.nome : 'Equipe Conect60+' });
};

// Um profissional só aparece para os idosos depois que a administração confere o Crefito
const visivel = p => p && p.pro && p.ativo && (p.crefitoVerificado || p.demo);

// GET /api/profissionais
const profissionais = async (req, res) => {
  const lista = await prisma.usuario.findMany({ where: { pro: true, ativo: true }, orderBy: { id: 'asc' }, include: { aulas: true } });
  return res.json(lista.filter(visivel).sort((a, b) => Number(a.demo) - Number(b.demo)).map(p => ({
    id: p.id,
    nome: p.nome,
    foto: p.foto || '',
    titulo: p.titulo || 'Fisioterapeuta',
    resumo: p.resumo || 'Este profissional ainda não escreveu um resumo.',
    demo: !!p.demo,
    aulas: [...p.aulas].sort((a, b) => a.id - b.id).map(aulaPublica)
  })));
};

// GET /api/aulas/:id/video  -> o arquivo da aula (só para quem está logado)
const video = async (req, res) => {
  const id = idValido(req.params.id);
  const aula = id && await prisma.aula.findUnique({ where: { id }, include: { profissional: true } });
  if (!aula || !aula.arquivo) return res.status(404).json({ erro: 'Esta aula ainda não tem vídeo.' });
  const dono = aula.profissionalId === req.usuario.id;
  if (aula.profissional && !visivel(aula.profissional) && !dono && !req.usuario.admin) {
    return res.status(404).json({ erro: 'Esta aula ainda não tem vídeo.' });
  }
  return enviarArquivo(req, res, aula.arquivo, aula.mime);
};

module.exports = { categorias, aulasDestaque, profissionais, video };

const crypto = require('crypto');
const prisma = require('../models/prismaClient');
const { texto, idValido, aulaPublica } = require('../utils/validar');
const { TIPOS, limiteBytes, receberArquivo, apagarArquivo } = require('../utils/arquivos');

const MAX_AULAS = 100;

// GET /api/minhas-aulas  -> aulas publicadas pelo profissional logado
const minhas = async (req, res) => {
  const aulas = await prisma.aula.findMany({ where: { profissionalId: req.usuario.id }, orderBy: { id: 'asc' } });
  return res.json(aulas.map(aulaPublica));
};

// POST /api/aulas  { titulo, duracao? }  -> cria a aula (o arquivo vai depois, no PUT abaixo)
const criar = async (req, res) => {
  const titulo = texto(req.body.titulo, 150);
  if (titulo.length < 2) return res.status(400).json({ erro: 'Dê um título para a aula.' });
  if (await prisma.aula.count({ where: { profissionalId: req.usuario.id } }) >= MAX_AULAS) {
    return res.status(400).json({ erro: `Você atingiu o limite de ${MAX_AULAS} aulas.` });
  }
  const aula = await prisma.aula.create({ data: { titulo, duracao: texto(req.body.duracao, 30) || null, profissionalId: req.usuario.id } });
  return res.status(201).json(aulaPublica(aula));
};

// PUT /api/aulas/:id/arquivo  -> corpo = o próprio arquivo (Content-Type: video/mp4, image/jpeg...)
const enviar = async (req, res) => {
  const id = idValido(req.params.id);
  const aula = id && await prisma.aula.findUnique({ where: { id } });
  if (!aula || (aula.profissionalId !== req.usuario.id && !req.usuario.admin)) return res.status(404).json({ erro: 'Aula não encontrada.' });

  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = TIPOS[mime];
  if (!ext) return res.status(415).json({ erro: 'Formato não aceito. Envie vídeo MP4, WEBM ou MOV, ou imagem JPG, PNG ou WEBP.' });
  const limite = limiteBytes();
  if (Number(req.headers['content-length']) > limite) return res.status(413).json({ erro: `Arquivo muito grande. O limite é ${Math.round(limite / 1048576)} MB.` });

  const nome = `aula-${aula.id}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  let tamanho;
  try {
    tamanho = await receberArquivo(req, nome);
  } catch (e) {
    if (e.status === 413) return res.status(413).json({ erro: `Arquivo muito grande. O limite é ${Math.round(limite / 1048576)} MB.` });
    if (e.status === 400) return res.status(400).json({ erro: 'O arquivo chegou vazio ou o envio foi interrompido.' });
    throw e;
  }
  const antigo = aula.arquivo;
  const salva = await prisma.aula.update({ where: { id: aula.id }, data: { arquivo: nome, mime, tamanho } });
  await apagarArquivo(antigo);
  return res.json(aulaPublica(salva));
};

// DELETE /api/aulas/:id
const remover = async (req, res) => {
  const id = idValido(req.params.id);
  const aula = id && await prisma.aula.findUnique({ where: { id } });
  if (!aula || (aula.profissionalId !== req.usuario.id && !req.usuario.admin)) return res.status(404).json({ erro: 'Aula não encontrada.' });
  await prisma.aula.delete({ where: { id: aula.id } });
  await apagarArquivo(aula.arquivo);
  return res.json({ ok: true });
};

module.exports = { minhas, criar, enviar, remover };

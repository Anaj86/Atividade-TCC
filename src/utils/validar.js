// Pequenas funções de validação e de "formato público" dos dados
const digitos = v => String(v || '').replace(/\D/g, '');
const texto = (v, max = 255) => String(v == null ? '' : v).trim().slice(0, max);
const telefoneValido = tel => tel.length >= 10 && tel.length <= 13;
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 191;
const senhaValida = s => typeof s === 'string' && s.length >= 6 && s.length <= 200;
const idValido = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

// O que o navegador pode saber sobre o próprio usuário (nunca enviamos hash de senha nem googleId)
const usuarioPublico = u => ({
  id: u.id,
  nome: u.nome,
  email: u.email || '',
  telefone: u.telefone || '',
  foto: u.foto || '',
  pro: !!u.pro,
  admin: !!u.admin,
  crefito: u.crefito || '',
  crefitoVerificado: !!u.crefitoVerificado,
  titulo: u.titulo || '',
  resumo: u.resumo || '',
  temSenha: !!u.senhaHash,
  google: !!u.googleId
});

const aulaPublica = a => ({
  id: a.id,
  titulo: a.titulo,
  duracao: a.duracao || '',
  temVideo: !!a.arquivo,
  ehImagem: /^image\//.test(a.mime || ''),
  profissionalId: a.profissionalId || null
});

module.exports = { digitos, texto, telefoneValido, emailValido, senhaValida, idValido, usuarioPublico, aulaPublica };

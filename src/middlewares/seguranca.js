// Proteções básicas, sem dependências extras.

// Cabeçalhos de segurança
const cabecalhos = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // necessário para o login do Google
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  next();
};

// Só aceita POST/PUT/PATCH/DELETE vindos do próprio site (proteção contra CSRF, junto com o cookie SameSite)
const mesmaOrigem = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.headers.origin;
  if (!origem) return next();
  let host = '';
  try { host = new URL(origem).host; } catch { /* origem inválida */ }
  const permitidos = [req.headers['x-forwarded-host'], req.headers.host];
  try { if (process.env.SITE_URL) permitidos.push(new URL(process.env.SITE_URL).host); } catch { /* SITE_URL inválida */ }
  if (host && permitidos.includes(host)) return next();
  return res.status(403).json({ erro: 'Requisição de origem não permitida.' });
};

// Limite de tentativas por IP (em memória): evita que alguém fique testando senhas
const limitar = ({ janelaMs, max, mensagem }) => {
  const acessos = new Map();
  const faxina = setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of acessos) if (v.ate < agora) acessos.delete(k);
  }, 60000);
  faxina.unref();
  return (req, res, next) => {
    const chave = req.ip || (req.socket && req.socket.remoteAddress) || 'desconhecido';
    const agora = Date.now();
    let reg = acessos.get(chave);
    if (!reg || reg.ate < agora) { reg = { n: 0, ate: agora + janelaMs }; acessos.set(chave, reg); }
    reg.n++;
    if (reg.n > max) {
      res.setHeader('Retry-After', Math.ceil((reg.ate - agora) / 1000));
      return res.status(429).json({ erro: mensagem || 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    }
    next();
  };
};

module.exports = { cabecalhos, mesmaOrigem, limitar };

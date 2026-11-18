const path = require('path');
const express = require('express');
const rotas = require('./routes');
const { carregarUsuario } = require('./middlewares/auth');
const { cabecalhos, mesmaOrigem } = require('./middlewares/seguranca');

const app = express();
const publico = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
// Atrás do proxy da hospedagem (Railway, Render, Nginx...), para o IP e o HTTPS serem reconhecidos
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cabecalhos);

// ---------- API ----------
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', mesmaOrigem);
app.use('/api', express.json({ limit: '300kb' }));
app.use('/api', (req, res, next) => { if (!req.body || typeof req.body !== 'object') req.body = {}; next(); });
app.use('/api', carregarUsuario);
app.use('/api', rotas);
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ---------- Site (só a pasta public/ é servida; src/, .env e uploads/ nunca ficam expostos) ----------
app.use(express.static(publico, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use((req, res) => res.status(404).sendFile('404.html', { root: publico }));

// ---------- Erros ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ erro: 'Dados grandes demais.' });
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) return res.status(400).json({ erro: 'Dados inválidos.' });
  if (err && err.code === 'P2002') return res.status(409).json({ erro: 'Já existe um cadastro com estes dados.' });
  if (err && err.code === 'P2025') return res.status(404).json({ erro: 'Registro não encontrado.' });
  console.error(err);
  if (res.headersSent) return res.end();
  return res.status(500).json({ erro: 'Erro no servidor. Tente de novo em instantes.' });
});

module.exports = app;

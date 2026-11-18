// Vídeos e imagens das aulas ficam em disco, na pasta definida por UPLOAD_DIR (padrão: ./uploads).
// Em hospedagens como Railway/Render, aponte UPLOAD_DIR para um "volume" persistente, senão os arquivos somem a cada deploy.
const fs = require('fs');
const path = require('path');

const pastaUploads = () => path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
const limiteBytes = () => (Number(process.env.MAX_UPLOAD_MB) || 200) * 1024 * 1024;

const TIPOS = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/quicktime': 'mov',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'
};

const garantirPasta = () => fs.mkdirSync(pastaUploads(), { recursive: true });

// Só aceita nomes simples gerados por nós (nada de "../")
const caminhoSeguro = nome => (nome && /^[\w.-]+$/.test(nome) ? path.join(pastaUploads(), nome) : null);

const apagarArquivo = async nome => {
  const caminho = caminhoSeguro(nome);
  if (caminho) await fs.promises.unlink(caminho).catch(() => {});
};

// Grava o corpo da requisição direto no disco (sem carregar o vídeo inteiro na memória)
const receberArquivo = (req, nomeFinal) => new Promise((resolve, reject) => {
  garantirPasta();
  const destino = caminhoSeguro(nomeFinal);
  const temporario = destino + '.parte';
  const saida = fs.createWriteStream(temporario);
  const max = limiteBytes();
  let total = 0, terminou = false;

  const falhar = err => {
    if (terminou) return; terminou = true;
    req.unpipe(saida); saida.destroy();
    fs.unlink(temporario, () => reject(err));
  };
  req.on('data', bloco => {
    total += bloco.length;
    if (total > max) { const e = new Error('grande'); e.status = 413; falhar(e); req.resume(); }
  });
  req.on('aborted', () => falhar(Object.assign(new Error('envio interrompido'), { status: 400 })));
  req.on('error', falhar);
  saida.on('error', falhar);
  saida.on('finish', () => {
    if (terminou) return; terminou = true;
    if (!total) return fs.unlink(temporario, () => reject(Object.assign(new Error('vazio'), { status: 400 })));
    fs.rename(temporario, destino, err => (err ? reject(err) : resolve(total)));
  });
  req.pipe(saida);
});

// Envia o arquivo aceitando "Range" (necessário para o vídeo poder avançar/voltar, principalmente no iPhone)
const enviarArquivo = async (req, res, nome, mime) => {
  const caminho = caminhoSeguro(nome);
  const info = caminho && await fs.promises.stat(caminho).catch(() => null);
  if (!info) return res.status(404).json({ erro: 'Arquivo não encontrado.' });

  const tamanho = info.size;
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  let inicio = 0, fim = tamanho - 1;
  if (faixa && (faixa[1] || faixa[2])) {
    if (faixa[1]) { inicio = Number(faixa[1]); if (faixa[2]) fim = Math.min(Number(faixa[2]), tamanho - 1); }
    else inicio = Math.max(tamanho - Number(faixa[2]), 0);
    if (inicio > fim || inicio >= tamanho) {
      res.setHeader('Content-Range', `bytes */${tamanho}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${inicio}-${fim}/${tamanho}`);
  }
  res.setHeader('Content-Length', fim - inicio + 1);
  if (req.method === 'HEAD') return res.end();
  const leitura = fs.createReadStream(caminho, { start: inicio, end: fim });
  leitura.on('error', () => res.destroy());
  leitura.pipe(res);
};

module.exports = { TIPOS, pastaUploads, limiteBytes, garantirPasta, apagarArquivo, receberArquivo, enviarArquivo };

require('dotenv').config();
const app = require('./app');
const prisma = require('./models/prismaClient');
const { limparSessoesVencidas } = require('./utils/sessao');
const { garantirPasta, pastaUploads } = require('./utils/arquivos');

const PORT = process.env.PORT || 3000;

prisma.$connect()
  .then(() => {
    console.log('MySQL conectado (Prisma)');
    garantirPasta();
    console.log('Arquivos das aulas em:', pastaUploads());
    if (!process.env.GOOGLE_CLIENT_ID) console.warn('Aviso: GOOGLE_CLIENT_ID vazio — o botão do Google fica desligado.');

    limparSessoesVencidas();
    setInterval(limparSessoesVencidas, 6 * 3600 * 1000).unref();

    const servidor = app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    servidor.requestTimeout = 0; // envio de vídeos grandes pode demorar

    const encerrar = () => servidor.close(() => prisma.$disconnect().finally(() => process.exit(0)));
    process.on('SIGTERM', encerrar);
    process.on('SIGINT', encerrar);
  })
  .catch(error => {
    console.error('Não foi possível conectar ao MySQL:', error.message);
    process.exit(1);
  });

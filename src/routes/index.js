// Todas as rotas da API ficam em /api/...
const express = require('express');
const auth = require('../controllers/authController');
const perfil = require('../controllers/perfilController');
const conteudo = require('../controllers/conteudoController');
const aula = require('../controllers/aulaController');
const progresso = require('../controllers/progressoController');
const contato = require('../controllers/contatoController');
const admin = require('../controllers/adminController');
const { exigirLogin, exigirPro, exigirAdmin } = require('../middlewares/auth');
const { limitar } = require('../middlewares/seguranca');

const router = express.Router();

// Freios contra abuso (por IP)
const freioLogin = limitar({ janelaMs: 15 * 60 * 1000, max: 20 });
const freioCadastro = limitar({ janelaMs: 60 * 60 * 1000, max: 15 });
const freioSenha = limitar({ janelaMs: 60 * 60 * 1000, max: 10 });
const freioTroca = limitar({ janelaMs: 60 * 60 * 1000, max: 20 });
const freioContato = limitar({ janelaMs: 60 * 60 * 1000, max: 8, mensagem: 'Você já enviou várias mensagens. Tente de novo mais tarde.' });

router.get('/health', (req, res) => res.json({ ok: true }));

// --- autenticação ---
router.get('/auth/config', auth.config);
router.get('/auth/eu', auth.eu);
router.post('/auth/cadastro', freioCadastro, auth.cadastro);
router.post('/auth/login', freioLogin, auth.login);
router.post('/auth/logout', auth.logout);
router.post('/auth/google', freioLogin, auth.google);
router.post('/auth/senha/pedido', freioSenha, auth.pedirCodigo);
router.post('/auth/senha/redefinir', freioSenha, auth.redefinir);

// --- perfil do usuário logado ---
router.put('/perfil', exigirLogin, perfil.atualizar);
router.put('/perfil/senha', exigirLogin, freioTroca, perfil.trocarSenha);
router.put('/perfil/foto', exigirLogin, perfil.salvarFoto);
router.delete('/perfil/foto', exigirLogin, perfil.removerFoto);
router.delete('/perfil', exigirLogin, perfil.excluirConta);

// --- conteúdo ---
router.get('/categorias', conteudo.categorias);
router.get('/aulas/destaque', exigirLogin, conteudo.aulasDestaque);
router.get('/profissionais', exigirLogin, conteudo.profissionais);
router.get('/aulas/:id/video', exigirLogin, conteudo.video);

// --- aulas do profissional ---
router.get('/minhas-aulas', exigirPro, aula.minhas);
router.post('/aulas', exigirPro, aula.criar);
router.put('/aulas/:id/arquivo', exigirPro, aula.enviar);
router.delete('/aulas/:id', exigirPro, aula.remover);

// --- progresso e avaliação do idoso ---
router.get('/progresso', exigirLogin, progresso.listar);
router.post('/progresso/:aulaId', exigirLogin, progresso.concluir);
router.post('/avaliacoes', exigirLogin, progresso.avaliar);

// --- contato ---
router.post('/contato', freioContato, contato.enviar);

// --- administração ---
router.get('/admin/resumo', exigirAdmin, admin.resumo);
router.get('/admin/usuarios', exigirAdmin, admin.usuarios);
router.patch('/admin/usuarios/:id', exigirAdmin, admin.editarUsuario);
router.delete('/admin/usuarios/:id', exigirAdmin, admin.excluirUsuario);
router.get('/admin/mensagens', exigirAdmin, admin.mensagens);
router.patch('/admin/mensagens/:id', exigirAdmin, admin.marcarMensagem);
router.delete('/admin/mensagens/:id', exigirAdmin, admin.excluirMensagem);
router.get('/admin/pedidos-senha', exigirAdmin, admin.pedidosSenha);
router.post('/admin/pedidos-senha/:id/codigo', exigirAdmin, admin.gerarCodigo);
router.get('/admin/aulas', exigirAdmin, admin.aulas);
router.patch('/admin/aulas/:id', exigirAdmin, admin.editarAula);
router.delete('/admin/aulas/:id', exigirAdmin, aula.remover);
router.get('/admin/avaliacoes', exigirAdmin, admin.avaliacoes);

module.exports = router;

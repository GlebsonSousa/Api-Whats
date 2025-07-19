const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const validarMensagemEntrada = require('./utils/validarMensagemEntrada');
const {
  iniciarConexaoWhatsapp,
  gerarQRCode,
  obterStatusConexao,
  getConexao,
  limparSessaoAnterior
} = require('./utils/conexaoWhatsapp');

const app = express();
const porta = process.env.PORT || 3000;

// 📤 Função para enviar mensagem (fica no index.js)
async function enviarMensagem(numero, mensagem) {
  const conexao = getConexao();
  if (!conexao) throw new Error('❌ WhatsApp não está conectado.');
  await conexao.sendMessage(numero, { text: mensagem });
}

// ROTAS
app.get('/', (req, res) => {
  res.send('✅ API WhatsApp rodando!');
});

app.get('/iniciar', async (req, res) => {
  try {
    await iniciarConexaoWhatsapp();
    res.send('🔌 Conexão com WhatsApp iniciada!');
  } catch (erro) {
    res.status(500).send(`❌ Erro ao iniciar: ${erro.message}`);
  }
});

app.get('/qr', async (req, res) => {
  const qr = await gerarQRCode();
  if (!qr) {
    return res.send('✅ Sessão já conectada ou QR não disponível.');
  }

  res.send(`
    <h2>🔗 Escaneie o QR Code para conectar ao WhatsApp</h2>
    <img src="${qr}" />
    <script>
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    </script>
  `);
});

app.get('/status', (req, res) => {
  res.send(obterStatusConexao());
});

app.get('/enviar', async (req, res) => {
  const { numero, mensagem } = req.query;

  const erroValidacao = validarMensagemEntrada(numero, mensagem);
  if (erroValidacao) {
    return res.status(400).send(`${erroValidacao}`);
  }

  try {
    await enviarMensagem(`${numero}@s.whatsapp.net`, mensagem);
    res.send('✅ Mensagem enviada com sucesso!');
  } catch (erro) {
    res.status(500).send(`❌ Erro ao enviar: ${erro.message}`);
  }
});

// ♻️ Forçar nova sessão (novo QR)
app.get('/forcar-conexao', async (req, res) => {
  try {
    await iniciarConexaoWhatsapp(true); // true = força nova conexão
    res.send('🔄 Nova conexão forçada. Escaneie o QR code novamente.');
  } catch (erro) {
    res.status(500).send(`❌ Erro ao reiniciar conexão: ${erro.message}`);
  }
});

// 🚀 Iniciar servidor e conexão automática
app.listen(porta, () => {
  console.log(`🚀 Servidor rodando na porta ${porta}`);
  iniciarConexaoWhatsapp(); // inicia com sessão salva se existir
});

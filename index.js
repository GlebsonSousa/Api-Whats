const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

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

async function enviarParaBackend({ numero, mensagem, data }) {
  try {
    const response = await axios.post(`${process.env.URL_BACKEND}/recebemensagem`, {
      numero,
      mensagem,
      dataMsgRecebida: data
    });
    console.log(`✅ Enviado ao backend: ${numero}, ${mensagem}`);
    return response.data;
  } catch (erro) {
    console.error('❌ Erro ao enviar para o backend:', erro.message);
  }
}

function extrairDadosMensagem(infoMensagem) {
  const numero = infoMensagem.key.remoteJid.replace('@s.whatsapp.net', '');
  const mensagem = infoMensagem.message.conversation || infoMensagem.message.extendedTextMessage?.text || '';
  const data = new Date().toISOString();
  return { numero, mensagem, data };
}


// ✅ Função para lidar com mensagens recebidas
function aoReceberMensagem(mensagem) {
  const infoMensagem = mensagem.messages[0];
  if (!infoMensagem?.message || infoMensagem.key.fromMe) return;

  const dados = extrairDadosMensagem(infoMensagem);
  const erro = validarMensagemEntrada(dados.numero, dados.mensagem);

  if (erro) {
    console.log(`❌ Mensagem inválida de ${dados.numero}: ${erro}`);
    return;
  }

  enviarParaBackend(dados);
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

// ♻️ Forçar nova sessão (novo QR)
app.get('/forcar-conexao', async (req, res) => {
  try {
    await iniciarConexaoWhatsapp(true); // true = força nova conexão
    res.send('🔄 Nova conexão forçada. Escaneie o QR code novamente.');
  } catch (erro) {
    res.status(500).send(`❌ Erro ao reiniciar conexão: ${erro.message}`);
  }
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





// 🚀 Iniciar servidor e conexão automática
app.listen(porta, () => {
  console.log(`🚀 Servidor rodando na porta ${porta}`);
  iniciarConexaoWhatsapp(false, aoReceberMensagem); // inicia com sessão salva se existir
});
// 📦 Importação dos pacotes necessários
const { default: criarConexaoWhatsapp, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const validarMensagemEntrada = require('./utils/validarMensagemEntrada');
const axios = require('axios');

// 🚀 Inicializa o servidor Express
const app = express();
const porta = process.env.PORT || 3000;

// 🔗 Variáveis globais
let conexaoWhatsapp;
let qrCodeAtual = null;

// Função para extrair os dados importantes da mensagem
function extrairDadosMensagem(infoMensagem) {
  const numero = infoMensagem.key.remoteJid.replace('@s.whatsapp.net', '');
  const mensagem = infoMensagem.message.conversation || infoMensagem.message.extendedTextMessage?.text || '';
  const data = new Date().toISOString();
  return { numero, mensagem, data };
}

// Envia mensagem recebida para o backend
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

// Inicia conexão com WhatsApp
async function iniciarConexaoWhatsapp() {
  const { state, saveCreds } = await useMultiFileAuthState('dados_autenticacao');

  conexaoWhatsapp = criarConexaoWhatsapp({
    auth: state,
    printQRInTerminal: false
  });

  conexaoWhatsapp.ev.on('connection.update', (atualizacao) => {
    const { connection, lastDisconnect, qr } = atualizacao;

    if (qr) {
      qrCodeAtual = qr;
      console.log('🟨 QR Code gerado — Acesse /qr para escanear');
    }

    if (connection === 'close') {
      const deveReconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('🟥 Conexão fechada. Reconectar?', deveReconectar);
      if (deveReconectar) iniciarConexaoWhatsapp();
    } else if (connection === 'open') {
      console.log('🟩 Conectado ao WhatsApp!');
      qrCodeAtual = null;
    }
  });

  conexaoWhatsapp.ev.on('messages.upsert', async (mensagem) => {
    const infoMensagem = mensagem.messages[0];
    if (!infoMensagem.message || infoMensagem.key.fromMe) return;

    const numeroRemetente = infoMensagem.key.remoteJid;
    const conteudoMensagem = infoMensagem.message.conversation || infoMensagem.message.extendedTextMessage?.text;

    console.log(`📩 Mensagem recebida de ${numeroRemetente}: ${conteudoMensagem}`);

    const dados = extrairDadosMensagem(infoMensagem);
    const erro = validarMensagemEntrada(dados.numero, dados.mensagem);

    if (erro) {
      console.log(`❌ Mensagem inválida de ${dados.numero}: ${erro}`);
      return;
    }

    await enviarParaBackend(dados);
  });

  conexaoWhatsapp.ev.on('creds.update', saveCreds);
}

// Função para enviar mensagem
async function enviarMensagem(numero, mensagem) {
  if (!conexaoWhatsapp) throw new Error('❌ WhatsApp não está conectado.');
  await conexaoWhatsapp.sendMessage(numero, { text: mensagem });
}

// Gera o QR Code
async function gerarQRCode() {
  if (!qrCodeAtual) return null;
  return await qrcode.toDataURL(qrCodeAtual);
}

// Verifica status
function obterStatusConexao() {
  return conexaoWhatsapp ? '🟢 Conectado ao WhatsApp!' : '🔴 Não conectado!';
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

// Endpoint que envia mensagem manual
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

// Inicia o servidor
app.listen(porta, () => {
  console.log(`🚀 Servidor rodando na porta ${porta}`);
  iniciarConexaoWhatsapp();
});

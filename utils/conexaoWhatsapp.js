const fs = require('fs');
const path = require('path');
const { default: criarConexaoWhatsapp, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const validarMensagemEntrada = require('./utils/validarMensagemEntrada');
const axios = require('axios');
require('dotenv').config();

let conexaoWhatsapp = null;
let qrCodeAtual = null;

const pastaAuth = 'dados_autenticacao';
const caminhoCreds = path.join(pastaAuth, 'creds.json');

function extrairDadosMensagem(infoMensagem) {
  const numero = infoMensagem.key.remoteJid.replace('@s.whatsapp.net', '');
  const mensagem = infoMensagem.message.conversation || infoMensagem.message.extendedTextMessage?.text || '';
  const data = new Date().toISOString();
  return { numero, mensagem, data };
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

function limparSessaoAnterior() {
  if (fs.existsSync(pastaAuth)) {
    fs.rmSync(pastaAuth, { recursive: true, force: true });
    console.log('🧹 Sessão antiga removida!');
  }
}

async function iniciarConexaoWhatsapp(forcarNovaSessao = false) {
  if (forcarNovaSessao) limparSessaoAnterior();

  const { state, saveCreds } = await useMultiFileAuthState(pastaAuth);

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

      if (deveReconectar) {
        iniciarConexaoWhatsapp(); // tenta reconectar com mesma sessão
      } else {
        console.log('⚠️ Sessão desconectada permanentemente. Novo QR será necessário.');
      }
    } else if (connection === 'open') {
      console.log('🟩 Conectado ao WhatsApp!');
      qrCodeAtual = null;
    }
  });

  conexaoWhatsapp.ev.on('messages.upsert', async (mensagem) => {
    const infoMensagem = mensagem.messages[0];
    if (!infoMensagem.message || infoMensagem.key.fromMe) return;

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

async function gerarQRCode() {
  if (!qrCodeAtual) return null;
  return await qrcode.toDataURL(qrCodeAtual);
}

function obterStatusConexao() {
  return conexaoWhatsapp ? '🟢 Conectado ao WhatsApp!' : '🔴 Não conectado!';
}

function getConexao() {
  return conexaoWhatsapp;
}

module.exports = {
  iniciarConexaoWhatsapp,
  gerarQRCode,
  obterStatusConexao,
  getConexao,
  limparSessaoAnterior
};

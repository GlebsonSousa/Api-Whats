const fs = require('fs');
const path = require('path');
const { default: criarConexaoWhatsapp, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');

const axios = require('axios');
require('dotenv').config();

let conexaoWhatsapp = null;
let qrCodeAtual = null;

const pastaAuth = 'dados_autenticacao';
const caminhoCreds = path.join(pastaAuth, 'creds.json');

function limparSessaoAnterior() {
  if (fs.existsSync(pastaAuth)) {
    fs.rmSync(pastaAuth, { recursive: true, force: true });
    console.log('🧹 Sessão antiga removida!');
  }
}

async function iniciarConexaoWhatsapp(forcarNovaSessao = false, onMensagemRecebida = null) {
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
        iniciarConexaoWhatsapp(false, onMensagemRecebida);
      } else {
        console.log('⚠️ Sessão desconectada permanentemente. Novo QR será necessário.');
      }
    } else if (connection === 'open') {
      console.log('🟩 Conectado ao WhatsApp!');
      qrCodeAtual = null;
    }
  });

  // 🟢 Escuta mensagens recebidas
  if (onMensagemRecebida) {
    conexaoWhatsapp.ev.on('messages.upsert', onMensagemRecebida);
  }

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
  limparSessaoAnterior,
  getConexao
};

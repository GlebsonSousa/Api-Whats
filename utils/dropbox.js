const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch'); // Necessário para node.js

const ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const dropbox = new Dropbox({ accessToken: ACCESS_TOKEN, fetch });

const PASTA_LOCAL = 'dados_autenticacao';
const ARQUIVO_DROPBOX = '/whatsapp_sessao.zip';
const ARQUIVO_ZIP_LOCAL = path.join(__dirname, 'sessao.zip');

function ziparPasta(origem, destinoZip) {
  const archiver = require('archiver');
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinoZip);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(origem, false);
    archive.finalize();
  });
}

function descompactarZip(zipPath, destino) {
  const unzipper = require('unzipper');
  return fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: destino }))
    .promise();
}

async function fazerUpload() {
  try {
    await ziparPasta(PASTA_LOCAL, ARQUIVO_ZIP_LOCAL);

    const fileContent = fs.readFileSync(ARQUIVO_ZIP_LOCAL);

    await dropbox.filesUpload({
      path: ARQUIVO_DROPBOX,
      mode: { '.tag': 'overwrite' },
      contents: fileContent,
    });

    fs.unlinkSync(ARQUIVO_ZIP_LOCAL);
    console.log('☁️ Sessão enviada ao Dropbox!');
  } catch (error) {
    console.error('Erro no upload do Dropbox:', error);
  }
}

async function fazerDownload() {
  try {
    const response = await dropbox.filesDownload({ path: ARQUIVO_DROPBOX });
    const arquivoBuffer = response.result.fileBinary;

    fs.writeFileSync(ARQUIVO_ZIP_LOCAL, arquivoBuffer);

    // Remove pasta antiga antes de descompactar
    if (fs.existsSync(PASTA_LOCAL)) {
      fs.rmSync(PASTA_LOCAL, { recursive: true, force: true });
    }

    await descompactarZip(ARQUIVO_ZIP_LOCAL, PASTA_LOCAL);
    fs.unlinkSync(ARQUIVO_ZIP_LOCAL);
    console.log('📥 Sessão restaurada do Dropbox!');
    return true;
  } catch (error) {
    console.warn('Não foi possível baixar sessão do Dropbox (provável que não exista ainda).');
    return false;
  }
}

module.exports = { fazerUpload, fazerDownload };

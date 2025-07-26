const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
const fetch = require('node-fetch'); // Para compatibilidade com Node.js
const archiver = require('archiver');
const unzipper = require('unzipper');
require('dotenv').config();

const ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error('❌ DROPBOX_ACCESS_TOKEN não definido no arquivo .env');
  process.exit(1);
}

const dropbox = new Dropbox({ accessToken: ACCESS_TOKEN, fetch });

const PASTA_LOCAL = path.join(__dirname, '..', 'dados_autenticacao');
const ARQUIVO_DROPBOX = '/whatsapp_sessao.zip';
const ARQUIVO_ZIP_LOCAL = path.join(__dirname, 'sessao_temp.zip');

// Gera um .zip da pasta local
function ziparPasta(origem, destinoZip) {
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

// Descompacta o .zip no destino
function descompactarZip(zipPath, destino) {
  return fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: destino }))
    .promise();
}

// Envia para o Dropbox
async function fazerUpload() {
  try {
    // Verifica se há arquivos na pasta antes de zipar
    const arquivos = fs.readdirSync(PASTA_LOCAL);
    if (!arquivos.length) {
      console.warn('⚠️ Nenhum arquivo para fazer upload.');
      return;
    }

    await ziparPasta(PASTA_LOCAL, ARQUIVO_ZIP_LOCAL);

    const fileContent = fs.readFileSync(ARQUIVO_ZIP_LOCAL);

    await dropbox.filesUpload({
      path: ARQUIVO_DROPBOX,
      mode: { '.tag': 'overwrite' },
      contents: fileContent,
    });

    fs.unlinkSync(ARQUIVO_ZIP_LOCAL);
    console.log('☁️ Sessão enviada ao Dropbox com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao fazer upload para o Dropbox:', error.message);
  }
}

// Baixa e extrai a sessão
async function fazerDownload() {
  try {
    const response = await dropbox.filesDownload({ path: ARQUIVO_DROPBOX });

    const buffer = Buffer.from(response.result.fileBinary || await response.result.fileBlob.arrayBuffer());

    fs.writeFileSync(ARQUIVO_ZIP_LOCAL, buffer);

    if (fs.existsSync(PASTA_LOCAL)) {
      fs.rmSync(PASTA_LOCAL, { recursive: true, force: true });
    }

    await descompactarZip(ARQUIVO_ZIP_LOCAL, PASTA_LOCAL);

    fs.unlinkSync(ARQUIVO_ZIP_LOCAL);
    console.log('📥 Sessão restaurada com sucesso do Dropbox!');
    return true;
  } catch (error) {
    console.warn('⚠️ Sessão não encontrada no Dropbox. Será criada uma nova após o login.');
    return false;
  }
}

module.exports = { fazerUpload, fazerDownload };

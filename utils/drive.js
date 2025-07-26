const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const unzipper = require('unzipper');
const archiver = require('archiver');

const pastaLocal = 'dados_autenticacao';
const nomeArquivoDrive = 'whatsapp_sessao.zip';

function getOAuthClientFromEnv() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_DRIVE_CREDENTIALS_BASE64, 'base64').toString()
  );

  return new google.auth.JWT(
    credentials.installed.client_email,
    null,
    credentials.installed.private_key,
    ['https://www.googleapis.com/auth/drive'],
    null
  );
}

async function fazerUpload() {
  const auth = getOAuthClientFromEnv();
  await auth.authorize();
  const drive = google.drive({ version: 'v3', auth });

  const zipPath = path.join(__dirname, 'sessao.zip');
  await ziparPasta(pastaLocal, zipPath);

  const arquivoExistente = await buscarArquivo(drive, nomeArquivoDrive);

  const fileMetadata = { name: nomeArquivoDrive };
  const media = {
    mimeType: 'application/zip',
    body: fs.createReadStream(zipPath),
  };

  if (arquivoExistente) {
    await drive.files.update({ fileId: arquivoExistente.id, media });
  } else {
    await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
  }

  fs.unlinkSync(zipPath);
  console.log('☁️ Sessão enviada ao Google Drive!');
}

async function fazerDownload() {
  const auth = getOAuthClientFromEnv();
  await auth.authorize();
  const drive = google.drive({ version: 'v3', auth });

  const arquivo = await buscarArquivo(drive, nomeArquivoDrive);
  if (!arquivo) return false;

  const dest = fs.createWriteStream('sessao.zip');
  const res = await drive.files.get({ fileId: arquivo.id, alt: 'media' }, { responseType: 'stream' });

  await new Promise((resolve, reject) => {
    res.data.on('end', resolve).on('error', reject).pipe(dest);
  });

  await descompactarZip('sessao.zip', pastaLocal);
  fs.unlinkSync('sessao.zip');
  console.log('📥 Sessão restaurada do Google Drive!');
  return true;
}

async function buscarArquivo(drive, nome) {
  const res = await drive.files.list({
    q: `name='${nome}'`,
    fields: 'files(id, name)',
  });
  return res.data.files[0];
}

function ziparPasta(origem, destinoZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinoZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(origem, false);
    archive.finalize();

    output.on('close', resolve);
    archive.on('error', reject);
  });
}

function descompactarZip(zipPath, destino) {
  return fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: destino })).promise();
}

module.exports = { fazerUpload, fazerDownload };

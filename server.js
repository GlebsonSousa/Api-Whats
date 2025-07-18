const express = require("express");
const cors = require("cors");
require("dotenv").config();  // Carrega variáveis de ambiente do .env

const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


function token (req, res, next) {
    const authToken = req.headers.authorization || ''

    // Verifica se o token é igual aao definido no .env
    if (authToken === `Bearer ${process.env.API_TOKEN}`) {
        return next()
    }

    return res.status(401).json({ erro: 'Não autorizado. Token inválido'})
}

app.get ("/", async (req, res) => {
    return res.status(200).json('Api rodando!')
})


app.post ("/recebemensagem", token ,async (req, res, next) => {
    const { numero, mensagem, dataMsgRecebida } = req.body;

    const resposta = `Recebemos sua mensagem ${mensagem}`

    try {

        await axios.get (`${process.env.URL_WHATS_API}/enviar`, {
            params: {
                numero,
                mensagem: resposta
            },
            headers: {
                Authorization: `Bearer ${process.env.API_TOKEN}`
            }
        })
        console.log (` Mensagem de resposta enviada para ${numero}`)
    }catch (erro) {
        console.log ('Erro ao enviar mensagem de resposta: ', erro.mensagem)
    }

    return res.status(200).json({
        numero,
        mensagem,
        dataMsgRecebida,
        resposta,
    })
})


app.listen(PORT, () => {
  console.log(`🚀 API da FinanzAI rodando em http://localhost:${PORT}`);
});
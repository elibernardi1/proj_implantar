const axios = require('axios')

// Consulta o endereço a partir do CEP na API do ViaCEP
async function consultarCEP(cep) {
    const cepLimpo = String(cep).replace(/[^\d]/g, '')

    if (cepLimpo.length !== 8) {
        return { erro: true, message: 'CEP inválido' }
    }

    try {
        const resposta = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`)

        if (resposta.data.erro) {
            return { erro: true, message: 'CEP não encontrado' }
        }

        return {
            erro: false,
            rua: resposta.data.logradouro,
            bairro: resposta.data.bairro,
            cidade: resposta.data.localidade,
            uf: resposta.data.uf
        }
    } catch (err) {
        console.log('Erro ao consultar ViaCEP!', err.message || err)
        return { erro: true, message: 'Erro ao consultar o serviço de CEP' }
    }
}

module.exports = consultarCEP

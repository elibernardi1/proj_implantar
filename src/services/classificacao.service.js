const { RAMOS, RAMO_PADRAO } = require('../../config/palavrasChave')
const { normalizar, criarRegexTermo } = require('../utils/texto')

// Regex pré-compiladas uma única vez
const RAMOS_COMPILADOS = RAMOS.map(ramo => ({
    nome: ramo.nome,
    termos: ramo.palavras.map(p => ({
        regex: criarRegexTermo(p),
        peso: normalizar(p).includes(' ') ? 2 : 1 // expressões compostas valem mais
    }))
}))

// Devolve { ramo, pontuacao }. Maior pontuação vence; empate segue a ordem do config.
function classificarObjeto(objeto) {
    const texto = normalizar(objeto)
    if (!texto) return { ramo: RAMO_PADRAO.nome, pontuacao: 0 }

    let melhor = { ramo: RAMO_PADRAO.nome, pontuacao: 0 }
    for (const ramo of RAMOS_COMPILADOS) {
        let pontos = 0
        for (const termo of ramo.termos) {
            const ocorrencias = texto.match(termo.regex)
            if (ocorrencias) pontos += Math.min(ocorrencias.length, 3) * termo.peso
        }
        if (pontos > melhor.pontuacao) melhor = { ramo: ramo.nome, pontuacao: pontos }
    }
    return melhor
}

// Cache nome do ramo -> codCategoria (evita consultar o banco a cada licitação)
const cacheCategorias = new Map()

// Garante que o ramo existe na tabela Categoria (tipo RAMO) e devolve o id.
async function obterCategoriaDoRamo(nomeRamo) {
    if (cacheCategorias.has(nomeRamo)) return cacheCategorias.get(nomeRamo)

    const Categoria = require('../models/Categoria')
    const descricao = (RAMOS.find(r => r.nome === nomeRamo) || RAMO_PADRAO).descricao
    const [categoria] = await Categoria.findOrCreate({
        where: { nome: nomeRamo, tipo: 'RAMO' },
        defaults: { nome: nomeRamo, tipo: 'RAMO', descricao }
    })
    cacheCategorias.set(nomeRamo, categoria.codCategoria)
    return categoria.codCategoria
}

function limparCache() { cacheCategorias.clear() }

function listarRamos() {
    return [...RAMOS.map(r => ({ nome: r.nome, descricao: r.descricao })), RAMO_PADRAO]
}

module.exports = { classificarObjeto, obterCategoriaDoRamo, listarRamos, limparCache }

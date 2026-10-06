const axios = require('axios')
const Oportunidade = require('../models/Oportunidade')
const { paraValor, paraData } = require('../utils/conversores')
const { normalizar } = require('../utils/texto')
const { classificarObjeto, obterCategoriaDoRamo } = require('./classificacao.service')
const { enquadrar } = require('./enquadramento.service')

const URL_BASE = () => process.env.API_LICITACOES_URL || 'https://api-licitacoes-production.up.railway.app'
const TIMEOUT_MS = 20000
const TAMANHO_PAGINA = 100
const MAX_PAGINAS = 200 // trava de segurança contra loop infinito

const MUNICIPIO_PADRAO = 'Tijucas'
const UF_PADRAO = 'SC'

// Lê um campo aceitando variações de nome: unidade_gestora, unidadeGestora, "Unidade Gestora"...
function pegar(bruto, nomes) {
    const mapa = {}
    for (const k of Object.keys(bruto)) mapa[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = bruto[k]
    for (const nome of nomes) {
        const v = mapa[nome.toLowerCase().replace(/[^a-z0-9]/g, '')]
        if (v !== undefined && v !== null && v !== '') return v
    }
    return null
}

// Converte um registro da API de Tijucas para o formato do model Oportunidade.
function mapearLicitacao(bruto) {
    const numero = pegar(bruto, ['licitacao_numero', 'licitacaoNumero', 'numero', 'numero_licitacao'])
    const ano = pegar(bruto, ['licitacao_ano', 'licitacaoAno', 'ano', 'ano_licitacao'])
    const unidade = pegar(bruto, ['unidade_gestora', 'unidadeGestora', 'orgao'])
    const objeto = pegar(bruto, ['objeto'])

    if (numero === null || ano === null) return null // sem identificação não dá para deduplicar

    return {
        chaveExterna: [normalizar(unidade || 'sem-unidade'), String(numero).trim(), String(ano).trim()].join('|'),
        numero: String(numero).trim(),
        ano: Number(ano) || null,
        objeto: objeto ? String(objeto) : null,
        unidadeGestora: unidade ? String(unidade) : null,
        modalidade: pegar(bruto, ['modalidade']),
        tipoConcorrencia: pegar(bruto, ['tipo_concorrencia', 'tipoConcorrencia']),
        situacao: pegar(bruto, ['situacao']),
        valorEstimado: paraValor(pegar(bruto, ['valor_estimado', 'valorEstimado'])),
        valorHomologado: paraValor(pegar(bruto, ['valor_homologado', 'valorHomologado'])),
        dataEdital: paraData(pegar(bruto, ['data_edital', 'dataEdital'])),
        dataAbertura: paraData(pegar(bruto, ['abertura_propostas', 'aberturaPropostas', 'abertura_sessao', 'aberturaSessao'])),
        dataHomologacao: paraData(pegar(bruto, ['data_homologacao', 'dataHomologacao']))
    }
}

function extrairLista(corpo) {
    if (Array.isArray(corpo)) return corpo
    if (corpo && typeof corpo === 'object') {
        for (const chave of ['data', 'licitacoes', 'results', 'items', 'dados']) {
            if (Array.isArray(corpo[chave])) return corpo[chave]
        }
    }
    return null
}

// Busca todas as páginas da API de Tijucas.
async function buscarTodas() {
    const todas = []
    const vistas = new Set()

    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        let resposta
        try {
            resposta = await axios.get(`${URL_BASE()}/licitacoes`, {
                params: { page: pagina, limit: TAMANHO_PAGINA },
                timeout: TIMEOUT_MS
            })
        } catch (err) {
            const erro = new Error('API de licitações indisponível ou sem resposta')
            erro.codigo = 'API_INDISPONIVEL'
            erro.causa = err
            throw erro
        }

        const lista = extrairLista(resposta.data)
        if (!lista) {
            const erro = new Error('Resposta inválida da API de licitações')
            erro.codigo = 'RESPOSTA_INVALIDA'
            throw erro
        }
        if (lista.length === 0) break

        let novos = 0
        for (const item of lista) {
            const id = JSON.stringify(item)
            if (!vistas.has(id)) { vistas.add(id); todas.push(item); novos++ }
        }
        // a API ignorou a paginação (devolveu os mesmos registros) ou não há mais páginas
        if (novos === 0) break
    }
    return todas
}

// Grava/atualiza uma licitação classificando e enquadrando. Retorna 'criada' | 'atualizada'.
async function gravar(dados) {
    const { ramo } = classificarObjeto(dados.objeto)
    const idCategoria = await obterCategoriaDoRamo(ramo)
    const enq = enquadrar({ valor: dados.valorEstimado, ramo, objeto: dados.objeto })

    const registro = {
        ...dados,
        origem: 'MUNICIPAL',
        municipio: MUNICIPIO_PADRAO,
        uf: UF_PADRAO,
        idCategoria,
        selos: enq.texto,
        seloPrincipal: enq.principal
    }

    const existente = await Oportunidade.findOne({ where: { origem: 'MUNICIPAL', chaveExterna: dados.chaveExterna } })
    if (existente) {
        await existente.update(registro)
        return 'atualizada'
    }
    await Oportunidade.create(registro)
    return 'criada'
}

// Sincroniza a base local com a API de Tijucas.
async function sincronizar() {
    const brutos = await buscarTodas()
    const resumo = { recebidas: brutos.length, criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 }

    for (const bruto of brutos) {
        const dados = mapearLicitacao(bruto)
        if (!dados) { resumo.ignoradas++; continue }
        try {
            const resultado = await gravar(dados)
            if (resultado === 'criada') resumo.criadas++
            else resumo.atualizadas++
        } catch (err) {
            resumo.erros++
            console.error('Erro ao gravar oportunidade', dados.chaveExterna, err)
        }
    }
    return resumo
}

module.exports = { sincronizar, mapearLicitacao, buscarTodas, pegar }

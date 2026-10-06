const { Op, fn, col } = require('sequelize')
const Oportunidade = require('../models/Oportunidade')
const Categoria = require('../models/Categoria')
const sincronizacao = require('../services/sincronizacaoMunicipal.service')
const { descreverSelos, listarSelosDisponiveis } = require('../services/enquadramento.service')
const { paraValor, paraDataFiltro } = require('../utils/conversores')

const LIMITE_MAXIMO = 100
const LIMITE_PADRAO = 20
const ORDENACOES = {
    valor: 'valorEstimado',
    valorHomologado: 'valorHomologado',
    publicacao: 'dataEdital',
    abertura: 'dataAbertura',
    ano: 'ano',
    orgao: 'unidadeGestora',
    recentes: 'createdAt'
}

const numeroOuNull = (v) => (v === null || v === undefined ? null : Number(v))

// Formato público de uma oportunidade (selos prontos para a interface).
function serializar(op) {
    const dados = typeof op.toJSON === 'function' ? op.toJSON() : op
    const ramo = dados.categoriaOportunidade ? dados.categoriaOportunidade.nome : null
    const estimado = numeroOuNull(dados.valorEstimado)
    const homologado = numeroOuNull(dados.valorHomologado)
    const economia = estimado && homologado !== null && estimado > 0 ? estimado - homologado : null

    return {
        codOportunidade: dados.codOportunidade,
        origem: dados.origem,
        numero: dados.numero,
        ano: dados.ano,
        objeto: dados.objeto,
        unidadeGestora: dados.unidadeGestora,
        municipio: dados.municipio,
        uf: dados.uf,
        modalidade: dados.modalidade,
        tipoConcorrencia: dados.tipoConcorrencia,
        situacao: dados.situacao,
        valorEstimado: estimado,
        valorHomologado: homologado,
        economia,
        percentualEconomia: economia !== null ? Number(((economia / estimado) * 100).toFixed(2)) : null,
        dataEdital: dados.dataEdital,
        dataAbertura: dados.dataAbertura,
        dataHomologacao: dados.dataHomologacao,
        categoria: dados.categoriaOportunidade
            ? { codCategoria: dados.categoriaOportunidade.codCategoria, nome: ramo }
            : null,
        selos: descreverSelos(dados.selos, ramo),
        seloPrincipal: dados.seloPrincipal
    }
}

const erroFiltro = (res, message) => res.status(400).json({ message })

// Monta o WHERE a partir da query string. Retorna { where, erro }.
function montarFiltros(q) {
    const where = {}
    const e = (message) => ({ erro: message })

    if (q.q) {
        const termo = `%${String(q.q).trim()}%`
        where[Op.or] = [
            { objeto: { [Op.like]: termo } },
            { unidadeGestora: { [Op.like]: termo } },
            { modalidade: { [Op.like]: termo } }
        ]
    }
    if (q.orgao) where.unidadeGestora = { [Op.like]: `%${q.orgao}%` }
    if (q.municipio) where.municipio = { [Op.like]: `%${q.municipio}%` }
    if (q.uf) {
        if (!/^[A-Za-z]{2}$/.test(q.uf)) return e('Estado (uf) deve ter 2 letras')
        where.uf = String(q.uf).toUpperCase()
    }
    // modalidade e situação aceitam vários valores separados por vírgula (multi-seleção do frontend)
    const emLista = (v) => {
        const itens = String(v).split(',').map(i => i.trim()).filter(Boolean)
        return itens.length > 1 ? { [Op.in]: itens } : itens[0]
    }
    if (q.modalidade) where.modalidade = emLista(q.modalidade)
    if (q.situacao) where.situacao = emLista(q.situacao)
    if (q.origem) {
        if (!['MUNICIPAL', 'PNCP'].includes(q.origem)) return e('Origem inválida')
        where.origem = q.origem
    }
    if (q.ano) {
        if (!/^\d{4}$/.test(q.ano)) return e('Ano inválido')
        where.ano = Number(q.ano)
    }
    if (q.categoria) {
        if (!/^\d+$/.test(q.categoria)) return e('Categoria deve ser um id numérico')
        where.idCategoria = Number(q.categoria)
    }

    // faixa de valor (valor_estimado)
    if (q.valorMin !== undefined || q.valorMax !== undefined) {
        const faixa = {}
        if (q.valorMin !== undefined) {
            const min = paraValor(q.valorMin)
            if (min === null) return e('valorMin inválido')
            faixa[Op.gte] = min
        }
        if (q.valorMax !== undefined) {
            const max = paraValor(q.valorMax)
            if (max === null) return e('valorMax inválido')
            faixa[Op.lte] = max
        }
        where.valorEstimado = faixa
    }

    // datas
    const intervalos = [
        ['publicacaoDe', 'publicacaoAte', 'dataEdital'],
        ['aberturaDe', 'aberturaAte', 'dataAbertura']
    ]
    for (const [de, ate, campo] of intervalos) {
        if (q[de] === undefined && q[ate] === undefined) continue
        const faixa = {}
        if (q[de] !== undefined) {
            const d = paraDataFiltro(q[de])
            if (!d) return e(`${de} inválida (use AAAA-MM-DD)`)
            faixa[Op.gte] = d
        }
        if (q[ate] !== undefined) {
            const d = paraDataFiltro(q[ate], true)
            if (!d) return e(`${ate} inválida (use AAAA-MM-DD)`)
            faixa[Op.lte] = d
        }
        where[campo] = faixa
    }

    // enquadramento (selo): aceita um ou vários códigos separados por vírgula
    if (q.enquadramento) {
        const validos = listarSelosDisponiveis().map(s => s.codigo)
        const codigos = String(q.enquadramento).split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        if (!codigos.length || codigos.some(c => !validos.includes(c))) return e('Enquadramento inválido')
        const condicoes = codigos.map(c => ({ selos: { [Op.like]: `%,${c},%` } }))
        where[Op.and] = [...(where[Op.and] || []), { [Op.or]: condicoes }]
    }

    return { where }
}

const include = [{ model: Categoria, as: 'categoriaOportunidade', attributes: ['codCategoria', 'nome'] }]

// GET /api/licitacoes/filtros  (público)
const listar = async (req, res) => {
    const q = req.query
    const { where, erro } = montarFiltros(q)
    if (erro) return erroFiltro(res, erro)

    let whereFinal = where
    // filtro por NOME do ramo (alternativa ao id da categoria)
    const incluir = [...include]
    if (q.ramo) {
        incluir[0] = { ...include[0], where: { nome: q.ramo, tipo: 'RAMO' }, required: true }
    }

    const pagina = Math.max(parseInt(q.pagina, 10) || 1, 1)
    const limite = Math.min(Math.max(parseInt(q.limite, 10) || LIMITE_PADRAO, 1), LIMITE_MAXIMO)
    const campoOrdem = ORDENACOES[q.ordenar] || ORDENACOES.recentes
    const direcao = String(q.direcao).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    try {
        const { rows, count } = await Oportunidade.findAndCountAll({
            where: whereFinal,
            include: incluir,
            order: [[campoOrdem, direcao], ['codOportunidade', 'DESC']],
            limit: limite,
            offset: (pagina - 1) * limite,
            distinct: true
        })
        res.status(200).json({
            dados: rows.map(serializar),
            paginacao: { pagina, limite, total: count, totalPaginas: Math.max(Math.ceil(count / limite), 1) }
        })
    } catch (err) {
        console.error('Erro ao filtrar oportunidades!', err)
        res.status(500).json({ message: 'Não foi possível consultar as licitações agora. Tente novamente.' })
    }
}

// GET /api/licitacoes/filtros/opcoes  (público) — valores para montar os dropdowns
const opcoes = async (req, res) => {
    try {
        const distintos = async (campo) => {
            const linhas = await Oportunidade.findAll({
                attributes: [[fn('DISTINCT', col(campo)), campo]],
                where: { [campo]: { [Op.ne]: null } },
                order: [[col(campo), 'ASC']],
                raw: true
            })
            return linhas.map(l => l[campo]).filter(Boolean)
        }

        const [modalidades, situacoes, orgaos, municipios, ufs, anos, ramos] = await Promise.all([
            distintos('modalidade'), distintos('situacao'), distintos('unidadeGestora'),
            distintos('municipio'), distintos('uf'), distintos('ano'),
            Categoria.findAll({ where: { tipo: 'RAMO' }, attributes: ['codCategoria', 'nome'], order: [['nome', 'ASC']] })
        ])

        res.status(200).json({
            ramos, modalidades, situacoes, orgaos, municipios, ufs,
            anos: anos.sort((a, b) => b - a),
            enquadramentos: listarSelosDisponiveis()
        })
    } catch (err) {
        console.error('Erro ao listar opções de filtro!', err)
        res.status(500).json({ message: 'Não foi possível carregar os filtros agora.' })
    }
}

// GET /api/oportunidades/:id  (público) — detalhes
const consultar = async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ message: 'Id inválido' })
    try {
        const op = await Oportunidade.findByPk(req.params.id, { include })
        if (!op) return res.status(404).json({ message: 'Oportunidade não encontrada!' })
        res.status(200).json(serializar(op))
    } catch (err) {
        console.error('Erro ao consultar oportunidade!', err)
        res.status(500).json({ message: 'Não foi possível consultar a licitação agora.' })
    }
}

// POST /api/oportunidades/sincronizar  (somente admin)
const sincronizar = async (req, res) => {
    try {
        const resumo = await sincronizacao.sincronizar()
        res.status(200).json({ message: 'Sincronização concluída!', resumo })
    } catch (err) {
        console.error('Erro ao sincronizar oportunidades!', err)
        if (err.codigo === 'API_INDISPONIVEL' || err.codigo === 'RESPOSTA_INVALIDA') {
            return res.status(502).json({ message: 'A API de licitações não respondeu corretamente. Tente novamente em instantes.' })
        }
        res.status(500).json({ message: 'Não foi possível sincronizar as licitações agora.' })
    }
}

module.exports = { listar, opcoes, consultar, sincronizar, montarFiltros, serializar }

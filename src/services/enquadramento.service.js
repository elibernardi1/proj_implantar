const { LIMITES, SELOS, PRIORIDADE_SELO_PRINCIPAL } = require('../../config/limitesLicitacao')
const { normalizar } = require('../utils/texto')

const RAMO_OBRAS = 'Obras e Engenharia'
const RAMO_VEICULOS = 'Veículos e Combustíveis'

// Termos que indicam serviço técnico especializado (natureza predominantemente intelectual).
const TERMOS_SERVICO_TECNICO = ['consultoria', 'assessoria', 'auditoria', 'pericia', 'parecer tecnico',
    'treinamento', 'estudo tecnico', 'projeto basico', 'projeto executivo', 'servicos tecnicos especializados',
    'servico tecnico especializado', 'fiscalizacao de obra', 'gerenciamento de obra']

function dentroDoLimite(valor, limite) {
    const v = LIMITES.itens[limite]
    if (v.comparador === 'menor') return valor < v.valor
    if (v.comparador === 'menorIgual') return valor <= v.valor
    return valor > v.valor
}

// Retorna a lista de códigos de selo que se aplicam ao processo.
//  valor : valor_estimado (number)   ramo : nome do ramo classificado   objeto : texto do objeto
function calcularCodigos({ valor, ramo, objeto }) {
    if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return []
    const v = Number(valor)
    const texto = normalizar(objeto)
    const codigos = []

    if (dentroDoLimite(v, 'GRANDE_VULTO')) codigos.push('GRANDE_VULTO')

    // O limite de dispensa depende do tipo de objeto: obras/engenharia x demais.
    const limiteDispensa = ramo === RAMO_OBRAS ? 'DISPENSA_OBRAS' : 'DISPENSA_OUTROS'
    if (dentroDoLimite(v, limiteDispensa)) codigos.push('DISPENSA')

    if (dentroDoLimite(v, 'SERVICO_TECNICO_ESPECIALIZADO') && TERMOS_SERVICO_TECNICO.some(t => texto.includes(t))) {
        codigos.push('SERVICO_TECNICO_ESPECIALIZADO')
    }

    if (dentroDoLimite(v, 'EXCLUSIVO_ME_EPP')) codigos.push('EXCLUSIVO_ME_EPP')

    if (ramo === RAMO_VEICULOS && texto.includes('manutencao') && dentroDoLimite(v, 'MANUTENCAO_VEICULOS')) {
        codigos.push('MANUTENCAO_VEICULOS')
    }

    if (dentroDoLimite(v, 'CONTRATO_VERBAL')) codigos.push('CONTRATO_VERBAL')

    return codigos
}

function escolherPrincipal(codigos) {
    return PRIORIDADE_SELO_PRINCIPAL.find(c => codigos.includes(c)) || null
}

// Enquadramento completo para gravar no banco.
function enquadrar(dados) {
    const codigos = calcularCodigos(dados)
    return {
        codigos,
        principal: escolherPrincipal(codigos),
        // ",DISPENSA,EXCLUSIVO_ME_EPP," permite filtrar com LIKE '%,CODIGO,%'
        texto: codigos.length ? `,${codigos.join(',')},` : null
    }
}

function limiteDoCodigo(codigo, ramo) {
    if (codigo === 'DISPENSA') return LIMITES.itens[ramo === RAMO_OBRAS ? 'DISPENSA_OBRAS' : 'DISPENSA_OUTROS']
    return LIMITES.itens[codigo]
}

// Transforma os códigos gravados no banco em objetos prontos para a interface.
function descreverSelos(textoSelos, ramo) {
    const codigos = String(textoSelos || '').split(',').filter(Boolean)
    return codigos.map(codigo => {
        const meta = SELOS[codigo] || { rotulo: codigo, cor: 'cinza', emoji: '⚪' }
        const limite = limiteDoCodigo(codigo, ramo)
        return {
            codigo,
            rotulo: meta.rotulo,
            cor: meta.cor,
            emoji: meta.emoji,
            baseLegal: limite ? limite.baseLegal : null,
            limite: limite ? limite.valor : null,
            indicativo: codigo === 'SERVICO_TECNICO_ESPECIALIZADO'
        }
    })
}

function listarSelosDisponiveis() {
    return Object.entries(SELOS).map(([codigo, meta]) => ({ codigo, ...meta }))
}

module.exports = { calcularCodigos, enquadrar, escolherPrincipal, descreverSelos, listarSelosDisponiveis, RAMO_OBRAS, RAMO_VEICULOS }

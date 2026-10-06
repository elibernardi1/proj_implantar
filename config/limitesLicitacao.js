// =====================================================================
// LIMITES LEGAIS DE CONTRATAÇÃO (Lei 14.133/2021)
// ---------------------------------------------------------------------
// ÚNICO lugar do sistema onde esses valores aparecem. Para atualizar em
// 2027 (ou quando sair novo decreto), edite SOMENTE este arquivo.
//
// comparador:
//   'menor'      -> valor <  limite
//   'menorIgual' -> valor <= limite
//   'maior'      -> valor >  limite
//
// Os selos são INDICATIVOS (apoio à triagem) e não substituem a análise
// jurídica do edital. Confirme cada hipótese com a assessoria jurídica.
// =====================================================================

const LIMITES = {
    vigencia: 2026,
    fonte: 'Decreto 12.807/2025 (vigente desde 01/01/2026); LC 123/2006 para ME/EPP',

    itens: {
        DISPENSA_OBRAS: {
            valor: 130984.20,
            comparador: 'menor',
            baseLegal: 'Lei 14.133/2021, art. 75, I',
            descricao: 'Dispensa: obras e serviços de engenharia'
        },
        DISPENSA_OUTROS: {
            valor: 65492.11,
            comparador: 'menor',
            baseLegal: 'Lei 14.133/2021, art. 75, II',
            descricao: 'Dispensa: outras compras e serviços'
        },
        SERVICO_TECNICO_ESPECIALIZADO: {
            valor: 392952.63,
            comparador: 'menorIgual',
            baseLegal: 'Lei 14.133/2021, art. 37, §2º',
            descricao: 'Serviços técnicos especializados'
        },
        CONTRATO_VERBAL: {
            valor: 13098.41,
            comparador: 'menorIgual',
            baseLegal: 'Lei 14.133/2021, art. 95, §2º',
            descricao: 'Contrato verbal: pequenas compras de pronto pagamento'
        },
        MANUTENCAO_VEICULOS: {
            valor: 10478.74,
            comparador: 'menorIgual',
            baseLegal: 'Lei 14.133/2021, art. 75, §7º',
            descricao: 'Manutenção de veículos (com peças)'
        },
        GRANDE_VULTO: {
            valor: 261968421.04,
            comparador: 'maior',
            baseLegal: 'Lei 14.133/2021, art. 6º, XXII',
            descricao: 'Contratação de grande vulto'
        },
        EXCLUSIVO_ME_EPP: {
            valor: 80000.00,
            comparador: 'menorIgual',
            baseLegal: 'LC 123/2006, art. 48, I (não é corrigido pelo decreto anual)',
            descricao: 'Itens de até R$ 80 mil: participação exclusiva de ME/EPP/MEI'
        }
    }
}

// Metadados visuais de cada selo (a interface só lê estes dados da API).
const SELOS = {
    GRANDE_VULTO:                  { rotulo: 'Grande vulto',                    cor: 'vermelho', emoji: '🔴' },
    DISPENSA:                      { rotulo: 'Dispensa',                        cor: 'verde',    emoji: '🟢' },
    SERVICO_TECNICO_ESPECIALIZADO: { rotulo: 'Serviço técnico especializado',   cor: 'laranja',  emoji: '🟠' },
    EXCLUSIVO_ME_EPP:              { rotulo: 'Exclusivo ME/EPP',                cor: 'azul',     emoji: '🔵' },
    MANUTENCAO_VEICULOS:           { rotulo: 'Manutenção de veículos',          cor: 'cinza',    emoji: '⚪' },
    CONTRATO_VERBAL:               { rotulo: 'Contrato verbal',                 cor: 'cinza',    emoji: '⚪' }
}

// Ordem para escolher o selo principal (o primeiro que se aplicar).
const PRIORIDADE_SELO_PRINCIPAL = [
    'GRANDE_VULTO',
    'DISPENSA',
    'SERVICO_TECNICO_ESPECIALIZADO',
    'EXCLUSIVO_ME_EPP',
    'MANUTENCAO_VEICULOS',
    'CONTRATO_VERBAL'
]

module.exports = { LIMITES, SELOS, PRIORIDADE_SELO_PRINCIPAL }

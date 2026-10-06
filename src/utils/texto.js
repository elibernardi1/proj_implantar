// Normaliza texto para comparação: minúsculas, sem acento, espaços simples.
function normalizar(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

function escaparRegex(t) {
    return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Termos curtos (<= 3 letras) só casam como palavra inteira; os demais
// casam no início de palavra (aceita plural/flexões: "medicamento" -> "medicamentos").
function criarRegexTermo(termo) {
    const t = escaparRegex(normalizar(termo))
    const fim = t.length <= 3 ? '(?![a-z0-9])' : ''
    return new RegExp(`(?<![a-z0-9])${t}${fim}`, 'g')
}

module.exports = { normalizar, criarRegexTermo }

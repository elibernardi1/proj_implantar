// Converte valores vindos de fontes externas (API de Tijucas, PNCP) para tipos do banco.

// Aceita number, "1234.56", "1.234,56" e "R$ 1.234,56". Retorna number ou null.
function paraValor(entrada) {
    if (entrada === null || entrada === undefined || entrada === '') return null
    if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null

    let t = String(entrada).replace(/[^\d,.\-]/g, '')
    if (!t) return null

    const temVirgula = t.includes(',')
    const temPonto = t.includes('.')
    if (temVirgula && temPonto) {
        // o separador decimal é o que aparece por último
        if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.')
        else t = t.replace(/,/g, '')
    } else if (temVirgula) {
        t = t.replace(',', '.')
    }
    const n = Number(t)
    return Number.isFinite(n) ? n : null
}

// Aceita ISO (2026-03-05, 2026-03-05T10:00:00Z) e dd/mm/aaaa [hh:mm]. Retorna Date ou null.
function paraData(entrada) {
    if (!entrada) return null
    if (entrada instanceof Date) return isNaN(entrada) ? null : entrada

    const s = String(entrada).trim()
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
    if (br) {
        const [, d, m, a, h = '0', min = '0'] = br
        const data = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d), Number(h), Number(min)))
        return isNaN(data) || data.getUTCDate() !== Number(d) ? null : data
    }

    const iso = new Date(s)
    return isNaN(iso) ? null : iso
}

// Valida "AAAA-MM-DD" vindo de query string. Retorna Date (UTC) ou null.
function paraDataFiltro(entrada, fimDoDia = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entrada || ''))) return null
    const data = new Date(`${entrada}T${fimDoDia ? '23:59:59.999' : '00:00:00.000'}Z`)
    return isNaN(data) ? null : data
}

module.exports = { paraValor, paraData, paraDataFiltro }

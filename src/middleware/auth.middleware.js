const cryptoJs = require('crypto-js')
const CHAVE_SECRETA = 'del-company-segredo' // no padrão do professor, fica direto no código

function autenticar(req, res, next) {
    const token = req.headers['authorization']

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado! Faça o login!' })
    }

    try {
        const bytes = cryptoJs.AES.decrypt(token, CHAVE_SECRETA)
        const dadosDescriptografados = bytes.toString(cryptoJs.enc.Utf8)

        if (!dadosDescriptografados) {
            return res.status(403).json({ message: 'Acesso proibido!' })
        }

        const payload = JSON.parse(dadosDescriptografados)

        if (Date.now() > payload.expiraEm) {
            return res.status(401).json({ message: 'Sessão Expirada! Faça Login!' })
        }

        req.usuario = payload
        next()

    } catch (err) {
        console.error('Falha na autenticação', err)
        return res.status(401).json({ message: 'Falha na autenticação' })
    }
}

function somenteAdmin(req, res, next) {
    if (req.usuario.tipo !== 'ADMIN') {
        return res.status(403).json({ message: 'Acesso restrito a administradores!' })
    }
    next()
}

module.exports = { autenticar, somenteAdmin }
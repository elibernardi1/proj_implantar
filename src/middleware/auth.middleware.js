require('dotenv').config()
const jwt = require('jsonwebtoken')

// Valida o header Authorization: Bearer <TOKEN_JWT>
function autenticar(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token não informado' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const dadosToken = jwt.verify(token, process.env.JWT_SECRET)
        req.usuario = dadosToken // { codUsuario, tipo }
        next()
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido ou expirado' })
    }
}

// Uso opcional: garante que só ADMIN acesse a rota (ex: gestão de estoque/serviços)
function somenteAdmin(req, res, next) {
    if (!req.usuario || req.usuario.tipo !== 'ADMIN') {
        return res.status(403).json({ message: 'Acesso permitido somente para administradores' })
    }
    next()
}

module.exports = { autenticar, somenteAdmin }

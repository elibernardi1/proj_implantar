require('dotenv').config()
const nodemailer = require('nodemailer')

// Transporte SMTP criado sob demanda, para que a API suba mesmo sem e-mail configurado.
let transporte = null

function emailConfigurado() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function obterTransporte() {
    if (!transporte) {
        transporte = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            connectionTimeout: 10000,
            socketTimeout: 15000
        })
    }
    return transporte
}

async function enviarEmail({ para, assunto, texto, html, replyTo }) {
    if (!emailConfigurado()) {
        const erro = new Error('Envio de e-mail não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS).')
        erro.codigo = 'EMAIL_NAO_CONFIGURADO'
        throw erro
    }
    return obterTransporte().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: para,
        subject: assunto,
        text: texto,
        html,
        replyTo
    })
}

module.exports = { enviarEmail, emailConfigurado }

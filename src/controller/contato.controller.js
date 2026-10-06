const { enviarEmail, emailConfigurado } = require('../services/email.service')

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const escapar = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// POST /contato (público) — formulário de contato do site
const enviar = async (req, res) => {
    const { nome, empresa, email, telefone, assunto, mensagem } = req.body || {}

    if (!nome || !email || !assunto || !mensagem) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }
    if (!REGEX_EMAIL.test(email)) {
        return res.status(400).json({ message: 'E-mail inválido' })
    }
    if (String(mensagem).length > 5000) {
        return res.status(400).json({ message: 'Mensagem muito longa' })
    }
    if (!emailConfigurado()) {
        console.error('POST /contato: SMTP não configurado no ambiente')
        return res.status(503).json({ message: 'Envio de mensagens indisponível no momento. Tente novamente mais tarde.' })
    }

    try {
        await enviarEmail({
            para: process.env.CONTATO_DESTINO || process.env.SMTP_USER,
            replyTo: email,
            assunto: `[Site Del Company] ${assunto} — ${nome}`,
            texto: `Nome: ${nome}\nEmpresa: ${empresa || '-'}\nE-mail: ${email}\nTelefone: ${telefone || '-'}\nAssunto: ${assunto}\n\n${mensagem}`,
            html: `<p><b>Nome:</b> ${escapar(nome)}<br><b>Empresa:</b> ${escapar(empresa || '-')}<br><b>E-mail:</b> ${escapar(email)}<br><b>Telefone:</b> ${escapar(telefone || '-')}<br><b>Assunto:</b> ${escapar(assunto)}</p><p>${escapar(mensagem).replace(/\n/g, '<br>')}</p>`
        })
        res.status(200).json({ message: 'Mensagem enviada com sucesso!' })
    } catch (err) {
        console.error('Erro ao enviar e-mail de contato!', err)
        res.status(502).json({ message: 'Não foi possível enviar sua mensagem agora. Tente novamente em instantes.' })
    }
}

module.exports = { enviar }

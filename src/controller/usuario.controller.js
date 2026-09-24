require('dotenv').config()
const cryptoJs = require('crypto-js')
const { Op } = require('sequelize')

const Usuario = require('../models/Usuario')
const validarCPF = require('../utils/validarCPF')
const consultarCEP = require('../utils/consultarCEP')

const CHAVE_SECRETA = 'del-company-segredo'

const cadastrar = async (req, res) => {
    const valores = req.body

    if (!valores.nome || !valores.email || !valores.senha || !valores.cpf || !valores.cep) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios!' })
    }

    try {
        const usuarioExistente = await Usuario.findOne({
            where: { [Op.or]: [{ email: valores.email }, { cpf: valores.cpf }] }
        })

        if (usuarioExistente) {
            return res.status(409).json({ message: 'E-mail ou CPF já cadastrado' })
        }

        const endereco = await consultarCEP(valores.cep)
        if (endereco.erro) {
            return res.status(400).json({ message: endereco.message })
        }

        const senhaCripto = cryptoJs.AES.encrypt(valores.senha, CHAVE_SECRETA).toString()

        await Usuario.create({
            nome: valores.nome,
            email: valores.email,
            senha: senhaCripto,
            cpf: valores.cpf,
            cep: valores.cep,
            rua: endereco.rua,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            tipo: 'CLIENTE'
        })

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' })
    } catch (err) {
        console.error('Erro ao cadastrar usuário!', err)
        res.status(500).json({ message: 'Erro ao cadastrar usuário!' })
    }
}

const login = async (req, res) => {
    const { email, senha } = req.body

    if (!email || !senha) {
        return res.status(400).json({ message: 'Campos email e senha obrigatórios!' })
    }

    try {
        const usuario = await Usuario.findOne({ where: { email } })

        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado!' })
        }

        const bytes = cryptoJs.AES.decrypt(usuario.senha, CHAVE_SECRETA)
        const senhaDescriptografada = bytes.toString(cryptoJs.enc.Utf8)

        if (senha !== senhaDescriptografada) {
            return res.status(401).json({ message: 'Senha incorreta, não autorizado!' })
        }

        const tresHorasEmMs = 3 * 60 * 60 * 1000
        const payload = {
            codUsuario: usuario.codUsuario,
            nome: usuario.nome,
            tipo: usuario.tipo,
            expiraEm: Date.now() + tresHorasEmMs
        }

        const token = cryptoJs.AES.encrypt(JSON.stringify(payload), CHAVE_SECRETA).toString()

        res.status(200).json({
            message: 'Login realizado com sucesso!',
            token,
            usuario: { codUsuario: usuario.codUsuario, nome: usuario.nome, tipo: usuario.tipo }
        })
    } catch (err) {
        console.error('Não foi possível fazer o login!', err)
        res.status(500).json({ message: 'Não foi possível fazer o login!' })
    }
}
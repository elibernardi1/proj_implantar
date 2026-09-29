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

const listar = async (req, res) => {
    try {
        const dados = await Usuario.findAll({ attributes: { exclude: ['senha'] } })
        res.status(200).json(dados)
    } catch (err) {
        console.error('Erro ao listar usuários!', err)
        res.status(500).json({ message: 'Erro ao listar usuários!' })
    }
}

const consultar = async (req, res) => {
    const { id } = req.params
    const { nome } = req.query

    try {
        if (nome) {
            const dados = await Usuario.findAll({
                where: { nome: { [Op.like]: `%${nome}%` } },
                attributes: { exclude: ['senha'] }
            })
            return res.status(200).json(dados)
        }

        const dados = await Usuario.findByPk(id, { attributes: { exclude: ['senha'] } })
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.error('Erro ao consultar usuário!', err)
        res.status(500).json({ message: 'Erro ao consultar usuário!' })
    }
}

const perfil = async (req, res) => {
    try {
        const dados = await Usuario.findByPk(req.usuario.codUsuario, { attributes: { exclude: ['senha'] } })
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.error('Erro ao consultar perfil!', err)
        res.status(500).json({ message: 'Erro ao consultar perfil!' })
    }
}

const atualizar = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    if (String(req.usuario.codUsuario) !== String(id) && req.usuario.tipo !== 'ADMIN') {
        return res.status(403).json({ message: 'Sem permissão para alterar esse usuário' })
    }

    if (!valores.nome || !valores.email || !valores.cep) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const dados = await Usuario.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado' })
        }

        const endereco = await consultarCEP(valores.cep)
        if (endereco.erro) {
            return res.status(400).json({ message: endereco.message })
        }

        const atualizacao = {
            nome: valores.nome,
            email: valores.email,
            cep: valores.cep,
            rua: endereco.rua,
            bairro: endereco.bairro,
            cidade: endereco.cidade
        }

        if (valores.senha) {
            atualizacao.senha = cryptoJs.AES.encrypt(valores.senha, CHAVE_SECRETA).toString()
        }

        await Usuario.update(atualizacao, { where: { codUsuario: id } })
        const atualizado = await Usuario.findByPk(id, { attributes: { exclude: ['senha'] } })
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.error('Erro ao atualizar usuário!', err)
        res.status(500).json({ message: 'Erro ao atualizar usuário!' })
    }
}

const atualizarParcial = async (req, res) => {
    const id = req.params.id
    const valores = req.body
    delete valores.tipo
    delete valores.codUsuario

    if (String(req.usuario.codUsuario) !== String(id) && req.usuario.tipo !== 'ADMIN') {
        return res.status(403).json({ message: 'Sem permissão para alterar esse usuário' })
    }

    try {
        const dados = await Usuario.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado' })
        }

        if (valores.senha) {
            valores.senha = cryptoJs.AES.encrypt(valores.senha, CHAVE_SECRETA).toString()
        }

        if (valores.cep) {
            const endereco = await consultarCEP(valores.cep)
            if (endereco.erro) {
                return res.status(400).json({ message: endereco.message })
            }
            valores.rua = endereco.rua
            valores.bairro = endereco.bairro
            valores.cidade = endereco.cidade
        }

        await Usuario.update(valores, { where: { codUsuario: id } })
        const atualizado = await Usuario.findByPk(id, { attributes: { exclude: ['senha'] } })
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.error('Erro ao atualizar usuário!', err)
        res.status(500).json({ message: 'Erro ao atualizar usuário!' })
    }
}

const apagar = async (req, res) => {
    const id = req.params.id

    try {
        const dados = await Usuario.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado' })
        }

        await Usuario.destroy({ where: { codUsuario: id } })
        res.status(200).json({ message: 'Usuário excluído com sucesso!' })
    } catch (err) {
        console.error('Erro ao excluir usuário!', err)
        res.status(500).json({ message: 'Erro ao excluir usuário!' })
    }
}

module.exports = { cadastrar, login, listar, consultar, perfil, atualizar, atualizarParcial, apagar }
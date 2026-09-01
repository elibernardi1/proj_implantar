require('dotenv').config()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { Op } = require('sequelize')

const Usuario = require('../models/Usuario')
const validarCPF = require('../utils/validarCPF')
const consultarCEP = require('../utils/consultarCEP')

const cadastrar = async (req, res) => {
    const valores = req.body

    if (!valores.nome || !valores.email || !valores.senha || !valores.cpf || !valores.cep) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    // 1. Validação matemática do CPF
    if (!validarCPF(valores.cpf)) {
        return res.status(400).json({ message: 'CPF inválido' })
    }

    try {
        // 2. Verificar existência prévia (e-mail e CPF)
        const usuarioExistente = await Usuario.findOne({
            where: {
                [Op.or]: [{ email: valores.email }, { cpf: valores.cpf }]
            }
        })

        if (usuarioExistente) {
            return res.status(409).json({ message: 'E-mail ou CPF já cadastrado' })
        }

        // 3. Autocompletar endereço via ViaCEP
        const endereco = await consultarCEP(valores.cep)
        if (endereco.erro) {
            return res.status(400).json({ message: endereco.message })
        }

        // 4. Criptografar a senha
        const senhaHash = await bcrypt.hash(valores.senha, 10)

        const dados = await Usuario.create({
            nome: valores.nome,
            email: valores.email,
            senha: senhaHash,
            cpf: valores.cpf,
            cep: valores.cep,
            rua: endereco.rua,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            tipo: valores.tipo === 'ADMIN' ? 'ADMIN' : 'CLIENTE'
        })

        const { senha, ...usuarioSemSenha } = dados.toJSON()
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', dados: usuarioSemSenha })
    } catch (err) {
        console.log('Erro ao cadastrar usuário!', err)
        res.status(500).json({ message: 'Erro ao cadastrar usuário!' })
    }
}

const login = async (req, res) => {
    const { email, senha } = req.body

    if (!email || !senha) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const usuario = await Usuario.findOne({ where: { email } })

        if (!usuario) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos' })
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha)
        if (!senhaValida) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos' })
        }

        const token = jwt.sign(
            { codUsuario: usuario.codUsuario, tipo: usuario.tipo },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        )

        res.status(200).json({
            message: 'Login realizado com sucesso!',
            token,
            usuario: { codUsuario: usuario.codUsuario, nome: usuario.nome, tipo: usuario.tipo }
        })
    } catch (err) {
        console.log('Erro ao realizar login!', err)
        res.status(500).json({ message: 'Erro ao realizar login!' })
    }
}

const listar = async (req, res) => {
    try {
        const dados = await Usuario.findAll({ attributes: { exclude: ['senha'] } })
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar usuários!', err)
        res.status(500).json({ message: 'Erro ao listar usuários!' })
    }
}

// GET /usuarios/:id  ou  GET /usuarios/buscar?nome=...
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
        console.log('Erro ao consultar usuário!', err)
        res.status(500).json({ message: 'Erro ao consultar usuário!' })
    }
}

// Perfil do usuário logado (rota privada)
const perfil = async (req, res) => {
    try {
        const dados = await Usuario.findByPk(req.usuario.codUsuario, { attributes: { exclude: ['senha'] } })
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar perfil!', err)
        res.status(500).json({ message: 'Erro ao consultar perfil!' })
    }
}

// PUT - atualização completa
const atualizar = async (req, res) => {
    const id = req.params.id
    const valores = req.body

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
            atualizacao.senha = await bcrypt.hash(valores.senha, 10)
        }

        await Usuario.update(atualizacao, { where: { codUsuario: id } })
        const atualizado = await Usuario.findByPk(id, { attributes: { exclude: ['senha'] } })
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar usuário!', err)
        res.status(500).json({ message: 'Erro ao atualizar usuário!' })
    }
}

// PATCH - atualização parcial
const atualizarParcial = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    try {
        const dados = await Usuario.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Usuário não encontrado' })
        }

        if (valores.senha) {
            valores.senha = await bcrypt.hash(valores.senha, 10)
        }

        // Se o CEP for alterado parcialmente, atualiza o endereço também
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
        console.log('Erro ao atualizar usuário!', err)
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
        console.log('Erro ao excluir usuário!', err)
        res.status(500).json({ message: 'Erro ao excluir usuário!' })
    }
}

module.exports = { cadastrar, login, listar, consultar, perfil, atualizar, atualizarParcial, apagar }

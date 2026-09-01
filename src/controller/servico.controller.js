const { Op } = require('sequelize')
const Servico = require('../models/Servico')
const Categoria = require('../models/Categoria')

const cadastrar = async (req, res) => {
    const valores = req.body

    if (!valores.nome || !valores.descricao || !valores.preco || !valores.idCategoria) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const categoria = await Categoria.findByPk(valores.idCategoria)
        if (!categoria) {
            return res.status(404).json({ message: 'Categoria informada não existe' })
        }

        const dados = await Servico.create(valores)
        res.status(201).json({ message: 'Serviço cadastrado com sucesso!', dados })
    } catch (err) {
        console.log('Erro ao cadastrar serviço!', err)
        res.status(500).json({ message: 'Erro ao cadastrar serviço!' })
    }
}

// Carrega automaticamente ao abrir a tela (catálogo/vitrine), com dados da categoria
const listar = async (req, res) => {
    try {
        const dados = await Servico.findAll({
            include: { model: Categoria, as: 'categoriaServico', attributes: ['nome'] }
        })
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar serviços!', err)
        res.status(500).json({ message: 'Erro ao listar serviços!' })
    }
}

// GET /servicos/:id  ou  GET /servicos/buscar?nome=...&idCategoria=...
const consultar = async (req, res) => {
    const { id } = req.params
    const { nome, idCategoria } = req.query

    try {
        if (nome || idCategoria) {
            const where = {}
            if (nome) where.nome = { [Op.like]: `%${nome}%` }
            if (idCategoria) where.idCategoria = idCategoria

            const dados = await Servico.findAll({ where })
            return res.status(200).json(dados)
        }

        const dados = await Servico.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Serviço não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar serviço!', err)
        res.status(500).json({ message: 'Erro ao consultar serviço!' })
    }
}

const atualizar = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    if (!valores.nome || !valores.descricao || !valores.preco || !valores.idCategoria) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const dados = await Servico.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Serviço não encontrado' })
        }

        await Servico.update(valores, { where: { codServico: id } })
        const atualizado = await Servico.findByPk(id)
        res.status(200).json({ message: 'Serviço atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar serviço!', err)
        res.status(500).json({ message: 'Erro ao atualizar serviço!' })
    }
}

const atualizarParcial = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    try {
        const dados = await Servico.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Serviço não encontrado' })
        }

        await Servico.update(valores, { where: { codServico: id } })
        const atualizado = await Servico.findByPk(id)
        res.status(200).json({ message: 'Serviço atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar serviço!', err)
        res.status(500).json({ message: 'Erro ao atualizar serviço!' })
    }
}

const apagar = async (req, res) => {
    const id = req.params.id

    try {
        const dados = await Servico.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Serviço não encontrado' })
        }

        await Servico.destroy({ where: { codServico: id } })
        res.status(200).json({ message: 'Serviço excluído com sucesso!' })
    } catch (err) {
        console.log('Erro ao excluir serviço!', err)
        res.status(500).json({ message: 'Erro ao excluir serviço!' })
    }
}

module.exports = { cadastrar, listar, consultar, atualizar, atualizarParcial, apagar }

const { Op } = require('sequelize')
const Categoria = require('../models/Categoria')

const cadastrar = async (req, res) => {
    const valores = req.body

    if (!valores.nome) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const existente = await Categoria.findOne({ where: { nome: valores.nome } })
        if (existente) {
            return res.status(409).json({ message: 'Categoria já cadastrada' })
        }

        const dados = await Categoria.create(valores)
        res.status(201).json({ message: 'Categoria cadastrada com sucesso!', dados })
    } catch (err) {
        console.log('Erro ao cadastrar categoria!', err)
        res.status(500).json({ message: 'Erro ao cadastrar categoria!' })
    }
}

const listar = async (req, res) => {
    try {
        const dados = await Categoria.findAll()
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar categorias!', err)
        res.status(500).json({ message: 'Erro ao listar categorias!' })
    }
}

// GET /categorias/:id  ou  GET /categorias/buscar?nome=...
const consultar = async (req, res) => {
    const { id } = req.params
    const { nome } = req.query

    try {
        if (nome) {
            const dados = await Categoria.findAll({ where: { nome: { [Op.like]: `%${nome}%` } } })
            return res.status(200).json(dados)
        }

        const dados = await Categoria.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Categoria não encontrada!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar categoria!', err)
        res.status(500).json({ message: 'Erro ao consultar categoria!' })
    }
}

const atualizar = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    if (!valores.nome) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const dados = await Categoria.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Categoria não encontrada' })
        }

        await Categoria.update(valores, { where: { codCategoria: id } })
        const atualizado = await Categoria.findByPk(id)
        res.status(200).json({ message: 'Categoria atualizada com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar categoria!', err)
        res.status(500).json({ message: 'Erro ao atualizar categoria!' })
    }
}

const atualizarParcial = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    try {
        const dados = await Categoria.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Categoria não encontrada' })
        }

        await Categoria.update(valores, { where: { codCategoria: id } })
        const atualizado = await Categoria.findByPk(id)
        res.status(200).json({ message: 'Categoria atualizada com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar categoria!', err)
        res.status(500).json({ message: 'Erro ao atualizar categoria!' })
    }
}

const apagar = async (req, res) => {
    const id = req.params.id

    try {
        const dados = await Categoria.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Categoria não encontrada' })
        }

        await Categoria.destroy({ where: { codCategoria: id } })
        res.status(200).json({ message: 'Categoria excluída com sucesso!' })
    } catch (err) {
        console.log('Erro ao excluir categoria!', err)
        res.status(500).json({ message: 'Erro ao excluir categoria!' })
    }
}

module.exports = { cadastrar, listar, consultar, atualizar, atualizarParcial, apagar }

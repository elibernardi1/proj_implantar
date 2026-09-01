const { Op } = require('sequelize')
const Entrega = require('../models/Entrega')

// A Entrega (processo licitatório) é criada automaticamente no checkout do pedido.
// Este controller cuida da consulta e do acompanhamento (atualização de status/dados).

const listar = async (req, res) => {
    try {
        const dados = await Entrega.findAll()
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar processos!', err)
        res.status(500).json({ message: 'Erro ao listar processos!' })
    }
}

// GET /entregas/:id  ou  GET /entregas/buscar?orgao=...
const consultar = async (req, res) => {
    const { id } = req.params
    const { orgao } = req.query

    try {
        if (orgao) {
            const dados = await Entrega.findAll({ where: { orgaoResponsavel: { [Op.like]: `%${orgao}%` } } })
            return res.status(200).json(dados)
        }

        const dados = await Entrega.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Processo não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar processo!', err)
        res.status(500).json({ message: 'Erro ao consultar processo!' })
    }
}

// PUT - atualização completa dos dados do processo
const atualizar = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    if (!valores.orgaoResponsavel || !valores.objetoLicitacao || !valores.modalidade || !valores.situacao) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const dados = await Entrega.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Processo não encontrado' })
        }

        await Entrega.update(valores, { where: { codEntrega: id } })
        const atualizado = await Entrega.findByPk(id)
        res.status(200).json({ message: 'Processo atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar processo!', err)
        res.status(500).json({ message: 'Erro ao atualizar processo!' })
    }
}

// PATCH - atualização parcial (ex: só a situação/status do andamento)
const atualizarParcial = async (req, res) => {
    const id = req.params.id
    const valores = req.body

    try {
        const dados = await Entrega.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Processo não encontrado' })
        }

        await Entrega.update(valores, { where: { codEntrega: id } })
        const atualizado = await Entrega.findByPk(id)
        res.status(200).json({ message: 'Processo atualizado com sucesso!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar processo!', err)
        res.status(500).json({ message: 'Erro ao atualizar processo!' })
    }
}

module.exports = { listar, consultar, atualizar, atualizarParcial }

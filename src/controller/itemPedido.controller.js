const ItemPedido = require('../models/ItemPedido')

// Os itens são criados automaticamente durante o checkout (pedido.controller.js).
// Aqui só disponibilizamos consulta.

const listar = async (req, res) => {
    try {
        const dados = await ItemPedido.findAll()
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar itens de pedido!', err)
        res.status(500).json({ message: 'Erro ao listar itens de pedido!' })
    }
}

const consultar = async (req, res) => {
    const { id } = req.params

    try {
        const dados = await ItemPedido.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Item de pedido não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar item de pedido!', err)
        res.status(500).json({ message: 'Erro ao consultar item de pedido!' })
    }
}

module.exports = { listar, consultar }

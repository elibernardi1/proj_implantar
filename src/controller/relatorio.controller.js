const { Op } = require('sequelize')
const ItemPedido = require('../models/ItemPedido')
const Servico = require('../models/Servico')
const Categoria = require('../models/Categoria')
const Pedido = require('../models/Pedido')

// GET /relatorios/vendas - Faturamento por Categoria (alimenta gráfico de barras/colunas no admin)
// Considera apenas pedidos que efetivamente geraram venda (ignora CANCELADO).
const vendas = async (req, res) => {
    try {
        const itens = await ItemPedido.findAll({
            include: [
                {
                    model: Pedido,
                    as: 'pedidoItem',
                    attributes: [],
                    where: { status: { [Op.ne]: 'CANCELADO' } }
                },
                {
                    model: Servico,
                    as: 'servicoItem',
                    attributes: ['nome'],
                    include: [{ model: Categoria, as: 'categoriaServico', attributes: ['nome'] }]
                }
            ]
        })

        const totaisPorCategoria = {}
        for (const item of itens) {
            const nomeCategoria = item.servicoItem?.categoriaServico?.nome || 'Sem categoria'
            const valorItem = Number(item.quantidade) * Number(item.precoUnitario)
            totaisPorCategoria[nomeCategoria] = (totaisPorCategoria[nomeCategoria] || 0) + valorItem
        }

        const dados = Object.entries(totaisPorCategoria).map(([categoria, totalVendido]) => ({
            categoria,
            totalVendido: Number(totalVendido.toFixed(2))
        }))

        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao gerar relatório de vendas!', err)
        res.status(500).json({ message: 'Erro ao gerar relatório de vendas!' })
    }
}

// GET /relatorios/estoque - Capacidade disponível por Categoria (alimenta gráfico de barras/colunas no admin)
const estoque = async (req, res) => {
    try {
        const servicos = await Servico.findAll({
            attributes: ['capacidadeDisponivel'],
            include: [{ model: Categoria, as: 'categoriaServico', attributes: ['nome'] }]
        })

        const totaisPorCategoria = {}
        for (const servico of servicos) {
            const nomeCategoria = servico.categoriaServico?.nome || 'Sem categoria'
            totaisPorCategoria[nomeCategoria] = (totaisPorCategoria[nomeCategoria] || 0) + servico.capacidadeDisponivel
        }

        const dados = Object.entries(totaisPorCategoria).map(([categoria, capacidadeTotal]) => ({
            categoria,
            capacidadeTotal
        }))

        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao gerar relatório de estoque!', err)
        res.status(500).json({ message: 'Erro ao gerar relatório de estoque!' })
    }
}

module.exports = { vendas, estoque }

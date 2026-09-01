const db = require('../db/conn')
const Pedido = require('../models/Pedido')
const ItemPedido = require('../models/ItemPedido')
const Servico = require('../models/Servico')
const Entrega = require('../models/Entrega')

// POST /pedidos (rota privada) - finalização do pedido (checkout)
// Body esperado: { itens: [{ idServico, quantidade }], entrega: { orgaoResponsavel, objetoLicitacao, modalidade, ... } }
const cadastrar = async (req, res) => {
    const { itens, entrega } = req.body
    const idUsuario = req.usuario.codUsuario // vem do token JWT

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ message: 'O pedido precisa ter ao menos um item' })
    }
    if (!entrega || !entrega.orgaoResponsavel || !entrega.objetoLicitacao || !entrega.modalidade) {
        return res.status(400).json({ message: 'Dados do processo licitatório são obrigatórios' })
    }

    const transacao = await db.transaction()

    try {
        let valorTotal = 0
        const servicosValidados = []

        // 1. Verifica existência e capacidade de cada serviço ANTES de qualquer gravação
        for (const item of itens) {
            if (!item.idServico || !item.quantidade) {
                await transacao.rollback()
                return res.status(400).json({ message: 'Cada item precisa de idServico e quantidade' })
            }

            const servico = await Servico.findByPk(item.idServico, { transaction: transacao })
            if (!servico) {
                await transacao.rollback()
                return res.status(404).json({ message: `Serviço ${item.idServico} não encontrado` })
            }
            if (servico.capacidadeDisponivel < item.quantidade) {
                await transacao.rollback()
                return res.status(400).json({ message: `Capacidade insuficiente para o serviço "${servico.nome}"` })
            }

            valorTotal += Number(servico.preco) * item.quantidade
            servicosValidados.push({ servico, quantidade: item.quantidade })
        }

        // 2. Cria o pedido
        const pedido = await Pedido.create(
            { idUsuario, status: 'CONFIRMADO', valorTotal },
            { transaction: transacao }
        )

        // 3. Cria os itens e deduz a capacidade de cada serviço
        for (const { servico, quantidade } of servicosValidados) {
            await ItemPedido.create(
                {
                    idPedido: pedido.codPedido,
                    idServico: servico.codServico,
                    quantidade,
                    precoUnitario: servico.preco
                },
                { transaction: transacao }
            )

            await servico.update(
                { capacidadeDisponivel: servico.capacidadeDisponivel - quantidade },
                { transaction: transacao }
            )
        }

        // 4. Cria o processo de acompanhamento (Entrega) vinculado ao pedido
        const dadosEntrega = await Entrega.create(
            {
                idPedido: pedido.codPedido,
                orgaoResponsavel: entrega.orgaoResponsavel,
                objetoLicitacao: entrega.objetoLicitacao,
                modalidade: entrega.modalidade,
                dataAbertura: entrega.dataAbertura || null,
                dataEncerramento: entrega.dataEncerramento || null,
                documentosNecessarios: entrega.documentosNecessarios || null,
                responsavelAcompanhamento: entrega.responsavelAcompanhamento || null
            },
            { transaction: transacao }
        )

        await transacao.commit()

        res.status(201).json({
            message: 'Pedido finalizado com sucesso!',
            pedido,
            entrega: dadosEntrega
        })
    } catch (err) {
        await transacao.rollback()
        console.log('Erro ao finalizar pedido!', err)
        res.status(500).json({ message: 'Erro ao finalizar pedido!' })
    }
}

// GET /pedidos (rota privada - admin)
const listar = async (req, res) => {
    try {
        const dados = await Pedido.findAll({
            include: [
                { model: ItemPedido, as: 'itensPedido' },
                { model: Entrega, as: 'entregaPedido' }
            ]
        })
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar pedidos!', err)
        res.status(500).json({ message: 'Erro ao listar pedidos!' })
    }
}

// GET /pedidos/meus-pedidos (rota privada - cliente logado)
const meusPedidos = async (req, res) => {
    try {
        const dados = await Pedido.findAll({
            where: { idUsuario: req.usuario.codUsuario },
            include: [
                { model: ItemPedido, as: 'itensPedido' },
                { model: Entrega, as: 'entregaPedido' }
            ]
        })
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar pedidos do usuário!', err)
        res.status(500).json({ message: 'Erro ao listar pedidos do usuário!' })
    }
}

const consultar = async (req, res) => {
    const { id } = req.params

    try {
        const dados = await Pedido.findByPk(id, {
            include: [
                { model: ItemPedido, as: 'itensPedido' },
                { model: Entrega, as: 'entregaPedido' }
            ]
        })
        if (!dados) {
            return res.status(404).json({ message: 'Pedido não encontrado!' })
        }
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao consultar pedido!', err)
        res.status(500).json({ message: 'Erro ao consultar pedido!' })
    }
}

// PATCH /pedidos/:id - atualização parcial do status (admin)
const atualizarStatus = async (req, res) => {
    const { id } = req.params
    const { status } = req.body

    const statusValidos = ['PENDENTE', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO']
    if (!status || !statusValidos.includes(status)) {
        return res.status(400).json({ message: 'Status inválido' })
    }

    try {
        const dados = await Pedido.findByPk(id)
        if (!dados) {
            return res.status(404).json({ message: 'Pedido não encontrado' })
        }

        await Pedido.update({ status }, { where: { codPedido: id } })
        const atualizado = await Pedido.findByPk(id)
        res.status(200).json({ message: 'Status do pedido atualizado!', dados: atualizado })
    } catch (err) {
        console.log('Erro ao atualizar status do pedido!', err)
        res.status(500).json({ message: 'Erro ao atualizar status do pedido!' })
    }
}

module.exports = { cadastrar, listar, meusPedidos, consultar, atualizarStatus }

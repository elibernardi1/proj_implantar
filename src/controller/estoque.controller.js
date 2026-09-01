const Usuario = require('../models/Usuario')
const Servico = require('../models/Servico')
const Estoque = require('../models/Estoque')

const cadastrar = async (req, res) => {
    const valores = req.body

    if (!valores.idUsuario || !valores.idServico || !valores.data || !valores.qtdeMov || !valores.tipo) {
        return res.status(400).json({ message: 'Campos Obrigatórios' })
    }

    try {
        const usuario = await Usuario.findByPk(valores.idUsuario)
        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado' })
        }
        const servico = await Servico.findByPk(valores.idServico)
        if (!servico) {
            return res.status(404).json({ message: 'Serviço não encontrado' })
        }

        let novaCapacidade = servico.capacidadeDisponivel

        if (valores.tipo === 'ENTRADA') {
            // Abre novas vagas de capacidade de atendimento
            novaCapacidade += valores.qtdeMov
        } else if (valores.tipo === 'SAIDA') {
            // Só pode reduzir capacidade se houver disponibilidade
            if (servico.capacidadeDisponivel < valores.qtdeMov) {
                return res.status(400).json({ message: 'Capacidade insuficiente!', novaCapacidade })
            }
            novaCapacidade -= valores.qtdeMov
        } else {
            return res.status(400).json({ message: 'Tipo inválido' })
        }

        await servico.update({ capacidadeDisponivel: novaCapacidade })

        const dados = await Estoque.create(valores)
        res.status(201).json({ message: 'Capacidade atualizada!', novaCapacidade, dados })
    } catch (err) {
        console.log('Erro ao cadastrar movimentação de estoque!', err)
        res.status(500).json({ message: 'Erro ao cadastrar movimentação de estoque!' })
    }
}

const listar = async (req, res) => {
    try {
        const dados = await Estoque.findAll()
        res.status(200).json(dados)
    } catch (err) {
        console.log('Erro ao listar estoque!', err)
        res.status(500).json({ message: 'Erro ao listar estoque!' })
    }
}

module.exports = { cadastrar, listar }

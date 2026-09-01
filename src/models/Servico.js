const { DataTypes } = require('sequelize')
const db = require('../db/conn')

const Servico = db.define('servico', {
    codServico: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    preco: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    imagem: {
        type: DataTypes.STRING(255)
    },
    // Equivalente ao "quantidade" do Produto no exemplo do professor.
    // Representa a capacidade de atendimento disponível para este serviço.
    capacidadeDisponivel: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    idCategoria: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categorias',
            key: 'codCategoria'
        }
    }
}, {
    timestamps: false,
    tableName: 'servicos'
})

module.exports = Servico

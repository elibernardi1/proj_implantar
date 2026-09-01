const { DataTypes } = require('sequelize')
const db = require('../db/conn')

const Entrega = db.define('entrega', {
    codEntrega: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    idPedido: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'pedidos',
            key: 'codPedido'
        }
    },
    orgaoResponsavel: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    objetoLicitacao: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    modalidade: {
        type: DataTypes.STRING(60),
        allowNull: false
    },
    dataAbertura: {
        type: DataTypes.DATEONLY
    },
    dataEncerramento: {
        type: DataTypes.DATEONLY
    },
    situacao: {
        type: DataTypes.ENUM('EM_ANDAMENTO', 'ENTREGUE', 'CANCELADO'),
        allowNull: false,
        defaultValue: 'EM_ANDAMENTO'
    },
    documentosNecessarios: {
        type: DataTypes.TEXT
    },
    responsavelAcompanhamento: {
        type: DataTypes.STRING(100)
    }
}, {
    timestamps: false,
    tableName: 'entregas'
})

module.exports = Entrega

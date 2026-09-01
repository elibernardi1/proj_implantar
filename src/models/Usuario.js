const { DataTypes } = require('sequelize')
const db = require('../db/conn')

const Usuario = db.define('usuario', {
    codUsuario: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    senha: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    cpf: {
        type: DataTypes.STRING(14),
        allowNull: false,
        unique: true
    },
    cep: {
        type: DataTypes.STRING(9),
        allowNull: false
    },
    rua: {
        type: DataTypes.STRING(100)
    },
    bairro: {
        type: DataTypes.STRING(60)
    },
    cidade: {
        type: DataTypes.STRING(60)
    },
    tipo: {
        type: DataTypes.ENUM('CLIENTE', 'ADMIN'),
        allowNull: false,
        defaultValue: 'CLIENTE'
    }
}, {
    timestamps: false,
    tableName: 'usuarios'
})

module.exports = Usuario

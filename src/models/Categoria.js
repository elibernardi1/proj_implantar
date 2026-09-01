const { DataTypes } = require('sequelize')
const db = require('../db/conn')

const Categoria = db.define('categoria', {
    codCategoria: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(60),
        allowNull: false
    },
    descricao: {
        type: DataTypes.STRING(255)
    }
}, {
    timestamps: false,
    tableName: 'categorias'
})

module.exports = Categoria

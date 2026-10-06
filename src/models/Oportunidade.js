const { DataTypes } = require('sequelize')
const db = require('../db/conn')

// Oportunidade de licitação (fonte única para dashboard, filtros, kanban e alertas).
// origem = MUNICIPAL (API de Tijucas) | PNCP (Fase 8)
const Oportunidade = db.define('oportunidade', {
    codOportunidade: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    origem: { type: DataTypes.ENUM('MUNICIPAL', 'PNCP'), allowNull: false, defaultValue: 'MUNICIPAL' },
    chaveExterna: { type: DataTypes.STRING(190), allowNull: false },
    numero: { type: DataTypes.STRING(40) },
    ano: { type: DataTypes.INTEGER },
    objeto: { type: DataTypes.TEXT },
    unidadeGestora: { type: DataTypes.STRING(255) },
    municipio: { type: DataTypes.STRING(100) },
    uf: { type: DataTypes.CHAR(2) },
    modalidade: { type: DataTypes.STRING(120) },
    tipoConcorrencia: { type: DataTypes.STRING(120) },
    situacao: { type: DataTypes.STRING(120) },
    valorEstimado: { type: DataTypes.DECIMAL(15, 2) },
    valorHomologado: { type: DataTypes.DECIMAL(15, 2) },
    dataEdital: { type: DataTypes.DATE },
    dataAbertura: { type: DataTypes.DATE },
    dataHomologacao: { type: DataTypes.DATE },
    idCategoria: { type: DataTypes.INTEGER },
    selos: { type: DataTypes.STRING(255) },
    seloPrincipal: { type: DataTypes.STRING(40) }
}, {
    tableName: 'oportunidades',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['origem', 'chaveExterna'], name: 'uq_oportunidade_origem_chave' },
        { fields: ['idCategoria'] },
        { fields: ['modalidade'] },
        { fields: ['situacao'] },
        { fields: ['dataEdital'] },
        { fields: ['valorEstimado'] },
        { fields: ['seloPrincipal'] },
        { fields: ['unidadeGestora'] }
    ]
})

module.exports = Oportunidade

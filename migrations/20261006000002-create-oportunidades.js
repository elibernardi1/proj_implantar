'use strict'

// Cria a tabela oportunidades (se ainda não existir) com seus índices.
module.exports = {
    async up(queryInterface, Sequelize) {
        const tabelas = await queryInterface.showAllTables()
        if (tabelas.includes('oportunidades')) return

        await queryInterface.createTable('oportunidades', {
            codOportunidade: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            origem: { type: Sequelize.ENUM('MUNICIPAL', 'PNCP'), allowNull: false, defaultValue: 'MUNICIPAL' },
            chaveExterna: { type: Sequelize.STRING(190), allowNull: false },
            numero: Sequelize.STRING(40),
            ano: Sequelize.INTEGER,
            objeto: Sequelize.TEXT,
            unidadeGestora: Sequelize.STRING(255),
            municipio: Sequelize.STRING(100),
            uf: Sequelize.CHAR(2),
            modalidade: Sequelize.STRING(120),
            tipoConcorrencia: Sequelize.STRING(120),
            situacao: Sequelize.STRING(120),
            valorEstimado: Sequelize.DECIMAL(15, 2),
            valorHomologado: Sequelize.DECIMAL(15, 2),
            dataEdital: Sequelize.DATE,
            dataAbertura: Sequelize.DATE,
            dataHomologacao: Sequelize.DATE,
            idCategoria: {
                type: Sequelize.INTEGER,
                references: { model: 'categorias', key: 'codCategoria' },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            },
            selos: Sequelize.STRING(255),
            seloPrincipal: Sequelize.STRING(40),
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false }
        })

        await queryInterface.addIndex('oportunidades', ['origem', 'chaveExterna'], { unique: true, name: 'uq_oportunidade_origem_chave' })
        for (const campo of ['idCategoria', 'modalidade', 'situacao', 'dataEdital', 'valorEstimado', 'seloPrincipal', 'unidadeGestora']) {
            await queryInterface.addIndex('oportunidades', [campo])
        }
    },

    async down(queryInterface) {
        await queryInterface.dropTable('oportunidades')
    }
}

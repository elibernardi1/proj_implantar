'use strict'

// Adiciona categorias.tipo (SERVICO por padrão) e cadastra os ramos de licitação (tipo RAMO).
// Não altera nem apaga nenhuma categoria existente. Pode ser executada mais de uma vez.
const RAMOS = [
    ['Obras e Engenharia', 'Obras, reformas, pavimentação e serviços de engenharia'],
    ['Saúde', 'Medicamentos, insumos hospitalares e serviços de saúde'],
    ['Tecnologia da Informação', 'Equipamentos, software, sistemas e serviços de TI'],
    ['Alimentação', 'Gêneros alimentícios, merenda e refeições'],
    ['Limpeza e Conservação', 'Material de limpeza, conservação e higienização'],
    ['Veículos e Combustíveis', 'Veículos, peças, manutenção e combustíveis'],
    ['Educação', 'Material escolar, transporte escolar e serviços educacionais'],
    ['Segurança', 'Vigilância, monitoramento e equipamentos de segurança'],
    ['Outros', 'Objetos que não se encaixam nos demais ramos']
]

module.exports = {
    async up(queryInterface, Sequelize) {
        const colunas = await queryInterface.describeTable('categorias')
        if (!colunas.tipo) {
            await queryInterface.addColumn('categorias', 'tipo', {
                type: Sequelize.ENUM('SERVICO', 'RAMO'),
                allowNull: false,
                defaultValue: 'SERVICO'
            })
        }

        for (const [nome, descricao] of RAMOS) {
            const [existe] = await queryInterface.sequelize.query(
                'SELECT codCategoria FROM categorias WHERE nome = :nome AND tipo = :tipo LIMIT 1',
                { replacements: { nome, tipo: 'RAMO' } }
            )
            if (!existe.length) {
                await queryInterface.bulkInsert('categorias', [{ nome, descricao, tipo: 'RAMO' }])
            }
        }
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query("DELETE FROM categorias WHERE tipo = 'RAMO'")
        const colunas = await queryInterface.describeTable('categorias')
        if (colunas.tipo) await queryInterface.removeColumn('categorias', 'tipo')
    }
}

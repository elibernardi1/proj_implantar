const conn = require('./db/conn')
const { Usuario, Categoria, Servico, Estoque, Pedido, ItemPedido, Entrega } = require('./models/rel')

async function dataBaseSync() {
    try {
        await conn.sync({ force: true })
        console.log('7 tabelas sincronizadas: usuarios, categorias, servicos, estoques, pedidos, itens_pedido, entregas')
    } catch (err) {
        console.error('Erro de sincronização!', err.message || err)
    } finally {
        await conn.close()
        console.log('fechando o banco de dados')
    }
}

dataBaseSync()

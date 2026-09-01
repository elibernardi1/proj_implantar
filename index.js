require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express()

const PORT = process.env.PORT || 3000

const conn = require('./src/db/conn')
require('./src/models/rel')

const usuarioController = require('./src/controller/usuario.controller')
const categoriaController = require('./src/controller/categoria.controller')
const servicoController = require('./src/controller/servico.controller')
const estoqueController = require('./src/controller/estoque.controller')
const pedidoController = require('./src/controller/pedido.controller')
const itemPedidoController = require('./src/controller/itemPedido.controller')
const entregaController = require('./src/controller/entrega.controller')

const { autenticar, somenteAdmin } = require('./src/middleware/auth.middleware')

// ---------- middleware -------------
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())
// -----------------------------------

// =====================================================
// ROTAS PÚBLICAS (sem necessidade de login)
// =====================================================
app.post('/login', usuarioController.login)
app.post('/usuarios', usuarioController.cadastrar)

app.get('/produtos', servicoController.listar)          // vitrine de serviços (mantém nome do PDF)
app.get('/servicos', servicoController.listar)
app.get('/servicos/buscar', servicoController.consultar)
app.get('/servicos/:id', servicoController.consultar)

app.get('/categorias', categoriaController.listar)
app.get('/categorias/buscar', categoriaController.consultar)
app.get('/categorias/:id', categoriaController.consultar)

// =====================================================
// ROTAS PRIVADAS (protegidas por JWT)
// =====================================================

// Perfil do usuário logado
app.get('/usuarios/perfil', autenticar, usuarioController.perfil)
app.put('/usuarios/:id', autenticar, usuarioController.atualizar)
app.patch('/usuarios/:id', autenticar, usuarioController.atualizarParcial)

// Checkout e histórico de pedidos
app.post('/pedidos', autenticar, pedidoController.cadastrar)
app.get('/pedidos/meus-pedidos', autenticar, pedidoController.meusPedidos)
app.get('/pedidos/:id', autenticar, pedidoController.consultar)

// Itens de pedido (consulta)
app.get('/itens-pedido', autenticar, somenteAdmin, itemPedidoController.listar)
app.get('/itens-pedido/:id', autenticar, itemPedidoController.consultar)

// Painel administrativo / gestão de serviços (catálogo)
app.post('/servicos', autenticar, somenteAdmin, servicoController.cadastrar)
app.put('/servicos/:id', autenticar, somenteAdmin, servicoController.atualizar)
app.patch('/servicos/:id', autenticar, somenteAdmin, servicoController.atualizarParcial)
app.delete('/servicos/:id', autenticar, somenteAdmin, servicoController.apagar)

// Painel administrativo / gestão de categorias
app.post('/categorias', autenticar, somenteAdmin, categoriaController.cadastrar)
app.put('/categorias/:id', autenticar, somenteAdmin, categoriaController.atualizar)
app.patch('/categorias/:id', autenticar, somenteAdmin, categoriaController.atualizarParcial)
app.delete('/categorias/:id', autenticar, somenteAdmin, categoriaController.apagar)

// Movimentação e controle de estoque (capacidade de atendimento)
app.post('/estoque', autenticar, somenteAdmin, estoqueController.cadastrar)
app.get('/estoque', autenticar, somenteAdmin, estoqueController.listar)

// Gestão de usuários (admin)
app.get('/usuarios', autenticar, somenteAdmin, usuarioController.listar)
app.get('/usuarios/:id', autenticar, somenteAdmin, usuarioController.consultar)
app.delete('/usuarios/:id', autenticar, somenteAdmin, usuarioController.apagar)

// Acompanhamento dos processos licitatórios (Entrega)
app.get('/entregas', autenticar, entregaController.listar)
app.get('/entregas/buscar', autenticar, entregaController.consultar)
app.get('/entregas/:id', autenticar, entregaController.consultar)
app.put('/entregas/:id', autenticar, somenteAdmin, entregaController.atualizar)
app.patch('/entregas/:id', autenticar, somenteAdmin, entregaController.atualizarParcial)

// Relatórios gerenciais (para os gráficos com chart.js no frontend)
app.get('/relatorios/vendas', autenticar, somenteAdmin, async (req, res) => {
    // TODO: agregação de valorTotal por Categoria/Servico (ex: usando group by + sum no Sequelize)
    res.status(200).json({ message: 'Endpoint de relatório de vendas - implementar agregação' })
})
app.get('/relatorios/estoque', autenticar, somenteAdmin, async (req, res) => {
    // TODO: agregação de capacidadeDisponivel por Servico/Categoria
    res.status(200).json({ message: 'Endpoint de relatório de estoque - implementar agregação' })
})

app.get('/', (req, res) => {
    res.status(200).json({ message: 'API Del Company rodando' })
})

// ------------------- Server ---------------
// Só conecta no banco e sobe o servidor quando este arquivo é executado
// diretamente (ex: "node index.js"). Isso permite que os testes importem
// o "app" (module.exports abaixo) sem depender de um banco real nem
// disputar a porta 3000.
if (require.main === module) {
    conn.sync()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Servidor rodando em Port: ${PORT}`)
            })
        })
        .catch((err) => {
            console.error('Erro de conexão com o banco de dados!', err.message || err)
        })
}

module.exports = app
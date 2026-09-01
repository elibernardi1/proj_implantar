const Usuario = require('./Usuario')
const Categoria = require('./Categoria')
const Servico = require('./Servico')
const Estoque = require('./Estoque')
const Pedido = require('./Pedido')
const ItemPedido = require('./ItemPedido')
const Entrega = require('./Entrega')

// Categoria -> Servico
Categoria.hasMany(Servico, {
    foreignKey: 'idCategoria',
    as: 'servicosCategoria',
    onDelete: 'CASCADE'
})
Servico.belongsTo(Categoria, {
    foreignKey: 'idCategoria',
    as: 'categoriaServico',
    allowNull: false
})

// Usuario -> Estoque
Usuario.hasMany(Estoque, {
    foreignKey: 'idUsuario',
    as: 'estoqueUsuario',
    onDelete: 'CASCADE'
})
Estoque.belongsTo(Usuario, {
    foreignKey: 'idUsuario',
    as: 'usuarioEstoque',
    allowNull: false
})

// Servico -> Estoque
Servico.hasMany(Estoque, {
    foreignKey: 'idServico',
    as: 'estoqueServico',
    onDelete: 'CASCADE'
})
Estoque.belongsTo(Servico, {
    foreignKey: 'idServico',
    as: 'servicoEstoque',
    allowNull: false
})

// Usuario -> Pedido
Usuario.hasMany(Pedido, {
    foreignKey: 'idUsuario',
    as: 'pedidosUsuario',
    onDelete: 'CASCADE'
})
Pedido.belongsTo(Usuario, {
    foreignKey: 'idUsuario',
    as: 'usuarioPedido',
    allowNull: false
})

// Pedido -> ItemPedido
Pedido.hasMany(ItemPedido, {
    foreignKey: 'idPedido',
    as: 'itensPedido',
    onDelete: 'CASCADE'
})
ItemPedido.belongsTo(Pedido, {
    foreignKey: 'idPedido',
    as: 'pedidoItem',
    allowNull: false
})

// Servico -> ItemPedido
Servico.hasMany(ItemPedido, {
    foreignKey: 'idServico',
    as: 'itensServico',
    onDelete: 'CASCADE'
})
ItemPedido.belongsTo(Servico, {
    foreignKey: 'idServico',
    as: 'servicoItem',
    allowNull: false
})

// Pedido -> Entrega (1:1)
Pedido.hasOne(Entrega, {
    foreignKey: 'idPedido',
    as: 'entregaPedido',
    onDelete: 'CASCADE'
})
Entrega.belongsTo(Pedido, {
    foreignKey: 'idPedido',
    as: 'pedidoEntrega',
    allowNull: false
})

module.exports = { Usuario, Categoria, Servico, Estoque, Pedido, ItemPedido, Entrega }

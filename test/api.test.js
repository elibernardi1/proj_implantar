const { test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const axios = require('axios')

process.env.JWT_SECRET = 'segredo-exclusivo-para-testes-automatizados'

const app = require('../index')
const conn = require('../src/db/conn')
const Usuario = require('../src/models/Usuario')
const Categoria = require('../src/models/Categoria')
const Servico = require('../src/models/Servico')
const Estoque = require('../src/models/Estoque')
const Pedido = require('../src/models/Pedido')
const ItemPedido = require('../src/models/ItemPedido')
const Entrega = require('../src/models/Entrega')

let server
let baseUrl
const originals = new Map()

// ---------- utilitários de teste ----------

function stub(object, method, implementation) {
  if (!originals.has(object)) originals.set(object, new Map())
  const methods = originals.get(object)
  if (!methods.has(method)) methods.set(method, object[method])
  object[method] = implementation
}

function restoreStubs() {
  for (const [object, methods] of originals) {
    for (const [method, implementation] of methods) object[method] = implementation
  }
  originals.clear()
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers
    }
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

// Gera um token igual ao que usuario.controller.js/login emite: { codUsuario, tipo }
function gerarToken(usuario) {
  return jwt.sign(
    { codUsuario: usuario.codUsuario, tipo: usuario.tipo },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

// Resposta padrão do ViaCEP usada nos testes que passam pelo consultarCEP.js
function respostaViaCepValida() {
  return {
    data: {
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP'
    }
  }
}

const CPF_VALIDO = '529.982.247-25'

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterEach(restoreStubs)
after(async () => new Promise((resolve) => server.close(resolve)))

// =====================================================
// Raiz e autenticação (middleware)
// =====================================================

test('rota raiz confirma que a API está no ar', async () => {
  const response = await request('/')
  assert.equal(response.status, 200)
  assert.equal(response.body.message, 'API Del Company rodando')
})

test('rota protegida rejeita requisição sem token', async () => {
  const response = await request('/usuarios/perfil')
  assert.equal(response.status, 401)
  assert.equal(response.body.message, 'Token não informado')
})

test('rota protegida rejeita token inválido', async () => {
  const response = await request('/usuarios/perfil', {
    headers: { authorization: 'Bearer token-invalido' }
  })
  assert.equal(response.status, 401)
  assert.equal(response.body.message, 'Token inválido ou expirado')
})

test('rota somente admin bloqueia usuário comum', async () => {
  const cliente = { codUsuario: 5, tipo: 'CLIENTE' }
  const response = await request('/usuarios', {
    headers: { authorization: `Bearer ${gerarToken(cliente)}` }
  })
  assert.equal(response.status, 403)
  assert.equal(response.body.message, 'Acesso permitido somente para administradores')
})

// =====================================================
// Login (POST /login)
// =====================================================

test('login exige e-mail e senha', async () => {
  const response = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@delcompany.com' })
  })
  assert.equal(response.status, 400)
})

test('login rejeita e-mail não cadastrado', async () => {
  stub(Usuario, 'findOne', async () => null)

  const response = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'inexistente@delcompany.com', senha: '12345678' })
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.message, 'E-mail ou senha inválidos')
})

test('login rejeita senha incorreta', async () => {
  const senhaHash = await bcrypt.hash('senhaCorreta123', 10)
  stub(Usuario, 'findOne', async () => ({
    codUsuario: 1, nome: 'Admin', tipo: 'ADMIN', senha: senhaHash
  }))

  const response = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@delcompany.com', senha: 'senhaErrada' })
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.message, 'E-mail ou senha inválidos')
})

test('login bem-sucedido devolve token e oculta a senha', async () => {
  const senhaHash = await bcrypt.hash('senhaCorreta123', 10)
  stub(Usuario, 'findOne', async () => ({
    codUsuario: 1, nome: 'Admin', tipo: 'ADMIN', senha: senhaHash
  }))

  const response = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@delcompany.com', senha: 'senhaCorreta123' })
  })

  assert.equal(response.status, 200, JSON.stringify(response.body))
  assert.equal(typeof response.body.token, 'string')
  assert.equal(response.body.usuario.tipo, 'ADMIN')
  assert.equal(response.body.usuario.senha, undefined)

  const decodificado = jwt.verify(response.body.token, process.env.JWT_SECRET)
  assert.equal(decodificado.codUsuario, 1)
  assert.equal(decodificado.tipo, 'ADMIN')
})

// =====================================================
// Cadastro de usuário (POST /usuarios) - CPF + ViaCEP
// =====================================================

test('cadastro de usuário exige os campos obrigatórios', async () => {
  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Fulano' })
  })
  assert.equal(response.status, 400)
})

test('cadastro de usuário rejeita CPF matematicamente inválido', async () => {
  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Fulano',
      email: 'fulano@teste.com',
      senha: '12345678',
      cpf: '111.111.111-11',
      cep: '01310-100'
    })
  })
  assert.equal(response.status, 400)
  assert.equal(response.body.message, 'CPF inválido')
})

test('cadastro de usuário rejeita e-mail ou CPF já existentes', async () => {
  stub(Usuario, 'findOne', async () => ({ codUsuario: 9 }))

  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Fulano',
      email: 'fulano@teste.com',
      senha: '12345678',
      cpf: CPF_VALIDO,
      cep: '01310-100'
    })
  })

  assert.equal(response.status, 409)
  assert.equal(response.body.message, 'E-mail ou CPF já cadastrado')
})

test('cadastro de usuário rejeita CEP não encontrado no ViaCEP', async () => {
  stub(Usuario, 'findOne', async () => null)
  stub(axios, 'get', async () => ({ data: { erro: true } }))

  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Fulano',
      email: 'fulano@teste.com',
      senha: '12345678',
      cpf: CPF_VALIDO,
      cep: '00000-000'
    })
  })

  assert.equal(response.status, 400)
  assert.equal(response.body.message, 'CEP não encontrado')
})

test('cadastro de usuário completa o endereço via ViaCEP, criptografa a senha e oculta o retorno', async () => {
  stub(Usuario, 'findOne', async () => null)
  stub(axios, 'get', async () => respostaViaCepValida())
  let dadosCriados
  stub(Usuario, 'create', async (dados) => {
    dadosCriados = dados
    return { codUsuario: 10, toJSON: () => ({ codUsuario: 10, ...dados }) }
  })

  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Fulano de Tal',
      email: 'fulano@teste.com',
      senha: '12345678',
      cpf: CPF_VALIDO,
      cep: '01310-100'
    })
  })

  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.equal(response.body.dados.senha, undefined)
  assert.equal(response.body.dados.rua, 'Avenida Paulista')
  assert.equal(response.body.dados.cidade, 'São Paulo')
  assert.equal(dadosCriados.tipo, 'CLIENTE')
  assert.notEqual(dadosCriados.senha, '12345678')
  assert.ok(await bcrypt.compare('12345678', dadosCriados.senha))
})

test('cadastro de usuário aceita tipo ADMIN quando informado explicitamente', async () => {
  stub(Usuario, 'findOne', async () => null)
  stub(axios, 'get', async () => respostaViaCepValida())
  let dadosCriados
  stub(Usuario, 'create', async (dados) => {
    dadosCriados = dados
    return { codUsuario: 11, toJSON: () => ({ codUsuario: 11, ...dados }) }
  })

  const response = await request('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Administradora',
      email: 'admin2@teste.com',
      senha: '12345678',
      cpf: CPF_VALIDO,
      cep: '01310-100',
      tipo: 'ADMIN'
    })
  })

  assert.equal(response.status, 201)
  assert.equal(dadosCriados.tipo, 'ADMIN')
})

// =====================================================
// Catálogo público: serviços e categorias
// =====================================================

test('vitrine de serviços responde tanto em /produtos quanto em /servicos', async () => {
  stub(Servico, 'findAll', async () => ([{ codServico: 1, nome: 'Elaboração de edital' }]))

  const viaProdutos = await request('/produtos')
  assert.equal(viaProdutos.status, 200)
  assert.equal(viaProdutos.body.length, 1)

  const viaServicos = await request('/servicos')
  assert.equal(viaServicos.status, 200)
  assert.equal(viaServicos.body[0].nome, 'Elaboração de edital')
})

test('busca de serviços por nome usa /servicos/buscar', async () => {
  stub(Servico, 'findAll', async () => ([{ codServico: 2, nome: 'Assessoria em pregão' }]))

  const response = await request('/servicos/buscar?nome=preg%C3%A3o')
  assert.equal(response.status, 200)
  assert.equal(response.body[0].codServico, 2)
})

test('consulta de serviço por id retorna 404 quando não existe', async () => {
  stub(Servico, 'findByPk', async () => null)

  const response = await request('/servicos/999')
  assert.equal(response.status, 404)
  assert.equal(response.body.message, 'Serviço não encontrado!')
})

test('categorias: listar, buscar por nome e consultar por id', async () => {
  stub(Categoria, 'findAll', async () => ([{ codCategoria: 1, nome: 'Documentação' }]))
  const listagem = await request('/categorias')
  assert.equal(listagem.status, 200)

  const busca = await request('/categorias/buscar?nome=Doc')
  assert.equal(busca.status, 200)
  assert.equal(busca.body[0].nome, 'Documentação')

  stub(Categoria, 'findByPk', async () => null)
  const naoEncontrada = await request('/categorias/50')
  assert.equal(naoEncontrada.status, 404)
})

// =====================================================
// Perfil e atualização de usuário (rotas privadas)
// =====================================================

test('usuário autenticado consulta o próprio perfil sem a senha', async () => {
  const usuarioLogado = { codUsuario: 7, tipo: 'CLIENTE' }
  stub(Usuario, 'findByPk', async () => ({ codUsuario: 7, nome: 'Cliente Teste', tipo: 'CLIENTE' }))

  const response = await request('/usuarios/perfil', {
    headers: { authorization: `Bearer ${gerarToken(usuarioLogado)}` }
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.codUsuario, 7)
  assert.equal(response.body.senha, undefined)
})

test('atualização completa (PUT) exige nome, email e cep, e reconsulta o CEP', async () => {
  const usuarioLogado = { codUsuario: 7, tipo: 'CLIENTE' }
  const headers = { authorization: `Bearer ${gerarToken(usuarioLogado)}` }

  const semCampos = await request('/usuarios/7', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ nome: 'Só o nome' })
  })
  assert.equal(semCampos.status, 400)

  stub(Usuario, 'findByPk', async () => ({ codUsuario: 7 }))
  stub(axios, 'get', async () => respostaViaCepValida())
  let atualizacaoEnviada
  stub(Usuario, 'update', async (dados) => {
    atualizacaoEnviada = dados
    return [1]
  })

  const completo = await request('/usuarios/7', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ nome: 'Cliente Atualizado', email: 'cliente@teste.com', cep: '01310-100' })
  })

  assert.equal(completo.status, 200, JSON.stringify(completo.body))
  assert.equal(atualizacaoEnviada.rua, 'Avenida Paulista')
  assert.equal(completo.body.dados.senha, undefined)
})

test('atualização parcial (PATCH) criptografa a nova senha quando informada', async () => {
  const usuarioLogado = { codUsuario: 7, tipo: 'CLIENTE' }
  stub(Usuario, 'findByPk', async () => ({ codUsuario: 7 }))
  let atualizacaoEnviada
  stub(Usuario, 'update', async (dados) => {
    atualizacaoEnviada = dados
    return [1]
  })

  const response = await request('/usuarios/7', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${gerarToken(usuarioLogado)}` },
    body: JSON.stringify({ senha: 'novaSenha123' })
  })

  assert.equal(response.status, 200, JSON.stringify(response.body))
  assert.notEqual(atualizacaoEnviada.senha, 'novaSenha123')
  assert.ok(await bcrypt.compare('novaSenha123', atualizacaoEnviada.senha))
})

// =====================================================
// Checkout de pedido (POST /pedidos) - transação + Entrega
// =====================================================

test('checkout exige ao menos um item e os dados do processo licitatório', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  const headers = { authorization: `Bearer ${gerarToken(cliente)}` }

  const semItens = await request('/pedidos', {
    method: 'POST',
    headers,
    body: JSON.stringify({ itens: [], entrega: { orgaoResponsavel: 'Prefeitura', objetoLicitacao: 'X', modalidade: 'Pregão' } })
  })
  assert.equal(semItens.status, 400)

  const semEntrega = await request('/pedidos', {
    method: 'POST',
    headers,
    body: JSON.stringify({ itens: [{ idServico: 1, quantidade: 1 }] })
  })
  assert.equal(semEntrega.status, 400)
})

test('checkout rejeita item cujo serviço não tem capacidade suficiente', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  stub(conn, 'transaction', async () => ({ commit: async () => { }, rollback: async () => { } }))
  stub(Servico, 'findByPk', async () => ({
    codServico: 1, nome: 'Elaboração de edital', preco: '500.00', capacidadeDisponivel: 1
  }))

  const response = await request('/pedidos', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(cliente)}` },
    body: JSON.stringify({
      itens: [{ idServico: 1, quantidade: 3 }],
      entrega: { orgaoResponsavel: 'Prefeitura Municipal', objetoLicitacao: 'Compra de insumos', modalidade: 'Pregão Eletrônico' }
    })
  })

  assert.equal(response.status, 400)
  assert.match(response.body.message, /Capacidade insuficiente/)
})

test('checkout bem-sucedido cria pedido, itens, deduz capacidade e abre a entrega (processo licitatório)', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  const servico = {
    codServico: 1,
    nome: 'Elaboração de edital',
    preco: '500.00',
    capacidadeDisponivel: 5,
    async update(dados) { Object.assign(this, dados); return this }
  }

  stub(conn, 'transaction', async () => ({ commit: async () => { }, rollback: async () => { } }))
  stub(Servico, 'findByPk', async () => servico)
  let pedidoCriado
  stub(Pedido, 'create', async (dados) => {
    pedidoCriado = { codPedido: 100, ...dados }
    return pedidoCriado
  })
  const itensCriados = []
  stub(ItemPedido, 'create', async (dados) => {
    itensCriados.push(dados)
    return dados
  })
  let entregaCriada
  stub(Entrega, 'create', async (dados) => {
    entregaCriada = { codEntrega: 200, ...dados }
    return entregaCriada
  })

  const response = await request('/pedidos', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(cliente)}` },
    body: JSON.stringify({
      itens: [{ idServico: 1, quantidade: 2 }],
      entrega: {
        orgaoResponsavel: 'Prefeitura Municipal de Tijucas',
        objetoLicitacao: 'Aquisição de material de escritório',
        modalidade: 'Pregão Eletrônico'
      }
    })
  })

  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.equal(pedidoCriado.idUsuario, 7)
  assert.equal(pedidoCriado.valorTotal, 1000)
  assert.equal(itensCriados[0].idPedido, 100)
  assert.equal(itensCriados[0].precoUnitario, '500.00')
  assert.equal(servico.capacidadeDisponivel, 3)
  assert.equal(entregaCriada.idPedido, 100)
  assert.equal(entregaCriada.orgaoResponsavel, 'Prefeitura Municipal de Tijucas')
  assert.equal(response.body.entrega.objetoLicitacao, 'Aquisição de material de escritório')
})

test('cliente logado consulta apenas os próprios pedidos em /pedidos/meus-pedidos', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  let filtroRecebido
  stub(Pedido, 'findAll', async (opcoes) => {
    filtroRecebido = opcoes.where
    return [{ codPedido: 100, idUsuario: 7 }]
  })

  const response = await request('/pedidos/meus-pedidos', {
    headers: { authorization: `Bearer ${gerarToken(cliente)}` }
  })

  assert.equal(response.status, 200)
  assert.equal(filtroRecebido.idUsuario, 7)
  assert.equal(response.body[0].codPedido, 100)
})

test('consulta de pedido inexistente devolve 404', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  stub(Pedido, 'findByPk', async () => null)

  const response = await request('/pedidos/999', {
    headers: { authorization: `Bearer ${gerarToken(cliente)}` }
  })

  assert.equal(response.status, 404)
})

// =====================================================
// Itens de pedido
// =====================================================

test('listagem de itens de pedido é restrita a administradores', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  stub(ItemPedido, 'findAll', async () => ([{ codItemPedido: 1 }]))

  const negado = await request('/itens-pedido', {
    headers: { authorization: `Bearer ${gerarToken(cliente)}` }
  })
  assert.equal(negado.status, 403)

  const permitido = await request('/itens-pedido', {
    headers: { authorization: `Bearer ${gerarToken(admin)}` }
  })
  assert.equal(permitido.status, 200)
})

// =====================================================
// Gestão de serviços (admin)
// =====================================================

test('cadastro de serviço exige categoria existente', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  stub(Categoria, 'findByPk', async () => null)

  const response = await request('/servicos', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(admin)}` },
    body: JSON.stringify({ nome: 'Consultoria', descricao: 'desc', preco: 300, idCategoria: 99 })
  })

  assert.equal(response.status, 404)
  assert.equal(response.body.message, 'Categoria informada não existe')
})

test('administrador cadastra, atualiza e exclui um serviço', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  const headers = { authorization: `Bearer ${gerarToken(admin)}` }

  stub(Categoria, 'findByPk', async () => ({ codCategoria: 1, nome: 'Documentação' }))
  stub(Servico, 'create', async (dados) => ({ codServico: 5, ...dados }))

  const criado = await request('/servicos', {
    method: 'POST',
    headers,
    body: JSON.stringify({ nome: 'Consultoria', descricao: 'desc', preco: 300, idCategoria: 1 })
  })
  assert.equal(criado.status, 201, JSON.stringify(criado.body))

  stub(Servico, 'findByPk', async () => ({ codServico: 5, nome: 'Consultoria' }))
  stub(Servico, 'update', async () => [1])

  const atualizadoParcial = await request('/servicos/5', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ preco: 350 })
  })
  assert.equal(atualizadoParcial.status, 200, JSON.stringify(atualizadoParcial.body))

  stub(Servico, 'destroy', async () => 1)
  const excluido = await request('/servicos/5', { method: 'DELETE', headers })
  assert.equal(excluido.status, 200)
  assert.equal(excluido.body.message, 'Serviço excluído com sucesso!')
})

// =====================================================
// Gestão de categorias (admin)
// =====================================================

test('cadastro de categoria rejeita nome duplicado', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  stub(Categoria, 'findOne', async () => ({ codCategoria: 1 }))

  const response = await request('/categorias', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(admin)}` },
    body: JSON.stringify({ nome: 'Documentação' })
  })

  assert.equal(response.status, 409)
  assert.equal(response.body.message, 'Categoria já cadastrada')
})

// =====================================================
// Estoque (capacidade de atendimento dos serviços)
// =====================================================

test('movimentação de ENTRADA no estoque aumenta a capacidade disponível do serviço', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  const servico = { codServico: 1, capacidadeDisponivel: 10, async update(dados) { Object.assign(this, dados); return this } }
  stub(Usuario, 'findByPk', async () => ({ codUsuario: 1 }))
  stub(Servico, 'findByPk', async () => servico)
  stub(Estoque, 'create', async (dados) => ({ codEstoque: 1, ...dados }))

  const response = await request('/estoque', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(admin)}` },
    body: JSON.stringify({ idUsuario: 1, idServico: 1, data: '2026-09-01', qtdeMov: 5, tipo: 'ENTRADA' })
  })

  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.equal(response.body.novaCapacidade, 15)
  assert.equal(servico.capacidadeDisponivel, 15)
})

test('movimentação de SAÍDA no estoque não pode deixar a capacidade negativa', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  const servico = { codServico: 1, capacidadeDisponivel: 3, async update(dados) { Object.assign(this, dados); return this } }
  stub(Usuario, 'findByPk', async () => ({ codUsuario: 1 }))
  stub(Servico, 'findByPk', async () => servico)

  const response = await request('/estoque', {
    method: 'POST',
    headers: { authorization: `Bearer ${gerarToken(admin)}` },
    body: JSON.stringify({ idUsuario: 1, idServico: 1, data: '2026-09-01', qtdeMov: 5, tipo: 'SAIDA' })
  })

  assert.equal(response.status, 400)
  assert.equal(response.body.message, 'Capacidade insuficiente!')
  assert.equal(servico.capacidadeDisponivel, 3)
})

// =====================================================
// Gestão de usuários (admin)
// =====================================================

test('administrador lista usuários sem expor a senha e pode excluir um usuário', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  const headers = { authorization: `Bearer ${gerarToken(admin)}` }
  stub(Usuario, 'findAll', async () => ([{ codUsuario: 7, nome: 'Cliente' }]))

  const listagem = await request('/usuarios', { headers })
  assert.equal(listagem.status, 200)
  assert.equal(listagem.body[0].senha, undefined)

  stub(Usuario, 'findByPk', async () => ({ codUsuario: 7 }))
  stub(Usuario, 'destroy', async () => 1)
  const exclusao = await request('/usuarios/7', { method: 'DELETE', headers })
  assert.equal(exclusao.status, 200)
})

// =====================================================
// Acompanhamento dos processos licitatórios (Entrega)
// =====================================================

test('qualquer usuário autenticado acompanha os processos licitatórios (entregas)', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  const headers = { authorization: `Bearer ${gerarToken(cliente)}` }
  stub(Entrega, 'findAll', async () => ([{ codEntrega: 200, orgaoResponsavel: 'Prefeitura' }]))

  const listagem = await request('/entregas', { headers })
  assert.equal(listagem.status, 200)

  const busca = await request('/entregas/buscar?orgao=Prefeitura', { headers })
  assert.equal(busca.status, 200)
  assert.equal(busca.body[0].codEntrega, 200)
})

test('apenas administrador atualiza o andamento de um processo licitatório', async () => {
  const cliente = { codUsuario: 7, tipo: 'CLIENTE' }
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  stub(Entrega, 'findByPk', async () => ({
    codEntrega: 200,
    situacao: 'EM_ANDAMENTO',
    async update(dados) { Object.assign(this, dados); return this }
  }))
  stub(Entrega, 'update', async () => [1])

  const negado = await request('/entregas/200', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${gerarToken(cliente)}` },
    body: JSON.stringify({ situacao: 'ENTREGUE' })
  })
  assert.equal(negado.status, 403)

  const permitido = await request('/entregas/200', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${gerarToken(admin)}` },
    body: JSON.stringify({ situacao: 'ENTREGUE' })
  })
  assert.equal(permitido.status, 200, JSON.stringify(permitido.body))
})

// =====================================================
// Relatórios gerenciais (endpoints ainda em TODO no controller)
// =====================================================

test('endpoints de relatórios respondem para o administrador (ainda pendentes de agregação)', async () => {
  const admin = { codUsuario: 1, tipo: 'ADMIN' }
  const headers = { authorization: `Bearer ${gerarToken(admin)}` }

  const vendas = await request('/relatorios/vendas', { headers })
  assert.equal(vendas.status, 200)

  const estoqueRel = await request('/relatorios/estoque', { headers })
  assert.equal(estoqueRel.status, 200)
})
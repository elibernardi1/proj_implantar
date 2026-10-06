const { test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const axios = require('axios')

process.env.JWT_SECRET = 'segredo-exclusivo-para-testes-automatizados'

const app = require('../index')
const Oportunidade = require('../src/models/Oportunidade')
const Categoria = require('../src/models/Categoria')
const enq = require('../src/services/enquadramento.service')
const { classificarObjeto, limparCache } = require('../src/services/classificacao.service')
const sincronizacao = require('../src/services/sincronizacaoMunicipal.service')
const { paraValor, paraData } = require('../src/utils/conversores')
const { LIMITES } = require('../config/limitesLicitacao')

let server, baseUrl
const originals = new Map()

function stub(object, method, implementation) {
  if (!originals.has(object)) originals.set(object, new Map())
  const methods = originals.get(object)
  if (!methods.has(method)) methods.set(method, object[method])
  object[method] = implementation
}
function restoreStubs() {
  for (const [object, methods] of originals) for (const [m, impl] of methods) object[m] = impl
  originals.clear()
}
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type': 'application/json', ...options.headers } })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}
const token = (tipo) => jwt.sign({ codUsuario: 1, tipo }, process.env.JWT_SECRET, { expiresIn: '1h' })

before(async () => {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})
afterEach(() => { restoreStubs(); limparCache() })
after(async () => new Promise((resolve) => server.close(resolve)))

// ---------- limites centralizados ----------

test('limites de 2026 estão centralizados com os valores do decreto', () => {
  assert.equal(LIMITES.vigencia, 2026)
  assert.equal(LIMITES.itens.DISPENSA_OBRAS.valor, 130984.20)
  assert.equal(LIMITES.itens.DISPENSA_OUTROS.valor, 65492.11)
  assert.equal(LIMITES.itens.SERVICO_TECNICO_ESPECIALIZADO.valor, 392952.63)
  assert.equal(LIMITES.itens.CONTRATO_VERBAL.valor, 13098.41)
  assert.equal(LIMITES.itens.MANUTENCAO_VEICULOS.valor, 10478.74)
  assert.equal(LIMITES.itens.GRANDE_VULTO.valor, 261968421.04)
  assert.equal(LIMITES.itens.EXCLUSIVO_ME_EPP.valor, 80000)
})

// ---------- enquadramento ----------

test('enquadramento: dispensa de outras compras usa o limite de R$ 65.492,11 (exclusivo)', () => {
  assert.ok(enq.calcularCodigos({ valor: 65492.10, ramo: 'Saúde', objeto: 'x' }).includes('DISPENSA'))
  assert.ok(!enq.calcularCodigos({ valor: 65492.11, ramo: 'Saúde', objeto: 'x' }).includes('DISPENSA'))
})

test('enquadramento: obras e engenharia usam o limite de R$ 130.984,20', () => {
  const obra = (valor) => enq.calcularCodigos({ valor, ramo: 'Obras e Engenharia', objeto: 'reforma' })
  assert.ok(obra(100000).includes('DISPENSA'))
  assert.ok(!obra(130984.20).includes('DISPENSA'))
  // o mesmo valor em outro ramo NÃO é dispensa
  assert.ok(!enq.calcularCodigos({ valor: 100000, ramo: 'Saúde', objeto: 'x' }).includes('DISPENSA'))
})

test('enquadramento: exclusivo ME/EPP até R$ 80.000 (inclusive) e pode coexistir com dispensa', () => {
  assert.deepEqual(enq.calcularCodigos({ valor: 80000, ramo: 'Saúde', objeto: 'x' }), ['EXCLUSIVO_ME_EPP'])
  assert.ok(!enq.calcularCodigos({ valor: 80000.01, ramo: 'Saúde', objeto: 'x' }).includes('EXCLUSIVO_ME_EPP'))
  const ambos = enq.calcularCodigos({ valor: 50000, ramo: 'Saúde', objeto: 'x' })
  assert.ok(ambos.includes('DISPENSA') && ambos.includes('EXCLUSIVO_ME_EPP'))
})

test('enquadramento: grande vulto só acima de R$ 261.968.421,04', () => {
  assert.ok(!enq.calcularCodigos({ valor: 261968421.04, ramo: 'Outros', objeto: 'x' }).includes('GRANDE_VULTO'))
  assert.ok(enq.calcularCodigos({ valor: 261968421.05, ramo: 'Outros', objeto: 'x' }).includes('GRANDE_VULTO'))
})

test('enquadramento: serviço técnico especializado exige termo no objeto e valor dentro do limite', () => {
  const base = { ramo: 'Outros' }
  assert.ok(enq.calcularCodigos({ ...base, valor: 300000, objeto: 'Contratação de consultoria jurídica' }).includes('SERVICO_TECNICO_ESPECIALIZADO'))
  assert.ok(!enq.calcularCodigos({ ...base, valor: 300000, objeto: 'Compra de cadeiras' }).includes('SERVICO_TECNICO_ESPECIALIZADO'))
  assert.ok(!enq.calcularCodigos({ ...base, valor: 400000, objeto: 'consultoria' }).includes('SERVICO_TECNICO_ESPECIALIZADO'))
})

test('enquadramento: sem valor estimado não há selo', () => {
  assert.deepEqual(enq.calcularCodigos({ valor: null, ramo: 'Saúde', objeto: 'x' }), [])
  assert.equal(enq.enquadrar({ valor: null, ramo: 'Saúde', objeto: 'x' }).principal, null)
})

test('enquadramento: selo principal segue a prioridade e o texto permite filtro por LIKE', () => {
  const r = enq.enquadrar({ valor: 50000, ramo: 'Saúde', objeto: 'x' })
  assert.equal(r.principal, 'DISPENSA')
  assert.ok(r.texto.includes(',EXCLUSIVO_ME_EPP,'))
  const selos = enq.descreverSelos(r.texto, 'Saúde')
  assert.equal(selos[0].emoji, '🟢')
  assert.equal(selos[0].limite, 65492.11)
})

// ---------- classificação ----------

test('classificação por ramo usando palavras-chave do objeto', () => {
  const casos = [
    ['Aquisição de computadores e notebook para a secretaria', 'Tecnologia da Informação'],
    ['Compra de medicamentos para o hospital municipal', 'Saúde'],
    ['Pavimentação asfáltica com fornecimento de cimento', 'Obras e Engenharia'],
    ['Fornecimento de combustível diesel e gasolina', 'Veículos e Combustíveis'],
    ['Aquisição de gêneros alimentícios para merenda', 'Alimentação'],
    ['Material de limpeza e higienização', 'Limpeza e Conservação'],
    ['Aquisição de material escolar', 'Educação'],
    ['Serviço de vigilância e monitoramento por câmeras', 'Segurança'],
    ['Locação de palco para evento cultural', 'Outros']
  ]
  for (const [objeto, esperado] of casos) assert.equal(classificarObjeto(objeto).ramo, esperado, objeto)
})

test('classificação ignora acentos/maiúsculas e "TI" só casa como palavra inteira', () => {
  assert.equal(classificarObjeto('MEDICAMENTOS HOSPITALARES').ramo, 'Saúde')
  assert.equal(classificarObjeto('Serviços de TI').ramo, 'Tecnologia da Informação')
  assert.equal(classificarObjeto('Gestão e atividades administrativas').ramo, 'Outros')
  assert.equal(classificarObjeto('').ramo, 'Outros')
})

// ---------- conversores e mapeamento ----------

test('conversores aceitam formatos brasileiros de valor e data', () => {
  assert.equal(paraValor('R$ 1.234,56'), 1234.56)
  assert.equal(paraValor('1234.56'), 1234.56)
  assert.equal(paraValor('65.492,11'), 65492.11)
  assert.equal(paraValor(''), null)
  assert.equal(paraValor('abc'), null)
  assert.equal(paraData('05/03/2026').toISOString().slice(0, 10), '2026-03-05')
  assert.equal(paraData('31/02/2026'), null)
  assert.equal(paraData('2026-03-05').toISOString().slice(0, 10), '2026-03-05')
})

test('mapearLicitacao aceita variações de nome e descarta registro sem número/ano', () => {
  const m = sincronizacao.mapearLicitacao({
    Modalidade: 'Pregão Eletrônico', licitacao_numero: '12', licitacao_ano: 2026,
    unidade_gestora: 'Prefeitura Municipal de Tijucas', objeto: 'Compra de notebook',
    valor_estimado: '45.000,00', valor_homologado: 40000, data_edital: '10/02/2026'
  })
  assert.equal(m.numero, '12')
  assert.equal(m.valorEstimado, 45000)
  assert.equal(m.valorHomologado, 40000)
  assert.equal(m.dataEdital.toISOString().slice(0, 10), '2026-02-10')
  assert.equal(sincronizacao.mapearLicitacao({ objeto: 'sem identificação' }), null)
})

test('sincronização grava classificando e enquadrando, sem duplicar', async () => {
  const criadas = []
  stub(axios, 'get', async () => ({
    data: { data: [
      { licitacao_numero: '1', licitacao_ano: 2026, unidade_gestora: 'Prefeitura', objeto: 'Compra de computadores', valor_estimado: 50000 },
      { licitacao_numero: '2', licitacao_ano: 2026, unidade_gestora: 'Prefeitura', objeto: 'Reforma de escola', valor_estimado: 120000 },
      { objeto: 'sem número' }
    ] }
  }))
  stub(Categoria, 'findOrCreate', async ({ where }) => [{ codCategoria: where.nome.length }])
  stub(Oportunidade, 'findOne', async ({ where }) => (where.chaveExterna.endsWith('|2|2026') ? { update: async () => {} } : null))
  stub(Oportunidade, 'create', async (dados) => { criadas.push(dados) })

  const resumo = await sincronizacao.sincronizar()
  assert.deepEqual(resumo, { recebidas: 3, criadas: 1, atualizadas: 1, ignoradas: 1, erros: 0 })
  assert.equal(criadas[0].origem, 'MUNICIPAL')
  assert.equal(criadas[0].uf, 'SC')
  assert.equal(criadas[0].seloPrincipal, 'DISPENSA')
  assert.ok(criadas[0].selos.includes(',EXCLUSIVO_ME_EPP,'))
})

test('sincronização trata API indisponível com código próprio', async () => {
  stub(axios, 'get', async () => { throw new Error('timeout') })
  await assert.rejects(sincronizacao.sincronizar(), (e) => e.codigo === 'API_INDISPONIVEL')
})

// ---------- endpoints ----------

test('filtros combinam ramo + estado + faixa de valor + situação e paginam', async () => {
  let argumentos
  stub(Oportunidade, 'findAndCountAll', async (a) => { argumentos = a; return { rows: [], count: 0 } })

  const r = await request('/api/licitacoes/filtros?ramo=Tecnologia%20da%20Informa%C3%A7%C3%A3o&uf=sc&valorMin=10000&valorMax=100000&situacao=Aberta&enquadramento=DISPENSA,EXCLUSIVO_ME_EPP&limite=500&pagina=2')
  assert.equal(r.status, 200)
  const { where } = argumentos
  assert.equal(where.uf, 'SC')
  assert.equal(where.situacao, 'Aberta')
  assert.equal(Object.getOwnPropertySymbols(where.valorEstimado).length, 2)
  assert.equal(argumentos.include[0].where.nome, 'Tecnologia da Informação')
  assert.equal(argumentos.limit, 100) // limite máximo
  assert.equal(argumentos.offset, 100) // página 2
  assert.equal(r.body.paginacao.pagina, 2)
})

test('filtros rejeitam valores, datas, uf e enquadramento inválidos', async () => {
  stub(Oportunidade, 'findAndCountAll', async () => ({ rows: [], count: 0 }))
  for (const q of ['valorMin=abc', 'publicacaoDe=10/02/2026', 'uf=SCC', 'enquadramento=INVENTADO', 'categoria=x', 'origem=XYZ']) {
    const r = await request(`/api/licitacoes/filtros?${q}`)
    assert.equal(r.status, 400, q)
  }
})

test('listagem devolve selos prontos e economia calculada no backend', async () => {
  stub(Oportunidade, 'findAndCountAll', async () => ({
    count: 1,
    rows: [{ toJSON: () => ({
      codOportunidade: 7, origem: 'MUNICIPAL', numero: '1', ano: 2026, objeto: 'Compra de notebook',
      valorEstimado: '50000.00', valorHomologado: '45000.00', selos: ',DISPENSA,EXCLUSIVO_ME_EPP,', seloPrincipal: 'DISPENSA',
      categoriaOportunidade: { codCategoria: 3, nome: 'Tecnologia da Informação' }
    }) }]
  }))
  const r = await request('/api/licitacoes/filtros')
  const item = r.body.dados[0]
  assert.equal(item.economia, 5000)
  assert.equal(item.percentualEconomia, 10)
  assert.equal(item.selos[0].codigo, 'DISPENSA')
  assert.equal(item.categoria.nome, 'Tecnologia da Informação')
})

test('opções de filtro devolvem ramos, enquadramentos e valores distintos', async () => {
  // cada consulta DISTINCT devolve [{ <campo>: valor }]; o nome do campo é o alias da coluna
  stub(Oportunidade, 'findAll', async ({ attributes }) => [{ [attributes[0][1]]: 2026 }])
  stub(Categoria, 'findAll', async () => [{ codCategoria: 1, nome: 'Saúde' }])
  const r = await request('/api/licitacoes/filtros/opcoes')
  assert.equal(r.status, 200)
  assert.equal(r.body.ramos[0].nome, 'Saúde')
  assert.ok(r.body.enquadramentos.some(s => s.codigo === 'GRANDE_VULTO'))
})

test('detalhe da oportunidade: 400 para id inválido e 404 quando não existe', async () => {
  stub(Oportunidade, 'findByPk', async () => null)
  assert.equal((await request('/api/oportunidades/abc')).status, 400)
  assert.equal((await request('/api/oportunidades/99')).status, 404)
})

test('sincronizar é restrito a administradores', async () => {
  assert.equal((await request('/api/oportunidades/sincronizar', { method: 'POST' })).status, 401)
  const cliente = await request('/api/oportunidades/sincronizar', { method: 'POST', headers: { authorization: `Bearer ${token('CLIENTE')}` } })
  assert.equal(cliente.status, 403)

  stub(sincronizacao, 'sincronizar', async () => ({ recebidas: 0, criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 }))
  const admin = await request('/api/oportunidades/sincronizar', { method: 'POST', headers: { authorization: `Bearer ${token('ADMIN')}` } })
  assert.equal(admin.status, 200)
})

test('sincronizar responde 502 amigável quando a API de licitações cai', async () => {
  stub(sincronizacao, 'sincronizar', async () => { const e = new Error('x'); e.codigo = 'API_INDISPONIVEL'; throw e })
  const r = await request('/api/oportunidades/sincronizar', { method: 'POST', headers: { authorization: `Bearer ${token('ADMIN')}` } })
  assert.equal(r.status, 502)
})

test('catálogo de categorias lista apenas tipo SERVICO por padrão; ?tipo=RAMO lista ramos', async () => {
  const consultas = []
  stub(Categoria, 'findAll', async (a) => { consultas.push(a.where.tipo); return [] })
  await request('/categorias')
  await request('/categorias?tipo=RAMO')
  assert.deepEqual(consultas, ['SERVICO', 'RAMO'])
})

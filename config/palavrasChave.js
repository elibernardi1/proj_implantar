// =====================================================================
// PALAVRAS-CHAVE PARA CLASSIFICAÇÃO POR RAMO
// ---------------------------------------------------------------------
// Escreva tudo em minúsculas e SEM acento (o texto do objeto é
// normalizado antes da comparação). Termos com até 3 letras (ex: "ti")
// só casam como palavra inteira; os demais casam no início da palavra
// (assim "medicamento" também encontra "medicamentos").
// A ORDEM da lista desempata ramos com a mesma pontuação.
// =====================================================================

const RAMOS = [
    {
        nome: 'Obras e Engenharia',
        descricao: 'Obras, reformas, pavimentação e serviços de engenharia',
        palavras: ['obra', 'reforma', 'construcao', 'pavimentacao', 'asfalto', 'cimento', 'engenharia',
            'drenagem', 'terraplenagem', 'edificacao', 'ampliacao', 'paisagismo', 'saneamento',
            'calcamento', 'recapeamento', 'alvenaria', 'concreto', 'projeto executivo', 'bueiro']
    },
    {
        nome: 'Saúde',
        descricao: 'Medicamentos, insumos hospitalares e serviços de saúde',
        palavras: ['medicamento', 'hospital', 'enfermagem', 'medico', 'saude', 'odontolog', 'laboratorio',
            'farmac', 'cirurg', 'vacina', 'ambulatorio', 'clinic', 'insumo hospitalar', 'material hospitalar',
            'exame', 'fisioterapia', 'ubs', 'sus']
    },
    {
        nome: 'Tecnologia da Informação',
        descricao: 'Equipamentos, software, sistemas e serviços de TI',
        palavras: ['computador', 'software', 'sistema', 'servidor', 'notebook', 'ti', 'informatica',
            'impressora', 'toner', 'rede de dados', 'internet', 'licenca de uso', 'nuvem', 'tablet',
            'monitor', 'switch', 'cabeamento estruturado', 'hospedagem', 'site']
    },
    {
        nome: 'Alimentação',
        descricao: 'Gêneros alimentícios, merenda e refeições',
        palavras: ['alimento', 'alimenticio', 'merenda', 'refeicao', 'genero alimenticio', 'hortifruti',
            'carne', 'pao', 'leite', 'cesta basica', 'marmita', 'lanche', 'coffee break', 'buffet',
            'bebida', 'agua mineral']
    },
    {
        nome: 'Limpeza e Conservação',
        descricao: 'Material de limpeza, conservação e higienização',
        palavras: ['limpeza', 'conservacao', 'higieniz', 'desinfec', 'detergente', 'vassoura', 'sanitari',
            'zeladoria', 'jardinagem', 'dedetizacao', 'coleta de lixo', 'residuos', 'copa e cozinha']
    },
    {
        nome: 'Veículos e Combustíveis',
        descricao: 'Veículos, peças, manutenção e combustíveis',
        palavras: ['combustivel', 'gasolina', 'diesel', 'veiculo', 'etanol', 'oleo lubrificante', 'pneu',
            'caminhao', 'onibus', 'automovel', 'automotiv', 'ambulancia', 'frota', 'abastecimento',
            'lubrificante', 'retroescavadeira', 'trator']
    },
    {
        nome: 'Educação',
        descricao: 'Material escolar, transporte escolar e serviços educacionais',
        palavras: ['escolar', 'educacao', 'didatico', 'escola', 'creche', 'pedagogic', 'ensino',
            'material de ensino', 'livro', 'uniforme', 'transporte escolar', 'curso', 'capacitacao']
    },
    {
        nome: 'Segurança',
        descricao: 'Vigilância, monitoramento e equipamentos de segurança',
        palavras: ['seguranca', 'vigilancia', 'monitoramento', 'cftv', 'camera', 'alarme', 'extintor',
            'portaria', 'guarda', 'epi', 'incendio', 'cerca eletrica', 'controle de acesso']
    }
]

const RAMO_PADRAO = { nome: 'Outros', descricao: 'Objetos que não se encaixam nos demais ramos' }

module.exports = { RAMOS, RAMO_PADRAO }

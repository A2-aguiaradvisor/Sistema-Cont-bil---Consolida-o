migrate(
  (app) => {
    // 1. Coleção de Estrutura do Balanço Patrimonial e DRE (linhas de consolidação)
    const estrutura = new Collection({
      name: 'estrutura_balanco',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'tipo', type: 'select', required: true, values: ['BP', 'DRE'], maxSelect: 1 },
        { name: 'grupo', type: 'text', required: true }, // ex: ATIVO CIRCULANTE, ATIVO NÃO CIRCULANTE, PASSIVO CIRCULANTE, PASSIVO NÃO CIRCULANTE, PATRIMÔNIO LÍQUIDO, RECEITA, CUSTO, DESPESA
        { name: 'linha', type: 'text', required: true }, // ex: Caixa e Equivalentes de Caixa, Clientes, Estoques
        { name: 'cod_nota', type: 'text' }, // ex: 03, 04, 05
        { name: 'nivel', type: 'number' }, // 1 = Totalizador macro, 2 = Grupo, 3 = Linha de conta
        { name: 'ordem', type: 'number' }, // Ordenação para exibição correta
        { name: 'natureza', type: 'select', required: true, values: ['D', 'C'], maxSelect: 1 }, // D (Devedora) ou C (Credora)
        { name: 'is_total', type: 'bool' }, // se é linha de subtotal/total
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_estrutura_tipo_ordem ON estrutura_balanco (tipo, ordem)',
        'CREATE INDEX idx_estrutura_linha ON estrutura_balanco (linha)',
      ],
    })
    app.save(estrutura)

    // 2. Coleção de De-Para (Mapeamento de plano de contas)
    const depara = new Collection({
      name: 'depara',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'conta', type: 'text', required: true }, // ex: 1.1.01.001
        { name: 'descricao', type: 'text', required: true }, // ex: Banco do Brasil C/C
        { name: 'linha_bp', type: 'text' }, // ex: Caixa e Equivalentes de Caixa
        { name: 'grupo_bp', type: 'text' }, // ex: Ativo Circulante
        { name: 'linha_dre', type: 'text' }, // ex: Receita Operacional Líquida, Custo de Vendas
        { name: 'cod_nota', type: 'text' }, // ex: 03
        {
          name: 'tipo_conta',
          type: 'select',
          values: ['ATIVO', 'PASSIVO', 'PL', 'RESULTADO'],
          maxSelect: 1,
        },
        { name: 'observacao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_depara_conta ON depara (conta)',
        'CREATE INDEX idx_depara_linha_bp ON depara (linha_bp)',
        'CREATE INDEX idx_depara_linha_dre ON depara (linha_dre)',
      ],
    })
    app.save(depara)

    // 3. Coleção de Balancetes
    const balancetes = new Collection({
      name: 'balancetes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'empresa', type: 'text', required: true }, // ex: ALFA, BETA, GAMA, CONSOLIDADO
        { name: 'ano', type: 'number', required: true }, // ex: 2025
        { name: 'periodo', type: 'text', required: true }, // ex: "Dez/25", "12/2025"
        { name: 'conta', type: 'text', required: true }, // ex: 1.1.01.001
        { name: 'descricao', type: 'text', required: true },
        { name: 'saldo', type: 'number', required: true }, // valor monetário
        { name: 'natureza', type: 'select', values: ['D', 'C'], maxSelect: 1 },
        { name: 'linha_bp', type: 'text' },
        { name: 'linha_dre', type: 'text' },
        { name: 'cod_nota', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_balancetes_emp_per ON balancetes (empresa, ano, periodo)',
        'CREATE INDEX idx_balancetes_conta ON balancetes (conta)',
      ],
    })
    app.save(balancetes)

    // 4. Coleção de Eliminações de Consolidação
    const eliminacoes = new Collection({
      name: 'eliminacoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ano', type: 'number', required: true },
        { name: 'periodo', type: 'text', required: true }, // ex: "Dez/25"
        { name: 'empresa', type: 'text' }, // empresa envolvida ou grupo
        {
          name: 'tipo_quadro',
          type: 'select',
          required: true,
          values: ['BP', 'DRE'],
          maxSelect: 1,
        },
        { name: 'linha_balanco', type: 'text', required: true }, // vinculada a estrutura ou linha
        { name: 'descricao', type: 'text', required: true }, // Motivo: "Eliminação mútuo intercompany", etc.
        { name: 'debito', type: 'number' }, // se debitou linha
        { name: 'credito', type: 'number' }, // se creditou linha
        { name: 'valor', type: 'number', required: true }, // valor líquido da eliminação aplicado ao grupo (+ ou -)
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_elim_periodo_tipo ON eliminacoes (periodo, tipo_quadro)'],
    })
    app.save(eliminacoes)
  },
  (app) => {
    const eliminacoes = app.findCollectionByNameOrId('eliminacoes')
    if (eliminacoes) app.delete(eliminacoes)
    const balancetes = app.findCollectionByNameOrId('balancetes')
    if (balancetes) app.delete(balancetes)
    const depara = app.findCollectionByNameOrId('depara')
    if (depara) app.delete(depara)
    const estrutura = app.findCollectionByNameOrId('estrutura_balanco')
    if (estrutura) app.delete(estrutura)
  },
)

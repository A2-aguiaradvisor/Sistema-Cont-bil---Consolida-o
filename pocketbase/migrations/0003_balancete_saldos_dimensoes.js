/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração idempotente (no-op em banco vazio):
 * - Garante na coleção `balancetes` as 4 colunas de saldo exigidas pela regra permanente:
 *   saldo_inicial, debitos, creditos, saldo_final (nunca apenas o saldo final).
 * - Adiciona dimensões opcionais (moeda, centro_custo, segmento), vazias quando não informadas.
 * - Mantém empresa, conta, descricao, ano, periodo já existentes.
 * - Cria campo `lote` (rastreabilidade da importação) e índice único de reimportação.
 * Não insere nenhum dado de usuário: os dados entram somente pela tela de importação.
 */
migrate(
  (app) => {
    let col
    try {
      col = app.findCollectionByNameOrId('balancetes')
    } catch (_) {
      return // banco vazio: nada a fazer
    }

    const existe = (nome) =>
      col.fields.getByName &&
      (() => {
        try {
          col.fields.getByName(nome)
          return true
        } catch (_) {
          return false
        }
      })()
    const add = (field) => {
      try {
        col.fields.add(field)
      } catch (_) {
        return // campo já existe
      }
    }

    if (!existe('saldo_inicial')) add(new NumberField({ name: 'saldo_inicial' }))
    if (!existe('debitos')) add(new NumberField({ name: 'debitos' }))
    if (!existe('creditos')) add(new NumberField({ name: 'creditos' }))
    if (!existe('saldo_final')) add(new NumberField({ name: 'saldo_final' }))
    if (!existe('moeda')) add(new TextField({ name: 'moeda' }))
    if (!existe('centro_custo')) add(new TextField({ name: 'centro_custo' }))
    if (!existe('segmento')) add(new TextField({ name: 'segmento' }))
    if (!existe('lote')) add(new TextField({ name: 'lote' }))

    // Backfill idempotente para registros antigos que só tinham `saldo`:
    // saldo_inicial = 0, debitos = saldo (quando natureza D) ou 0, creditos = saldo (quando C) ou 0,
    // saldo_final = saldo. Nenhum valor de usuário é criado aqui — apenas reorganiza o que já existe.
    const records = app.findRecordsByFilter(
      'balancetes',
      'saldo_inicial = "" || saldo_inicial = 0',
      '',
      0,
      0,
    )
    for (const r of records) {
      const saldo = r.getNumber('saldo') || 0
      if (r.getNumber('saldo_inicial') === 0) r.set('saldo_inicial', 0)
      if (r.getNumber('debitos') === 0 && r.getString('natureza') === 'D') r.set('debitos', saldo)
      if (r.getNumber('creditos') === 0 && r.getString('natureza') === 'C') r.set('creditos', saldo)
      if (r.getNumber('saldo_final') === 0) r.set('saldo_final', saldo)
      app.save(r)
    }

    try {
      col.addIndex(
        'CREATE UNIQUE INDEX idx_balancetes_emp_per_conta ON balancetes (empresa, periodo, conta)',
      )
    } catch (_) {
      /* índice já existe */
    }
    app.save(col)
  },
  (app) => {
    // Reversão: remove apenas o que esta migração adicionou
    let col
    try {
      col = app.findCollectionByNameOrId('balancetes')
    } catch (_) {
      return
    }
    for (const nome of [
      'saldo_inicial',
      'debitos',
      'creditos',
      'saldo_final',
      'moeda',
      'centro_custo',
      'segmento',
      'lote',
    ]) {
      try {
        const f = col.fields.getByName(nome)
        col.fields.remove(f)
      } catch (_) {
        /* não existe */
      }
    }
    try {
      col.removeIndex('idx_balancetes_emp_per_conta')
    } catch (_) {}
    app.save(col)
  },
)

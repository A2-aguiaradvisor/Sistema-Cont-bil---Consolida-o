/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração idempotente (no-op em banco vazio):
 * - Garante na coleção `balancetes` as 4 colunas de saldo exigidas pela regra permanente:
 *   saldo_inicial, debitos, creditos, saldo_final (nunca apenas o saldo final).
 * - Adiciona dimensões opcionais (moeda, centro_custo, segmento) e o campo `lote`
 *   (rastreabilidade da importação), vazios quando não informadas.
 * - Salva a coleção ANTES de qualquer filtro que referencie os campos novos.
 * - Backfill idempotente dos registros antigos que só tinham `saldo`.
 * - Cria o índice único de reimportação (empresa, periodo, conta) por último.
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

    // getByName retorna null quando o campo não existe (e pode lançar em outras versões):
    // cobrir os dois comportamentos com truthiness + try/catch.
    const tem = (nome) => {
      try {
        return !!col.fields.getByName(nome)
      } catch (_) {
        return false
      }
    }

    // 1. Adiciona os campos novos (guarda: pula quem já existe — idempotente).
    if (!tem('saldo_inicial')) col.fields.add(new NumberField({ name: 'saldo_inicial' }))
    if (!tem('debitos')) col.fields.add(new NumberField({ name: 'debitos' }))
    if (!tem('creditos')) col.fields.add(new NumberField({ name: 'creditos' }))
    if (!tem('saldo_final')) col.fields.add(new NumberField({ name: 'saldo_final' }))
    if (!tem('moeda')) col.fields.add(new TextField({ name: 'moeda' }))
    if (!tem('centro_custo')) col.fields.add(new TextField({ name: 'centro_custo' }))
    if (!tem('segmento')) col.fields.add(new TextField({ name: 'segmento' }))
    if (!tem('lote')) col.fields.add(new TextField({ name: 'lote' }))

    // 2. SALVA A COLEÇÃO PRIMEIRO — os campos só passam a existir no banco aqui.
    //    Qualquer filtro/index que referencie os campos novos vem DEPOIS deste save.
    app.save(col)

    // 3. Backfill idempotente para registros antigos que só tinham `saldo`:
    //    saldo_inicial = 0, debitos = saldo (natureza D), creditos = saldo (natureza C),
    //    saldo_final = saldo. Nenhum valor de usuário é criado — apenas reorganiza o que existe.
    const records = app.findRecordsByFilter('balancetes', 'saldo_final = 0', '', 0, 0)
    for (const r of records) {
      const saldo = r.getFloat('saldo') || 0
      if (r.getFloat('saldo_inicial') === 0) r.set('saldo_inicial', 0)
      if (r.getFloat('debitos') === 0 && r.getString('natureza') === 'D') r.set('debitos', saldo)
      if (r.getFloat('creditos') === 0 && r.getString('natureza') === 'C') r.set('creditos', saldo)
      if (r.getFloat('saldo_final') === 0) r.set('saldo_final', saldo)
      app.save(r)
    }

    // 4. Índice único de reimportação — após salvar os campos e deduplicar,
    //    para não falhar com UNIQUE constraint em cópias com dados antigos.
    try {
      app
        .db()
        .newQuery(
          'DELETE FROM balancetes WHERE id NOT IN (SELECT MIN(id) FROM balancetes GROUP BY empresa, periodo, conta)',
        )
        .execute()
    } catch (_) {
      /* tabela vazia ou já deduplicada */
    }
    try {
      col.addIndex('idx_balancetes_emp_per_conta', true, 'empresa, periodo, conta', '')
      app.save(col)
    } catch (_) {
      /* índice já existe */
    }
  },
  (app) => {
    // Reversão: remove apenas o que esta migração adicionou
    let col
    try {
      col = app.findCollectionByNameOrId('balancetes')
    } catch (_) {
      return
    }
    try {
      col.removeIndex('idx_balancetes_emp_per_conta')
      app.save(col)
    } catch (_) {}
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
        if (f) col.fields.remove(f)
      } catch (_) {
        /* não existe */
      }
    }
    app.save(col)
  },
)

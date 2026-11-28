// 0005 — Carga dos dados reais do Modelo Financeiro Grupo ABC (autorizada pelo usuário).
//
// Fonte: CSVs anexados pelo usuário (De-Para com 562 registros e Balancete com ~24,6 mil linhas).
// A migração BAIXA os arquivos das URLs originais no momento da execução ($http.send) e grava
// no banco exatamente o que os arquivos contêm — nenhum valor é inventado, arredondado ou embutido.
//
// Regras:
// - IDEMPOTENTE: execução repetida apaga apenas os registros gerados por esta migração
//   (balancetes com lote = 'SEED-ABC-0005' e os leftovers de seed sem lote) e refaz o upsert,
//   sem tocar em dados de outras origens (importações do usuário, lote IMP-...).
// - De-Para: upsert pela conta (índice único idx_depara_conta).
// - Balancete: grava as 4 colunas de saldo (saldo_inicial, debitos, creditos, saldo_final),
//   o período no MESMO formato que a tela Balancete filtra ("Dez/25") e faz upsert por
//   (empresa, periodo, conta) — índice único idx_balancetes_emp_per_conta; reimportar o mesmo
//   período substitui, nunca duplica.
// - Registros legados de seed (lote vazio, criados pela migração 0002) são removidos do balancete
//   para que a ferramenta reflita somente os dados reais; importaçōes do usuário (lote IMP-...)
//   são preservadas. O usuário auth não é tocado.

var LOTE = 'SEED-ABC-0005'
var URL_DEPARA =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/1a7168f1-da38-41b7-afb4-96471c0e0400/de-para-8760f.csv'
var URL_BALANCETE =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/1a7168f1-da38-41b7-afb4-96471c0e0400/balancete-8d6fe.csv'

var MESES = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
}
var ABREVIACOES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function normalizarTexto(t) {
  return String(t || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
}

function splitCsvLine(line, sep) {
  var cols = []
  var cur = ''
  var inQuotes = false
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i)
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === sep && !inQuotes) {
      cols.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur)
  for (var j = 0; j < cols.length; j++) cols[j] = cols[j].trim()
  return cols
}

/** "5.756,17" → 5756.17 ; "-1.234,56" → -1234.56 ; "" → 0 */
function parseValorBr(raw) {
  var t = String(raw || '')
    .trim()
    .replace(/[R$\s]/g, '')
  if (!t) return 0
  var v
  if (t.indexOf(',') >= 0) v = parseFloat(t.replace(/\./g, '').replace(',', '.'))
  else v = parseFloat(t)
  return isNaN(v) ? 0 : v
}

// Latim-1 → UTF-8: o CSV vem em ISO-8859-1 ("Descri��o"); String.fromCharCode
// degrada acentos para mojibake, então refazemos a decodificação byte a byte
// e depois normalizamos para a comparação de cabeçalhos.
function latin1ParaUtf8(raw) {
  var s = String(raw || '')
  var out = ''
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i)
    if (c >= 0xc2 && c <= 0xf4 && i + 1 < s.length) {
      // byte alto + continuação: junta dois bytes (UTF-8 decodificado como latin-1)
      out += String.fromCharCode(((c & 0x1f) << 6) | (s.charCodeAt(i + 1) & 0x3f))
      i++
    } else if (c < 0x80) {
      out += s.charAt(i)
    } else {
      out += '\uFFFD'
    }
  }
  return out
}

function normalizarHeader(h) {
  var s = String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return s.replace(/[^a-z0-9]/g, '')
}

/** Encontra o índice da coluna cujo cabeçalho casar (exato ou por prefixo) com algum alias. */
function findCol(headers, aliases) {
  var norm = []
  for (var i = 0; i < headers.length; i++) norm.push(normalizarHeader(headers[i]))
  for (var a = 0; a < aliases.length; a++) {
    var al = normalizarHeader(aliases[a])
    for (var k = 0; k < norm.length; k++) {
      if (!norm[k]) continue
      if (norm[k] === al || norm[k].indexOf(al) === 0) return k
    }
  }
  return -1
}

function upper(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
}

/** Converte a competência do CSV ("2024-08", "08/2024", "Dez/2024", "2024")
 *  para o formato que a tela Balancete exibe e filtra: "Dez/25". */
function parsePeriodo(raw) {
  var t = String(raw || '').trim()
  var m = t.match(/^(\d{4})[-\/](\d{1,2})$/)
  if (m) return { ano: +m[1], mes: +m[2] }
  m = t.match(/^(\d{1,2})[-\/](\d{4})$/)
  if (m) return { ano: +m[2], mes: +m[1] }
  m = t.match(/^([A-Za-zÀ-ú]{3,})[-\/\s]?(\d{2,4})$/)
  if (m) {
    var chave = m[1].toLowerCase().slice(0, 3)
    var mes = MESES[chave]
    if (mes) {
      var anoFull = m[2].length === 2 ? 2000 + +m[2] : +m[2]
      return { ano: anoFull, mes: mes }
    }
  }
  m = t.match(/^(\d{4})$/)
  if (m) return { ano: +m[1], mes: 12 }
  return { ano: NaN, mes: NaN }
}

migrate(
  (app) => {
    var balCol = app.findCollectionByNameOrId('balancetes')
    var depCol = app.findCollectionByNameOrId('depara')

    // ---- 0. Limpeza idempotente -------------------------------------------
    // Balancete: remove apenas o que esta migração criou antes e os leftovers de
    // seed sem lote (0002). Importações do usuário (lote IMP-...) permanecem.
    var antigos = app.findRecordsByFilter(
      balCol,
      "lote = '' || lote = '" + LOTE + "'",
      '',
      1000000,
      0,
    )
    for (var d = 0; d < antigos.length; d++) app.delete(antigos[d])

    // ---- 1. De-Para (upsert pela conta) -----------------------------------
    var resDep = $http.send({
      url: URL_DEPARA,
      method: 'GET',
      headers: { Accept: 'text/csv, text/plain, */*' },
    })
    if (resDep.statusCode >= 400) {
      throw new Error('Falha ao baixar o De-Para (HTTP ' + resDep.statusCode + ')')
    }
    var textoDep = latin1ParaUtf8(resDep.raw || '')
    if (textoDep.trim().length === 0) {
      throw new Error('Corpo vazio ao baixar o CSV do De-Para (raw e body vazios)')
    }
    var linhasDep = normalizarTexto(textoDep)
      .split('\n')
      .filter(function (l) {
        return l.trim().length > 0
      })
    if (linhasDep.length < 2) throw new Error('CSV do De-Para veio sem registros: ' + URL_DEPARA)

    var sepDep = linhasDep[0].indexOf(';') >= 0 ? ';' : ','
    var headersDep = splitCsvLine(linhasDep[0], sepDep)
    var ixContaDep = findCol(headersDep, ['conta'])
    var ixDescDep = findCol(headersDep, ['descricao'])
    var ixBpDep = findCol(headersDep, ['linhabp', 'linhadr'])
    var ixDreDep = findCol(headersDep, ['linhadr'])
    var ixGrupoDep = findCol(headersDep, ['grupobp'])
    var ixNotaDep = findCol(headersDep, ['codnota'])
    if (ixContaDep < 0 || ixDescDep < 0) {
      var depNorm = []
      for (var hh = 0; hh < headersDep.length; hh++) depNorm.push(normalizarHeader(headersDep[hh]))
      throw new Error(
        'Cabeçalho do De-Para sem as colunas Conta/Descrição — normalizados: ' +
          JSON.stringify(depNorm),
      )
    }

    // Mapa das contas existentes (562 no CSV + seeds antigos → carregável em memória)
    var depExistentes = app.findRecordsByFilter(depCol, '', 'conta', 100000, 0)
    var depPorConta = {}
    for (var e = 0; e < depExistentes.length; e++) {
      depPorConta[upper(depExistentes[e].getString('conta'))] = depExistentes[e]
    }

    var totalDep = 0
    for (var i = 1; i < linhasDep.length; i++) {
      var cols = splitCsvLine(linhasDep[i], sepDep)
      var conta = upper(cols[ixContaDep])
      if (!conta) continue
      var descricao = (cols[ixDescDep] || '').trim()
      var linhaBp = ixBpDep >= 0 ? (cols[ixBpDep] || '').trim() : ''
      var linhaDre = ixDreDep >= 0 ? (cols[ixDreDep] || '').trim() : ''
      var grupoBp = ixGrupoDep >= 0 ? (cols[ixGrupoDep] || '').trim() : ''
      var codNota = ixNotaDep >= 0 ? (cols[ixNotaDep] || '').trim() : ''

      var gNorm = normalizarHeader(grupoBp)
      var tipoConta = ''
      if (gNorm.indexOf('ativo') === 0) tipoConta = 'ATIVO'
      else if (gNorm.indexOf('passivo') === 0) tipoConta = 'PASSIVO'
      else if (gNorm.indexOf('patrimonio') === 0 || gNorm === 'pl') tipoConta = 'PL'
      else if (linhaDre) tipoConta = 'RESULTADO'

      var recDep = depPorConta[conta]
      if (recDep) {
        recDep.set('descricao', descricao)
        recDep.set('linha_bp', linhaBp)
        recDep.set('linha_dre', linhaDre)
        recDep.set('grupo_bp', grupoBp)
        recDep.set('cod_nota', codNota)
        if (tipoConta) recDep.set('tipo_conta', tipoConta)
        app.save(recDep)
      } else {
        var novoDep = new Record(depCol)
        novoDep.set('conta', conta)
        novoDep.set('descricao', descricao)
        novoDep.set('linha_bp', linhaBp)
        novoDep.set('linha_dre', linhaDre)
        novoDep.set('grupo_bp', grupoBp)
        novoDep.set('cod_nota', codNota)
        if (tipoConta) novoDep.set('tipo_conta', tipoConta)
        novoDep.set('observacao', '')
        app.save(novoDep)
        depPorConta[conta] = novoDep
      }
      totalDep++
    }

    // ---- 2. Balancete (4 saldos + upsert por empresa+periodo+conta) --------
    var resBal = $http.send({
      url: URL_BALANCETE,
      method: 'GET',
      headers: { Accept: 'text/csv, text/plain, */*' },
    })
    if (resBal.statusCode >= 400) {
      throw new Error('Falha ao baixar o Balancete (HTTP ' + resBal.statusCode + ')')
    }
    var textoBal = latin1ParaUtf8(resBal.raw || '')
    if (textoBal.trim().length === 0) {
      throw new Error('Corpo vazio ao baixar o CSV do Balancete (raw e body vazios)')
    }
    var linhasBal = normalizarTexto(textoBal)
      .split('\n')
      .filter(function (l) {
        return l.trim().length > 0
      })
    if (linhasBal.length < 2)
      throw new Error('CSV do Balancete veio sem registros: ' + URL_BALANCETE)

    var sepBal = linhasBal[0].indexOf(';') >= 0 ? ';' : ','
    var headersBal = splitCsvLine(linhasBal[0], sepBal)
    var ixEmp = findCol(headersBal, ['empresa'])
    var ixContaBal = findCol(headersBal, ['conta'])
    var ixDescBal = findCol(headersBal, ['descricao'])
    var ixAno = findCol(headersBal, ['ano', 'exercicio'])
    var ixPer = findCol(headersBal, ['periodo', 'competencia', 'mes'])
    var ixSalIni = findCol(headersBal, ['saldo inicial', 'saldo anterior', 'saldoinicial'])
    var ixDeb = findCol(headersBal, ['debitos', 'debito'])
    var ixCred = findCol(headersBal, ['creditos', 'credito'])
    var ixSalFim = findCol(headersBal, ['saldo final', 'saldo atual', 'saldofinal'])
    if (ixContaBal < 0 || ixSalFim < 0) {
      throw new Error('Cabeçalho do Balancete sem as colunas Conta/Saldo Final: ' + linhasBal[0])
    }

    // Restantes no banco = somente importaçōes do usuário (lotes IMP-...).
    var restantes = app.findRecordsByFilter(balCol, "lote != ''", '', 100000, 0)
    var balPorChave = {}
    for (var r = 0; r < restantes.length; r++) {
      var rec = restantes[r]
      var chave =
        upper(rec.getString('empresa')) +
        '|' +
        rec.getString('periodo') +
        '|' +
        upper(rec.getString('conta'))
      balPorChave[chave] = rec
    }

    var totalBal = 0
    for (var b = 1; b < linhasBal.length; b++) {
      var cb = splitCsvLine(linhasBal[b], sepBal)

      var empresa = ixEmp >= 0 ? upper(cb[ixEmp]) : ''
      var contaB = upper(cb[ixContaBal])
      var descricaoB = ixDescBal >= 0 ? (cb[ixDescBal] || '').trim() : ''
      if (!contaB) continue

      var textoPeriodo = ixPer >= 0 ? (cb[ixPer] || '').trim() : ''
      var parsed = parsePeriodo(textoPeriodo)
      var mes = parsed.mes
      var ano = NaN
      if (ixAno >= 0) ano = parseInt((cb[ixAno] || '').trim(), 10)
      if (isNaN(ano)) ano = parsed.ano
      if (isNaN(ano) || isNaN(mes)) continue // linha sem competência válida não é gravada
      var periodo = ABREVIACOES[mes - 1] + '/' + String(ano % 100).padStart(2, '0')

      var saldoInicial = ixSalIni >= 0 ? parseValorBr(cb[ixSalIni]) : 0
      var debitos = ixDeb >= 0 ? parseValorBr(cb[ixDeb]) : 0
      var creditos = ixCred >= 0 ? parseValorBr(cb[ixCred]) : 0
      var saldoFinal = parseValorBr(cb[ixSalFim])

      // Natureza inferida pelo sinal/prefixo da conta (o CSV não traz a coluna)
      var natureza = 'D'
      if (saldoFinal < 0) natureza = 'C'
      else if (contaB.charAt(0) === '2') natureza = 'C'

      // Dimensões vindas do De-Para (mesma junção feita pelo importador da UI)
      var depInfo = depPorConta[contaB]
      var linhaBpB = depInfo ? String(depInfo.getString('linha_bp') || '') : ''
      var linhaDreB = depInfo ? String(depInfo.getString('linha_dre') || '') : ''
      var codNotaB = depInfo ? String(depInfo.getString('cod_nota') || '') : ''

      var chaveB = empresa + '|' + periodo + '|' + contaB
      var alvo = balPorChave[chaveB]
      if (alvo) {
        // Substitui (reimportação do mesmo período, nunca duplica)
        alvo.set('ano', ano)
        alvo.set('descricao', descricaoB)
        alvo.set('saldo', saldoFinal)
        alvo.set('saldo_inicial', saldoInicial)
        alvo.set('debitos', debitos)
        alvo.set('creditos', creditos)
        alvo.set('saldo_final', saldoFinal)
        alvo.set('natureza', natureza)
        if (linhaBpB) alvo.set('linha_bp', linhaBpB)
        if (linhaDreB) alvo.set('linha_dre', linhaDreB)
        if (codNotaB) alvo.set('cod_nota', codNotaB)
        alvo.set('moeda', 'BRL')
        alvo.set('lote', LOTE)
        app.save(alvo)
      } else {
        var novoBal = new Record(balCol)
        novoBal.set('empresa', empresa)
        novoBal.set('ano', ano)
        novoBal.set('periodo', periodo)
        novoBal.set('conta', contaB)
        novoBal.set('descricao', descricaoB)
        novoBal.set('saldo', saldoFinal)
        novoBal.set('saldo_inicial', saldoInicial)
        novoBal.set('debitos', debitos)
        novoBal.set('creditos', creditos)
        novoBal.set('saldo_final', saldoFinal)
        novoBal.set('natureza', natureza)
        novoBal.set('linha_bp', linhaBpB)
        novoBal.set('linha_dre', linhaDreB)
        novoBal.set('cod_nota', codNotaB)
        novoBal.set('moeda', 'BRL')
        novoBal.set('centro_custo', '')
        novoBal.set('segmento', '')
        novoBal.set('lote', LOTE)
        app.save(novoBal)
        balPorChave[chaveB] = novoBal
      }
      totalBal++
    }

    if (totalDep < 500 || totalBal < 20000) {
      throw new Error(
        'Carga ABC incompleta: de_para=' +
          totalDep +
          ' (esperado ~562), balancete=' +
          totalBal +
          ' (esperado ~24.6 mil) — nada foi persistido',
      )
    }

    console.log(
      '[0005] Seed ABC concluído: de_para=' +
        totalDep +
        ' registros, balancetes=' +
        totalBal +
        ' registros',
    )
  },
  (app) => {
    // down: remove apenas os registros gerados por esta migração
    var balCol = app.findCollectionByNameOrId('balancetes')
    var gerados = app.findRecordsByFilter(balCol, "lote = '" + LOTE + "'", '', 1000000, 0)
    for (var i = 0; i < gerados.length; i++) app.delete(gerados[i])
  },
)

// Parser de arquivos de importação (CSV exportado do Excel, separador ";" e números pt-BR).
// Toda validação aponta LINHA e COLUNA exatas do problema.
// Regra permanente: o balancete grava as 4 colunas de saldo — saldo_inicial, debitos, creditos, saldo_final.

import { deparaService } from '@/services/accounting'
import type { DeParaRecord } from '@/types/accounting'

export const CONTA_AJUSTE = '29999999'
export const CONTA_AJUSTE_ROTULO = 'AJUSTE - RESULTADO JÁ APROPRIADO NO PL'

export const CAMPOS_IMPORTACAO = [
  { key: 'empresa', label: 'Empresa', obrigatorio: false },
  { key: 'ano', label: 'Ano', obrigatorio: false },
  { key: 'periodo', label: 'Período', obrigatorio: false },
  { key: 'conta', label: 'Conta', obrigatorio: true },
  { key: 'descricao', label: 'Descrição', obrigatorio: true },
  { key: 'saldo_inicial', label: 'Saldo Inicial', obrigatorio: false },
  { key: 'debitos', label: 'Débitos', obrigatorio: false },
  { key: 'creditos', label: 'Créditos', obrigatorio: false },
  { key: 'saldo_final', label: 'Saldo Final', obrigatorio: true },
  { key: 'natureza', label: 'Natureza (D/C)', obrigatorio: false },
  { key: 'moeda', label: 'Moeda', obrigatorio: false },
  { key: 'centro_custo', label: 'Centro de Custo', obrigatorio: false },
  { key: 'segmento', label: 'Unidade de Negócio / Segmento', obrigatorio: false },
  { key: 'linha_bp', label: 'Linha do Balanço (BP)', obrigatorio: false },
  { key: 'linha_dre', label: 'Linha da DRE', obrigatorio: false },
  { key: 'cod_nota', label: 'Código da Nota', obrigatorio: false },
] as const

export type CampoKey = (typeof CAMPOS_IMPORTACAO)[number]['key']

export type ColumnMap = Record<CampoKey, number> // índice da coluna; -1 = não usar

export interface ParseError {
  linha: number // nº da linha no arquivo (1-based, cabeçalho = 1)
  coluna: string // rótulo legível da coluna/campo
  msg: string
}

export interface ParsedRow {
  linhaArquivo: number
  empresa: string
  ano: number
  periodo: string
  conta: string
  descricao: string
  saldo_inicial: number
  debitos: number
  creditos: number
  saldo_final: number
  natureza: 'D' | 'C'
  moeda: string
  centro_custo: string
  segmento: string
  linha_bp: string
  linha_dre: string
  cod_nota: string
  alertas: ParseError[] // divergência de quadratura (alerta, não bloqueia)
  erros: ParseError[] // bloqueiam a linha
  isValid: boolean
}

export interface ParseDefaults {
  empresa: string
  periodo: string
  ano: string
}

export interface ParseResult {
  rows: ParsedRow[]
  fatalError: string | null
}

/** Remove BOM e normaliza quebras de linha Windows/Mac. */
export function normalizarTexto(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function detectSeparator(firstLine: string): string {
  if (firstLine.includes(';')) return ';'
  if (firstLine.includes('\t')) return '\t'
  return ';'
}

/** Split de uma linha respeitando aspas duplas (célula pode conter o separador). */
export function splitCsvLine(line: string, sep: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
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
  return cols.map((c) => c.trim())
}

/** Normaliza um cabeçalho para comparação: minúsculas, sem acentos, pontos ou underlines. */
export function normalizarHeader(h: string): string {
  return (h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitHeaders(firstLine: string, sep: string): string[] {
  return splitCsvLine(normalizarTexto(firstLine), sep).map(normalizarHeader)
}

function findCol(headers: string[], ...terms: string[]): number {
  const norm = headers.map(normalizarHeader)
  const semEspaco = (s: string) => s.replace(/\s/g, '')
  return norm.findIndex((h) =>
    terms.some((t) => {
      const tn = normalizarHeader(t)
      return (
        h === tn ||
        h.startsWith(tn) ||
        semEspaco(h) === semEspaco(tn) ||
        h.replace(/s$/, '') === tn.replace(/s$/, '')
      )
    }),
  )
}

/** Detecção automática de colunas a partir dos cabeçalhos (tolerante a variações do Excel). */
export function autoDetectColMap(headers: string[]): ColumnMap {
  const find = (...terms: string[]) => findCol(headers, ...terms)
  const map: ColumnMap = {
    empresa: find('empresa', 'empresa '),
    ano: find('ano', 'exercicio'),
    periodo: find('periodo', 'competencia', 'mes'),
    conta: find('conta', 'codigo conta'),
    descricao: find('descricao', 'historico', 'nome'),
    saldo_inicial: find('saldo anterior', 'saldo inicial'),
    debitos: find('debito'),
    creditos: find('credito'),
    saldo_final: find('saldo final', 'saldo atual'),
    natureza: find('natureza', 'nat'),
    moeda: find('moeda'),
    centro_custo: find('centro de custo', 'centro custo'),
    segmento: find('segmento', 'unidade'),
    linha_bp: find('linhabp', 'linha bp', 'linhabalance'),
    linha_dre: find('linhadre', 'linha dre'),
    cod_nota: find('cod nota', 'codnota', 'nota'),
  }
  if (map.periodo < 0) map.periodo = find('periodo')
  return map
}

/** Converte texto de valor pt-BR ("5.756,17", "1.234.567,89" ou "1234.56") em número. */
export function parseValorBr(raw: string): number {
  const t = (raw ?? '').trim().replace(/[R$\s]/g, '')
  if (!t) return NaN
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.'))
  return parseFloat(t)
}

/**
 * Aceita "2024-08", "2024/08", "08/2024", "Ago/24", "Ago-2024" e devolve { ano, periodo }.
 * Período canônico no banco = "2024-08".
 */
const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  marco: 3,
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

export function parsePeriodo(raw: string): { ano: number; periodo: string } {
  const t = (raw ?? '').trim()
  let m = t.match(/^(\d{4})[-/](\d{1,2})$/) // 2024-08
  if (m) return { ano: +m[1], periodo: `${m[1]}-${String(+m[2]).padStart(2, '0')}` }
  m = t.match(/^(\d{1,2})[-/](\d{4})$/) // 08/2024
  if (m) return { ano: +m[2], periodo: `${m[2]}-${String(+m[1]).padStart(2, '0')}` }
  m = t.match(/^([a-zà-ú]{3,12})[-/\s]?(\d{2,4})$/i) // Ago/24, Dezembro-2024
  if (m) {
    const key = m[1].toLowerCase().slice(0, 3).replace('mar', 'mar')
    const mes =
      MESES[key] ?? MESES[m[1].toLowerCase().replace(/ç|ã/g, (c) => (c === 'ç' ? 'c' : 'a'))]
    if (mes) {
      const anoFull = m[2].length === 2 ? 2000 + +m[2] : +m[2]
      return { ano: anoFull, periodo: `${anoFull}-${String(mes).padStart(2, '0')}` }
    }
  }
  m = t.match(/^(\d{4})$/) // apenas o ano
  if (m) return { ano: +m[1], periodo: `${m[1]}-12` }
  return { ano: NaN, periodo: t }
}

export async function loadDeparaMap(): Promise<Map<string, DeParaRecord>> {
  const list = await deparaService.listAll()
  return new Map(list.map((d) => [d.conta?.trim() ?? '', d] as [string, DeParaRecord]))
}

/**
 * Lê o arquivo inteiro e devolve as linhas validadas.
 * Cada erro/alerta carrega a linha e a coluna exatas.
 */
export function parseRows(
  text: string,
  colMap: ColumnMap,
  defaults: ParseDefaults,
  deparaMap: Map<string, DeParaRecord>,
): ParseResult {
  const lines = normalizarTexto(text)
    .split('\n')
    .filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return {
      rows: [],
      fatalError:
        'O arquivo está vazio ou contém apenas a linha de cabeçalho. Inclua ao menos uma linha de dados.',
    }
  }

  const sep = detectSeparator(lines[0])
  const headers = splitHeaders(lines[0], sep)
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep)
    const erros: ParseError[] = []
    const alertas: ParseError[] = []
    const numLinha = i + 1

    const cell = (campo: CampoKey): string => {
      const idx = colMap[campo]
      return idx >= 0 ? (cols[idx] ?? '').trim() : ''
    }

    // Empresa / ano / período
    const empresa = (cell('empresa') || defaults.empresa).toUpperCase()
    const textoPeriodo = cell('periodo') || defaults.periodo
    const { ano: anoDoPeriodo, periodo } = parsePeriodo(textoPeriodo)
    let ano = anoDoPeriodo
    const textoAno = cell('ano')
    if (isNaN(ano) && textoAno) ano = parseInt(textoAno, 10)
    if (isNaN(ano) && defaults.ano) ano = parseInt(defaults.ano, 10)
    if (!periodo.trim()) {
      erros.push({
        linha: numLinha,
        coluna: 'Período',
        msg: 'período ausente e nenhum padrão definido',
      })
    }
    if (isNaN(ano)) {
      erros.push({
        linha: numLinha,
        coluna: 'Ano',
        msg: `valor "${textoAno || textoPeriodo}" não é um ano válido`,
      })
    }

    // Conta e descrição
    const conta = cell('conta')
    if (!conta) erros.push({ linha: numLinha, coluna: 'Conta', msg: 'número da conta ausente' })
    const descricao = cell('descricao')
    if (!descricao)
      erros.push({ linha: numLinha, coluna: 'Descrição', msg: 'descrição da conta ausente' })

    // Os 4 saldos
    const nums: Record<'saldo_inicial' | 'debitos' | 'creditos' | 'saldo_final', number> = {
      saldo_inicial: NaN,
      debitos: NaN,
      creditos: NaN,
      saldo_final: NaN,
    }
    for (const k of ['saldo_inicial', 'debitos', 'creditos', 'saldo_final'] as const) {
      const txt = cell(k)
      if (!txt) continue
      const v = parseValorBr(txt)
      if (isNaN(v)) {
        erros.push({
          linha: numLinha,
          coluna: CAMPOS_IMPORTACAO.find((c) => c.key === k)!.label,
          msg: `valor "${txt}" não é numérico; use o formato 5.756,17`,
        })
      } else {
        nums[k] = v
      }
    }
    if (isNaN(nums.saldo_final)) {
      // fallback: se só existir coluna "saldo", usa-a como saldo_final (compatibilidade)
      const idxSaldo = headers.findIndex((h) => h === 'saldo' || h === 'saldo atual')
      if (idxSaldo >= 0) {
        const v = parseValorBr(cols[idxSaldo] ?? '')
        if (!isNaN(v)) nums.saldo_final = v
        else
          erros.push({
            linha: numLinha,
            coluna: 'Saldo',
            msg: `valor "${cols[idxSaldo]}" não é numérico`,
          })
      } else {
        erros.push({ linha: numLinha, coluna: 'Saldo Final', msg: 'saldo final ausente' })
      }
    }

    // Natureza — inferida pela conta quando ausente
    let natureza = cell('natureza').toUpperCase() as 'D' | 'C'
    if (natureza !== 'D' && natureza !== 'C') {
      if (nums.saldo_final < 0) natureza = 'C'
      else if (conta.startsWith('1') || conta.startsWith('2.9')) natureza = 'D'
      else if (conta.startsWith('2') || conta.startsWith('3.1')) natureza = 'C'
      else if (conta.startsWith('3')) natureza = 'D'
      else natureza = 'D'
    }

    // Alerta de quadratura: saldo_inicial + debitos - creditos x saldo_final
    const temMovimento = !isNaN(nums.saldo_inicial) && !isNaN(nums.debitos) && !isNaN(nums.creditos)
    if (temMovimento && !isNaN(nums.saldo_final)) {
      const saldoPorMovimento = nums.saldo_inicial + nums.debitos - nums.creditos
      if (Math.abs(saldoPorMovimento - nums.saldo_final) > 0.01) {
        alertas.push({
          linha: numLinha,
          coluna: 'Saldo Final',
          msg: `não fecha: ${nums.saldo_inicial} + ${nums.debitos} − ${nums.creditos} = ${saldoPorMovimento.toFixed(2)}, mas o arquivo informa ${nums.saldo_final.toFixed(2)} (natureza ${natureza})`,
        })
      }
    }

    // Dimensões opcionais
    const moeda = cell('moeda')
    const centro_custo = cell('centro_custo')
    const segmento = cell('segmento')

    // De-Para automático quando a coluna não vier preenchida
    const deparaInfo = deparaMap.get(conta.trim())
    const linha_bp = cell('linha_bp') || deparaInfo?.linha_bp || ''
    const linha_dre = cell('linha_dre') || deparaInfo?.linha_dre || ''
    const cod_nota = cell('cod_nota') || deparaInfo?.cod_nota || ''

    // Conta de ajuste especial não exige mapeamento
    if (!linha_bp && !linha_dre && !conta.startsWith(CONTA_AJUSTE)) {
      erros.push({
        linha: numLinha,
        coluna: 'Mapeamento',
        msg: `nenhuma linha de BP ou DRE para a conta "${conta}"; importe o De-Para ou cadastre no Mapeamento contábil`,
      })
    }

    rows.push({
      linhaArquivo: numLinha,
      empresa,
      ano: isNaN(ano) ? 0 : ano,
      periodo,
      conta,
      descricao,
      saldo_inicial: isNaN(nums.saldo_inicial) ? 0 : nums.saldo_inicial,
      debitos: isNaN(nums.debitos) ? 0 : nums.debitos,
      creditos: isNaN(nums.creditos) ? 0 : nums.creditos,
      saldo_final: isNaN(nums.saldo_final) ? 0 : nums.saldo_final,
      natureza,
      moeda,
      centro_custo,
      segmento,
      linha_bp,
      linha_dre,
      cod_nota,
      alertas,
      erros,
      isValid: erros.length === 0,
    })
  }

  if (rows.length === 0) {
    return { rows: [], fatalError: 'Nenhuma linha de dados foi encontrada no arquivo.' }
  }
  return { rows, fatalError: null }
}

/** Parser do De-Para: conta, descricao, LinhaBP, LinhaDRE, Grupo_BP, Cod_Nota. */
export interface ParsedDeParaRow {
  linhaArquivo: number
  conta: string
  descricao: string
  linha_bp: string
  linha_dre: string
  grupo_bp: string
  cod_nota: string
  erros: ParseError[]
  isValid: boolean
}

export function parseDePara(text: string): { rows: ParsedDeParaRow[]; fatalError: string | null } {
  const lines = normalizarTexto(text)
    .split('\n')
    .filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], fatalError: 'O arquivo do De-Para está vazio ou só tem cabeçalho.' }
  }
  const sep = detectSeparator(lines[0])
  const headers = splitHeaders(lines[0], sep)
  const idxConta = findCol(headers, 'conta', 'codigo conta')
  const idxDesc = findCol(headers, 'descricao', 'historico', 'nome')
  const idxBp = findCol(headers, 'linhabp', 'linha bp', 'linhabalance')
  const idxDre = findCol(headers, 'linhadre', 'linha dre')
  const idxGrupo = findCol(headers, 'grupo bp', 'grupobp', 'grupo bp')
  const idxNota = findCol(headers, 'cod nota', 'codnota', 'nota')

  if (idxConta < 0) {
    return { rows: [], fatalError: 'Coluna "Conta" não encontrada no cabeçalho do arquivo.' }
  }

  const rows: ParsedDeParaRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep)
    const erros: ParseError[] = []
    const numLinha = i + 1
    const conta = (cols[idxConta] ?? '').trim()
    if (!conta) erros.push({ linha: numLinha, coluna: 'Conta', msg: 'conta ausente' })
    const descricao = idxDesc >= 0 ? (cols[idxDesc] ?? '').trim() : ''
    if (!descricao) erros.push({ linha: numLinha, coluna: 'Descrição', msg: 'descrição ausente' })
    const row: ParsedDeParaRow = {
      linhaArquivo: numLinha,
      conta,
      descricao,
      linha_bp: idxBp >= 0 ? (cols[idxBp] ?? '').trim() : '',
      linha_dre: idxDre >= 0 ? (cols[idxDre] ?? '').trim() : '',
      grupo_bp: idxGrupo >= 0 ? (cols[idxGrupo] ?? '').trim() : '',
      cod_nota: idxNota >= 0 ? (cols[idxNota] ?? '').trim() : '',
      erros,
      isValid: erros.length === 0,
    }
    rows.push(row)
  }
  if (rows.length === 0) {
    return { rows: [], fatalError: 'Nenhuma linha de dados no arquivo do De-Para.' }
  }
  return { rows, fatalError: null }
}

export const CSV_MODELO_BALANCETE =
  'Empresa;Ano;Periodo;Conta;Descricao;Saldo Inicial;Debitos;Creditos;Saldo Final;Natureza\n' +
  'ALFA;2024;2024-08;1.1.01.001;Caixa Geral;5.000,00;12.500,00;8.000,00;9.500,00;D\n' +
  'ALFA;2024;2024-08;2.1.01.001;Fornecedores;50.000,00;10.000,00;15.000,00;55.000,00;C\n' +
  'ALFA;2024;2024-08;29999999;AJUSTE - RESULTADO JA APROPRIADO NO PL;0,00;0,00;7.500,00;7.500,00;C\n'

export const CSV_MODELO_DEPARA =
  'Conta;Descricao;LinhaBP;LinhaDRE;Grupo_BP;Cod_Nota\n' +
  '1.1.01.001;Caixa Geral;Caixa e Equivalentes de Caixa;;Ativo Circulante;03\n' +
  '2.1.01.001;Fornecedores;Fornecedores Nacionais e Estrangeiros;;Passivo Circulante;13\n'

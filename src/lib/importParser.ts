// Parser de arquivo de balancete (CSV/txt) usado pelo assistente de importação em 6 etapas.
// Toda validação aponta LINHA e CAMPO exatos do problema.

import { deparaService } from '@/services/accounting'
import type { DeParaRecord } from '@/types/accounting'

export const CAMPOS_IMPORTACAO = [
  { key: 'empresa', label: 'Empresa', obrigatorio: false },
  { key: 'ano', label: 'Ano', obrigatorio: false },
  { key: 'periodo', label: 'Período', obrigatorio: false },
  { key: 'conta', label: 'Conta', obrigatorio: true },
  { key: 'descricao', label: 'Descrição', obrigatorio: true },
  { key: 'saldo', label: 'Saldo', obrigatorio: true },
  { key: 'natureza', label: 'Natureza (D/C)', obrigatorio: false },
  { key: 'linha_bp', label: 'Linha do Balanço (BP)', obrigatorio: false },
  { key: 'linha_dre', label: 'Linha da DRE', obrigatorio: false },
  { key: 'cod_nota', label: 'Código da Nota', obrigatorio: false },
] as const

export type CampoKey = (typeof CAMPOS_IMPORTACAO)[number]['key']

export type ColumnMap = Record<CampoKey, number> // índice da coluna; -1 = não usar

export interface ParseError {
  campo: string // rótulo legível do campo
  msg: string
}

export interface ParsedRow {
  linhaArquivo: number // número da linha no arquivo (1-based, incluindo cabeçalho)
  empresa: string
  ano: number
  periodo: string
  conta: string
  descricao: string
  saldo: number
  natureza: 'D' | 'C'
  linha_bp: string
  linha_dre: string
  cod_nota: string
  erros: ParseError[]
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

export function detectSeparator(firstLine: string): string {
  if (firstLine.includes(';')) return ';'
  if (firstLine.includes('\t')) return '\t'
  if (firstLine.includes(',')) return ','
  return ';'
}

export function splitHeaders(firstLine: string, sep: string): string[] {
  return firstLine.split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ''))
}

/** Detecção automática de colunas a partir dos cabeçalhos. */
export function autoDetectColMap(headers: string[]): ColumnMap {
  const find = (...terms: string[]) => headers.findIndex((h) => terms.some((t) => h.includes(t)))
  return {
    empresa: find('empresa'),
    ano: find('ano'),
    periodo: find('periodo', 'período', 'mes'),
    conta: find('conta', 'codigo', 'código'),
    descricao: find('desc', 'nome', 'titulo'),
    saldo: find('saldo', 'valor'),
    natureza: find('nat', 'd/c', 'deb_cred'),
    linha_bp: find('bp'),
    linha_dre: find('dre'),
    cod_nota: find('nota'),
  }
}

/** Converte texto de valor pt-BR ("1.234,56" ou "1234.56") em número. */
export function parseValorBr(raw: string): number {
  const t = raw.trim()
  if (!t) return NaN
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.'))
  return parseFloat(t)
}

export async function loadDeparaMap(): Promise<Map<string, DeParaRecord>> {
  const list = await deparaService.listAll()
  return new Map(
    list.map((d) => [d.conta_origem?.trim(), d].filter(Boolean) as [string, DeParaRecord]),
  )
}

/**
 * Lê o arquivo inteiro e devolve as linhas validadas.
 * Cada erro carrega a linha do arquivo e o campo exato.
 */
export function parseRows(
  text: string,
  colMap: ColumnMap,
  defaults: ParseDefaults,
  deparaMap: Map<string, DeParaRecord>,
): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return {
      rows: [],
      fatalError:
        'O arquivo está vazio ou contém apenas a linha de cabeçalho. Inclua ao menos uma linha de dados após o cabeçalho.',
    }
  }

  const sep = detectSeparator(lines[0])
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue
    const cols = rawLine.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const erros: ParseError[] = []
    const numLinha = i + 1

    const cell = (campo: CampoKey) => {
      const idx = colMap[campo]
      return idx >= 0 ? (cols[idx] ?? '') : ''
    }

    // Empresa / ano / período — com fallback para os padrões da etapa 2
    const empresa = (cell('empresa') || defaults.empresa).toUpperCase()
    const periodo = cell('periodo') || defaults.periodo
    const anoTexto = cell('ano') || defaults.ano
    const ano = parseInt(anoTexto, 10)
    if (!periodo.trim()) {
      erros.push({
        campo: 'Período',
        msg: `período ausente na linha ${numLinha} e nenhum período padrão definido na etapa 2`,
      })
    }
    if (isNaN(ano)) {
      erros.push({
        campo: 'Ano',
        msg: `valor "${anoTexto}" não é um ano válido (linha ${numLinha})`,
      })
    }

    // Campos obrigatórios
    const conta = cell('conta')
    if (!conta) {
      erros.push({ campo: 'Conta', msg: `número da conta ausente na linha ${numLinha}` })
    }
    const descricao = cell('descricao')
    if (!descricao) {
      erros.push({ campo: 'Descrição', msg: `descrição da conta ausente na linha ${numLinha}` })
    }

    // Saldo
    const saldoTexto = cell('saldo')
    const saldo = saldoTexto ? parseValorBr(saldoTexto) : NaN
    if (saldoTexto && isNaN(saldo)) {
      erros.push({
        campo: 'Saldo',
        msg: `valor "${saldoTexto}" não é numérico (linha ${numLinha}); use 1234.56 ou 1.234,56`,
      })
    } else if (!saldoTexto) {
      erros.push({ campo: 'Saldo', msg: `saldo ausente na linha ${numLinha}` })
    }

    // Natureza — inferida pelo primeiro dígito da conta quando ausente
    let natureza = cell('natureza').toUpperCase() as 'D' | 'C'
    if (natureza !== 'D' && natureza !== 'C') {
      if (conta.startsWith('1') || (conta.startsWith('3') && !conta.startsWith('3.1'))) {
        natureza = 'D'
      } else {
        natureza = 'C'
      }
    }

    // De-Para automático quando a coluna não vier preenchida
    const deparaInfo = deparaMap.get(conta.trim())
    const linha_bp = cell('linha_bp') || deparaInfo?.linha_bp || ''
    const linha_dre = cell('linha_dre') || deparaInfo?.linha_dre || ''
    const cod_nota = cell('cod_nota') || deparaInfo?.cod_nota || ''

    if (!linha_bp && !linha_dre) {
      erros.push({
        campo: 'Mapeamento',
        msg: `nenhuma linha de BP ou DRE definida para a conta "${conta}" na linha ${numLinha}; cadastre no Mapeamento contábil`,
      })
    }

    rows.push({
      linhaArquivo: numLinha,
      empresa,
      ano: isNaN(ano) ? parseInt(defaults.ano, 10) || 0 : ano,
      periodo,
      conta,
      descricao,
      saldo: isNaN(saldo) ? 0 : saldo,
      natureza,
      linha_bp,
      linha_dre,
      cod_nota,
      erros,
      isValid: erros.length === 0,
    })
  }

  if (rows.length === 0) {
    return { rows: [], fatalError: 'Nenhuma linha de dados foi encontrada no arquivo.' }
  }
  return { rows, fatalError: null }
}

export const CSV_MODELO =
  'empresa;ano;periodo;conta;descricao;saldo;natureza;linha_bp;linha_dre;cod_nota\n' +
  'ALFA;2025;Dez/25;1.1.01.001;Caixa Geral Matriz;45000.00;D;Caixa e Equivalentes de Caixa;;03\n' +
  'ALFA;2025;Dez/25;1.1.01.002;Banco Conta Movimento;280000.00;D;Caixa e Equivalentes de Caixa;;03\n' +
  'ALFA;2025;Dez/25;1.1.03.001;Clientes a Receber;520000.00;D;Contas a Receber de Clientes;;05\n' +
  'ALFA;2025;Dez/25;2.1.01.001;Fornecedores Nacionais;380000.00;C;Fornecedores Nacionais e Estrangeiros;;13\n' +
  'ALFA;2025;Dez/25;2.4.01.001;Capital Social;800000.00;C;Capital Social Subscrito e Integralizado;;21\n' +
  'ALFA;2025;Dez/25;3.1.01.001;Receita de Vendas;3200000.00;C;;Receita Bruta de Vendas e Serviços;25\n'

import { balancetesService, eliminacoesService, estruturaService } from '@/services/accounting'
import type { BalanceteRecord, EstruturaBalancoRecord } from '@/types/accounting'

// Agregações do dashboard — todo número vem do PocketBase, nenhum valor simulado.

export interface ResumoFinanceiro {
  ativoTotal: number
  passivoTotal: number
  plTotal: number
  receitaLiquida: number
  resultadoLiquido: number
  caixaEquivalentes: number
}

const somaLinhas = (rows: BalanceteRecord[], pred: (r: BalanceteRecord) => boolean): number =>
  rows.filter(pred).reduce((acc, r) => acc + (Number(r.saldo) || 0), 0)

/** Deriva o resumo financeiro do balancete consolidado (soma de todas as empresas). */
export function computeResumo(rows: BalanceteRecord[]): ResumoFinanceiro {
  const ativo = rows.filter((r) => r.linha_bp?.startsWith('Ativo'))
  const caixa = rows.filter(
    (r) => r.linha_bp === 'Caixa e Equivalentes de Caixa' || r.conta.startsWith('1.1.01'),
  )
  const passivo = rows.filter((r) => r.linha_bp?.startsWith('Passivo'))
  const pl = rows.filter(
    (r) => r.linha_bp?.startsWith('Patrimônio') || r.linha_bp === 'Patrimônio Líquido',
  )
  const receita = rows.filter((r) => r.linha_dre?.startsWith('Receita'))
  const resultado = rows.filter((r) => r.linha_dre?.startsWith('Resultado'))

  return {
    ativoTotal: somaLinhas(rows, (r) => ativo.includes(r)),
    passivoTotal: somaLinhas(rows, (r) => passivo.includes(r)),
    plTotal: somaLinhas(rows, (r) => pl.includes(r)) * -1,
    receitaLiquida: somaLinhas(rows, (r) => receita.includes(r)),
    resultadoLiquido: somaLinhas(rows, (r) => resultado.includes(r)),
    caixaEquivalentes: somaLinhas(rows, (r) => caixa.includes(r)),
  }
}

export interface EvolucaoPonto {
  periodo: string
  ativo: number
  receita: number
  resultado: number
  caixa: number
}

/** Evolução por período (ordenado como aparece no filtro do balancete). */
export function computeEvolucao(rows: BalanceteRecord[]): EvolucaoPonto[] {
  const periodos = Array.from(new Set(rows.map((r) => r.periodo))).filter(Boolean)
  const pontos: EvolucaoPonto[] = []
  for (const p of periodos) {
    const sub = rows.filter((r) => r.periodo === p)
    const resumo = computeResumo(sub)
    pontos.push({
      periodo: p,
      ativo: resumo.ativoTotal,
      receita: resumo.receitaLiquida,
      resultado: resumo.resultadoLiquido,
      caixa: resumo.caixaEquivalentes,
    })
  }
  return pontos
}

export interface QualidadeContabil {
  aprovados: number
  alertas: number
  bloqueios: number
  percentual: number
}

/** Deriva qualidade do fechamento a partir da quadratura Ativo = Passivo + PL. */
export function computeQualidade(rows: BalanceteRecord[]): QualidadeContabil {
  const resumo = computeResumo(rows)
  const diferenca = Math.abs(resumo.ativoTotal - (resumo.passivoTotal + resumo.plTotal))
  const quadrado = diferenca < 0.01
  const checksTotais = 4 // quadratura + existência de receita + existência de resultado + caixa presente
  let ok = 0
  let alertas = 0
  let bloqueios = 0

  if (quadrado) ok += 1
  else if (diferenca < 1) alertas += 1
  else bloqueios += 1

  if (resumo.receitaLiquida !== 0) ok += 1
  else alertas += 1
  if (resumo.resultadoLiquido !== 0) ok += 1
  else alertas += 1
  if (resumo.caixaEquivalentes !== 0) ok += 1
  else alertas += 1

  return {
    aprovados: ok,
    alertas,
    bloqueios,
    percentual: Math.round((ok / checksTotais) * 100),
  }
}

/** Agrupa registros por linha_bp (usado no Balanço) mantendo ordem da estrutura. */
export function groupByLinha(
  rows: BalanceteRecord[],
  estrutura: EstruturaBalancoRecord[],
): { estrutura: EstruturaBalancoRecord[]; porLinha: Map<string, BalanceteRecord[]> } {
  const porLinha = new Map<string, BalanceteRecord[]>()
  for (const r of rows) {
    if (!r.linha_bp) continue
    const arr = porLinha.get(r.linha_bp) ?? []
    arr.push(r)
    porLinha.set(r.linha_bp, arr)
  }
  return { estrutura, porLinha }
}

export const loadBalancetes = (): Promise<BalanceteRecord[]> => balancetesService.listAll()

export { estruturaService, eliminacoesService }

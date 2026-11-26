// Cálculo do Balanço Patrimonial consolidado a partir dos dados reais do PocketBase.
// Nenhum valor é hardcoded: Combinado = soma dos balancetes por LinhaBP;
// Eliminação = coleção eliminacoes; Consolidado = Combinado + Eliminação.

import type { BalanceteRecord, DeParaRecord, EliminacaoRecord } from '@/types/accounting'
import { CONTA_AJUSTE } from '@/lib/importParser'

export interface LinhaBalanco {
  linha: string
  descricao: string
  grupo: string
  /** Soma dos saldos do balancete (todas as empresas), pela LinhaBP do de-para. */
  combinado: number
  /** Soma das eliminações (sinal aplicado pela natureza da linha). */
  eliminacao: number
  /** Combinado + Eliminação. */
  consolidado: number
  /** Contas que compõem a linha (drill-down). */
  contas: Array<{ conta: string; descricao: string; empresa: string; saldo: number }>
}

export interface GrupoBalanco {
  grupo: string
  linhas: LinhaBalanco[]
  totalCombinado: number
  totalEliminacao: number
  totalConsolidado: number
}

export interface CheckQuadratura {
  totalAtivo: number
  totalPassivoPL: number
  diferenca: number
  quadrado: boolean
}

const GRUPOS_ATIVO = [
  'Ativo Circulante',
  'Realizável a Longo Prazo',
  'Ativo Não Circulante',
  'Ativo Total',
]
const GRUPOS_PASSIVO_PL = [
  'Passivo Circulante',
  'Passivo Não Circulante',
  'Patrimônio Líquido',
  'Total Passivo + PL',
]

export const ehGrupoAtivo = (grupo: string) => GRUPOS_ATIVO.some((g) => grupo.startsWith(g))
export const ehGrupoPassivoPL = (grupo: string) =>
  GRUPOS_PASSIVO_PL.some((g) => grupo.startsWith(g))

/**
 * Monta o quadro do balanço. Contas de ajuste (29999999...) são EXCLUÍDAS da soma
 * e devolvidas à parte, como lançamento de ajuste.
 */
export function montarBalanco(
  balancetes: BalanceteRecord[],
  depara: DeParaRecord[],
  eliminacoes: EliminacaoRecord[],
  periodo: string,
): {
  ativo: GrupoBalanco[]
  passivoPL: GrupoBalanco[]
  check: CheckQuadratura
  ajustes: Array<{ conta: string; descricao: string; empresa: string; saldo: number }>
  semMapeamento: Array<{ conta: string; descricao: string; empresa: string; saldo: number }>
} {
  const deparaPorConta = new Map(depara.map((d) => [d.conta.trim(), d]))
  const mapa = new Map<string, LinhaBalanco>()
  const ajustes: Array<{ conta: string; descricao: string; empresa: string; saldo: number }> = []
  const semMapeamento: Array<{ conta: string; descricao: string; empresa: string; saldo: number }> =
    []

  const aplicaveis = balancetes.filter((b) => !periodo || b.periodo === periodo)

  for (const b of aplicaveis) {
    const conta = (b.conta ?? '').trim()
    const saldo = Number(b.saldo_final ?? b.saldo ?? 0)

    // Conta especial de ajuste: fora da soma operacional do balanço
    if (conta.startsWith(CONTA_AJUSTE)) {
      ajustes.push({ conta, descricao: b.descricao ?? '', empresa: b.empresa, saldo })
      continue
    }

    const mp = deparaPorConta.get(conta)
    if (!mp || !mp.linha_bp) {
      semMapeamento.push({ conta, descricao: b.descricao ?? '', empresa: b.empresa, saldo })
      continue
    }

    const grupo = mp.grupo_bp || (ehGrupoAtivo(mp.linha_bp) ? 'Ativo' : 'Passivo/PL')
    let lb = mapa.get(mp.linha_bp)
    if (!lb) {
      lb = {
        linha: mp.linha_bp,
        descricao: mp.linha_bp,
        grupo,
        combinado: 0,
        eliminacao: 0,
        consolidado: 0,
        contas: [],
      }
      mapa.set(mp.linha_bp, lb)
    }
    lb.combinado += saldo
    lb.contas.push({ conta, descricao: b.descricao ?? '', empresa: b.empresa, saldo })
  }

  // Eliminações do período
  const elims = eliminacoes.filter((e) => !periodo || e.periodo === periodo)
  for (const e of elims) {
    const chaveLinha = e.linha_balanco?.trim()
    if (!chaveLinha) continue
    let lb = mapa.get(chaveLinha)
    if (!lb) {
      lb = {
        linha: chaveLinha,
        descricao: chaveLinha,
        grupo: 'Ajustes de Consolidação',
        combinado: 0,
        eliminacao: 0,
        consolidado: 0,
        contas: [],
      }
      mapa.set(chaveLinha, lb)
    }
    lb.eliminacao += Number(e.valor ?? 0)
  }

  const linhas = Array.from(mapa.values())
  for (const lb of linhas) lb.consolidado = lb.combinado + lb.eliminacao

  // Agrupamento Ativo × Passivo/PL
  const agrupar = (grupos: string[]): GrupoBalanco[] => {
    const out: GrupoBalanco[] = []
    for (const g of grupos) {
      const doGrupo = linhas.filter((l) => l.grupo === g)
      if (doGrupo.length === 0) continue
      out.push({
        grupo: g,
        linhas: doGrupo,
        totalCombinado: doGrupo.reduce((s, l) => s + l.combinado, 0),
        totalEliminacao: doGrupo.reduce((s, l) => s + l.eliminacao, 0),
        totalConsolidado: doGrupo.reduce((s, l) => s + l.consolidado, 0),
      })
    }
    return out
  }

  const ativo = agrupar(GRUPOS_ATIVO)
  const passivoPL = agrupar(GRUPOS_PASSIVO_PL.filter((g) => g !== 'Total Passivo + PL'))

  const totalAtivo = ativo.reduce((s, g) => s + g.totalConsolidado, 0)
  const totalPassivoPL = passivoPL.reduce((s, g) => s + g.totalConsolidado, 0)
  const diferenca = totalAtivo - totalPassivoPL

  return {
    ativo,
    passivoPL,
    check: {
      totalAtivo,
      totalPassivoPL,
      diferenca,
      quadrado: Math.abs(diferenca) <= 0.01,
    },
    ajustes,
    semMapeamento,
  }
}

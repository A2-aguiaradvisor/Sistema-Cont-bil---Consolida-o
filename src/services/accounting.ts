import pb from '@/lib/pocketbase/client'
import type {
  BalanceteRecord,
  DeParaRecord,
  EstruturaBalancoRecord,
  EliminacaoRecord,
} from '@/types/accounting'

// Camada de acesso ao PocketBase para as coleções contábeis.

export const balancetesService = {
  async listAll(): Promise<BalanceteRecord[]> {
    const list = await pb.collection('balancetes').getFullList({
      sort: 'empresa,periodo,conta',
    })
    return list as unknown as BalanceteRecord[]
  },
  async listByPeriodo(empresa: string, ano: number, periodo: string): Promise<BalanceteRecord[]> {
    const list = await pb
      .collection('balancetes')
      .getFullList({ filter: `empresa='${empresa}' && ano=${ano} && periodo='${periodo}'` })
    return list as unknown as BalanceteRecord[]
  },
  /** Períodos distintos existentes no balancete ("2024-08"), mais recentes primeiro. */
  async listPeriodos(): Promise<string[]> {
    const list = await pb.collection('balancetes').getFullList({ fields: 'periodo' })
    return Array.from(new Set(list.map((r) => (r as { periodo?: string }).periodo ?? '')))
      .filter(Boolean)
      .sort()
      .reverse()
  },
  async create(data: Partial<BalanceteRecord>): Promise<BalanceteRecord> {
    return (await pb.collection('balancetes').create(data)) as unknown as BalanceteRecord
  },
  async update(id: string, data: Partial<BalanceteRecord>): Promise<BalanceteRecord> {
    return (await pb.collection('balancetes').update(id, data)) as unknown as BalanceteRecord
  },
  async delete(id: string): Promise<void> {
    await pb.collection('balancetes').delete(id)
  },
}

export const deparaService = {
  async listAll(): Promise<DeParaRecord[]> {
    const list = await pb.collection('depara').getFullList({ sort: 'conta' })
    return list as unknown as DeParaRecord[]
  },
  async create(data: Partial<DeParaRecord>): Promise<DeParaRecord> {
    return (await pb.collection('depara').create(data)) as unknown as DeParaRecord
  },
  async update(id: string, data: Partial<DeParaRecord>): Promise<DeParaRecord> {
    return (await pb.collection('depara').update(id, data)) as unknown as DeParaRecord
  },
  async delete(id: string): Promise<void> {
    await pb.collection('depara').delete(id)
  },
}

export const estruturaService = {
  async listAll(tipo?: 'BP' | 'DRE'): Promise<EstruturaBalancoRecord[]> {
    const filter = tipo ? `tipo='${tipo}'` : undefined
    const list = await pb.collection('estrutura_balanco').getFullList({
      sort: 'ordem',
      filter,
    })
    return list as unknown as EstruturaBalancoRecord[]
  },
}

export const eliminacoesService = {
  async listAll(): Promise<EliminacaoRecord[]> {
    const list = await pb.collection('eliminacoes').getFullList({ sort: '-created' })
    return list as unknown as EliminacaoRecord[]
  },
  /** Eliminações de um período; opcionalmente filtradas pelo quadro (BP/DRE). */
  async listByPeriodo(periodo: string, tipoQuadro?: 'BP' | 'DRE') {
    const filtro = tipoQuadro
      ? `periodo='${periodo}' && tipo_quadro='${tipoQuadro}'`
      : `periodo='${periodo}'`
    const list = await pb.collection('eliminacoes').getFullList({ filter: filtro })
    return list as unknown as EliminacaoRecord[]
  },
  async create(data: Partial<EliminacaoRecord>): Promise<EliminacaoRecord> {
    return (await pb.collection('eliminacoes').create(data)) as unknown as EliminacaoRecord
  },
  async update(id: string, data: Partial<EliminacaoRecord>): Promise<EliminacaoRecord> {
    return (await pb.collection('eliminacoes').update(id, data)) as unknown as EliminacaoRecord
  },
  async delete(id: string): Promise<void> {
    await pb.collection('eliminacoes').delete(id)
  },
}

/** Identificador de lote para rastreabilidade da importação. */
export function gerarLote(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `IMP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * Reimporta um lote inteiro de balancete: apaga as linhas existentes do mesmo
 * (empresa, ano, periodo) e grava as novas — sem duplicar contas.
 */
export async function importarBalanceteLote(
  linhas: Array<Partial<BalanceteRecord> & { conta: string }>,
  chave: { empresa: string; ano: number; periodo: string },
): Promise<number> {
  const existentes = await pb.collection('balancetes').getFullList({
    filter: `empresa='${chave.empresa}' && ano=${chave.ano} && periodo='${chave.periodo}'`,
    fields: 'id',
  })
  for (const rec of existentes) {
    await pb.collection('balancetes').delete(rec.id)
  }
  for (const linha of linhas) {
    await pb.collection('balancetes').create(linha)
  }
  return linhas.length
}

/**
 * Importa o De-Para em lote: atualiza quem já existe (por `conta`, índice único)
 * e cria os novos — substitui o mapeamento sem duplicar.
 */
export async function importarDeParaLote(
  linhas: Array<Partial<DeParaRecord> & { conta: string; descricao: string }>,
): Promise<{ criados: number; atualizados: number }> {
  const existentes = await deparaService.listAll()
  const porConta = new Map(existentes.map((d) => [d.conta?.trim() ?? '', d]))
  let criados = 0
  let atualizados = 0
  for (const linha of linhas) {
    const alvo = porConta.get(linha.conta.trim())
    if (alvo) {
      await deparaService.update(alvo.id, linha)
      atualizados++
    } else {
      await deparaService.create(linha)
      criados++
    }
  }
  return { criados, atualizados }
}

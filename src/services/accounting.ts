import pb from '@/lib/pocketbase/client'
import type {
  BalanceteRecord,
  DeParaRecord,
  EstruturaBalancoRecord,
  EliminacaoRecord,
} from '@/types/accounting'

export const balancetesService = {
  async listAll(filter?: string, sort = 'conta'): Promise<BalanceteRecord[]> {
    return await pb.collection('balancetes').getFullList<BalanceteRecord>({
      filter: filter || '',
      sort,
      requestKey: null,
    })
  },

  async listPeriodos(): Promise<string[]> {
    const records = await pb.collection('balancetes').getFullList<{ periodo: string }>({
      fields: 'periodo',
      sort: '-ano,-periodo',
      requestKey: null,
    })
    const unique = Array.from(new Set(records.map((r) => r.periodo))).filter(Boolean)
    return unique.length > 0 ? unique : ['Dez/25', 'Dez/24']
  },

  async listEmpresas(): Promise<string[]> {
    const records = await pb.collection('balancetes').getFullList<{ empresa: string }>({
      fields: 'empresa',
      sort: 'empresa',
      requestKey: null,
    })
    const unique = Array.from(new Set(records.map((r) => r.empresa))).filter(Boolean)
    return unique.length > 0 ? unique : ['ALFA', 'BETA']
  },

  async deleteByEmpresaPeriodo(empresa: string, periodo: string): Promise<number> {
    const toDelete = await pb.collection('balancetes').getFullList<BalanceteRecord>({
      filter: `empresa = "${empresa}" && periodo = "${periodo}"`,
      requestKey: null,
    })
    for (const item of toDelete) {
      await pb.collection('balancetes').delete(item.id)
    }
    return toDelete.length
  },

  async create(
    data: Omit<BalanceteRecord, 'id' | 'created' | 'updated'>,
  ): Promise<BalanceteRecord> {
    return await pb.collection('balancetes').create<BalanceteRecord>(data)
  },

  async importBatch(
    records: Omit<BalanceteRecord, 'id' | 'created' | 'updated'>[],
    replaceExisting = true,
  ): Promise<{ imported: number; replaced: number }> {
    if (records.length === 0) return { imported: 0, replaced: 0 }

    let replacedCount = 0
    if (replaceExisting) {
      const distinctTargets = Array.from(new Set(records.map((r) => `${r.empresa}___${r.periodo}`)))
      for (const target of distinctTargets) {
        const [emp, per] = target.split('___')
        const delCount = await this.deleteByEmpresaPeriodo(emp, per)
        replacedCount += delCount
      }
    }

    // Cria os novos registros
    for (const record of records) {
      await pb.collection('balancetes').create(record)
    }

    return { imported: records.length, replaced: replacedCount }
  },

  async update(id: string, data: Partial<BalanceteRecord>): Promise<BalanceteRecord> {
    return await pb.collection('balancetes').update<BalanceteRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('balancetes').delete(id)
  },
}

export const deparaService = {
  async listAll(filter?: string, sort = 'conta'): Promise<DeParaRecord[]> {
    return await pb.collection('depara').getFullList<DeParaRecord>({
      filter: filter || '',
      sort,
      requestKey: null,
    })
  },

  async getMap(): Promise<Map<string, DeParaRecord>> {
    const items = await this.listAll()
    const map = new Map<string, DeParaRecord>()
    for (const item of items) {
      map.set(item.conta.trim(), item)
    }
    return map
  },

  async create(data: Omit<DeParaRecord, 'id' | 'created' | 'updated'>): Promise<DeParaRecord> {
    return await pb.collection('depara').create<DeParaRecord>(data)
  },

  async update(id: string, data: Partial<DeParaRecord>): Promise<DeParaRecord> {
    return await pb.collection('depara').update<DeParaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('depara').delete(id)
  },

  async upsert(data: Omit<DeParaRecord, 'id' | 'created' | 'updated'>): Promise<DeParaRecord> {
    const existing = await pb.collection('depara').getList<DeParaRecord>(1, 1, {
      filter: `conta = "${data.conta.trim()}"`,
      requestKey: null,
    })
    if (existing.items.length > 0) {
      return await pb.collection('depara').update<DeParaRecord>(existing.items[0].id, data)
    }
    return await pb.collection('depara').create<DeParaRecord>(data)
  },
}

export const estruturaService = {
  async listAll(tipo?: 'BP' | 'DRE'): Promise<EstruturaBalancoRecord[]> {
    const filter = tipo ? `tipo = "${tipo}"` : ''
    return await pb.collection('estrutura_balanco').getFullList<EstruturaBalancoRecord>({
      filter,
      sort: 'ordem',
      requestKey: null,
    })
  },

  async create(
    data: Omit<EstruturaBalancoRecord, 'id' | 'created' | 'updated'>,
  ): Promise<EstruturaBalancoRecord> {
    return await pb.collection('estrutura_balanco').create<EstruturaBalancoRecord>(data)
  },

  async update(id: string, data: Partial<EstruturaBalancoRecord>): Promise<EstruturaBalancoRecord> {
    return await pb.collection('estrutura_balanco').update<EstruturaBalancoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('estrutura_balanco').delete(id)
  },
}

export const eliminacoesService = {
  async listByPeriodo(periodo: string, tipo?: 'BP' | 'DRE'): Promise<EliminacaoRecord[]> {
    let filter = `periodo = "${periodo}"`
    if (tipo) {
      filter += ` && tipo_quadro = "${tipo}"`
    }
    return await pb.collection('eliminacoes').getFullList<EliminacaoRecord>({
      filter,
      sort: '-created',
      requestKey: null,
    })
  },

  async create(
    data: Omit<EliminacaoRecord, 'id' | 'created' | 'updated'>,
  ): Promise<EliminacaoRecord> {
    return await pb.collection('eliminacoes').create<EliminacaoRecord>(data)
  },

  async update(id: string, data: Partial<EliminacaoRecord>): Promise<EliminacaoRecord> {
    return await pb.collection('eliminacoes').update<EliminacaoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('eliminacoes').delete(id)
  },
}

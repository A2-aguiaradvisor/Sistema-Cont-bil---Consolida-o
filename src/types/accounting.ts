// Tipos das coleções contábeis do PocketBase.

export interface BalanceteRecord {
  id: string
  empresa: string
  ano: number
  periodo: string // "2024-08"
  conta: string
  descricao: string
  // Regra permanente: os 4 saldos, nunca só o saldo final
  saldo: number
  saldo_inicial: number
  debitos: number
  creditos: number
  saldo_final: number
  natureza: 'D' | 'C'
  moeda?: string
  centro_custo?: string
  segmento?: string
  lote?: string
  linha_bp?: string
  linha_dre?: string
  cod_nota?: string
  created?: string
  updated?: string
  [key: string]: unknown // PocketBase devolve campos extras (expand etc.)
}

export interface DeParaRecord {
  id: string
  conta: string
  descricao: string
  linha_bp?: string
  grupo_bp?: string
  linha_dre?: string
  cod_nota?: string
  tipo_conta?: 'ATIVO' | 'PASSIVO' | 'PL' | 'RESULTADO'
  observacao?: string
  created?: string
  updated?: string
}

export interface EstruturaBalancoRecord {
  id: string
  tipo: 'BP' | 'DRE'
  grupo: string
  linha: string
  cod_nota?: string
  nivel: number
  ordem: number
  natureza: 'D' | 'C'
  is_total: boolean
}

export interface EliminacaoRecord {
  id: string
  ano: number
  periodo: string
  empresa?: string
  tipo_quadro: 'BP' | 'DRE'
  linha_balanco: string
  descricao: string
  debito?: number
  credito?: number
  valor: number
  created?: string
  updated?: string
}

export interface QuadraturaStatus {
  quadrado: boolean
  diferenca: number
}

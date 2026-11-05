export interface BalanceteRecord {
  id: string
  empresa: string
  ano: number
  periodo: string // ex: "Dez/25"
  conta: string // ex: "1.1.01.001"
  descricao: string
  saldo: number
  natureza: 'D' | 'C'
  linha_bp?: string
  linha_dre?: string
  cod_nota?: string
  created?: string
  updated?: string
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
  nivel: number // 1: Total, 2: Subtotal/Grupo, 3: Linha analítica
  ordem: number
  natureza: 'D' | 'C'
  is_total?: boolean
  created?: string
  updated?: string
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
  ativoTotal: number
  passivoTotal: number
  plTotal: number
  passivoMaisPL: number
  diferenca: number
  isQuadrado: boolean
}

// Utilidades visuais compartilhadas — formatação pt-BR, cores de status e hierarquia de linhas.

export type UnitScale = 'unidade' | 'milhar' | 'milhao'

const SCALE_DIVISOR: Record<UnitScale, number> = {
  unidade: 1,
  milhar: 1_000,
  milhao: 1_000_000,
}

const SCALE_SUFFIX: Record<UnitScale, string> = {
  unidade: '',
  milhar: ' mil',
  milhao: ' mi',
}

/** Formata um valor monetário na escala selecionada (pt-BR, 2 decimais). */
export function formatValor(value: number, scale: UnitScale = 'unidade'): string {
  const safe = Number.isFinite(value) ? value : 0
  const scaled = safe / SCALE_DIVISOR[scale]
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(scaled))
  const sign = safe < 0 ? '-' : ''
  return `${sign}${formatted}${SCALE_SUFFIX[scale]}`
}

/** Variação absoluta entre períodos. */
export const variacaoAbsoluta = (atual: number, anterior: number): number => atual - anterior

/** Variação percentual; retorna null quando não comparável. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null
  if (!Number.isFinite(atual)) return null
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
  return `${value > 0 ? '+' : ''}${formatted}%`
}

export type StatusTone = 'ok' | 'warn' | 'block' | 'neutral'

/** Classes Tailwind padronizadas para cada tom de status (verde/âmbar/vermelho discretos). */
export const statusToneClasses: Record<StatusTone, { badge: string; dot: string; text: string }> = {
  ok: {
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    text: 'text-emerald-800',
  },
  warn: {
    badge: 'bg-amber-50 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    text: 'text-amber-800',
  },
  block: {
    badge: 'bg-red-50 text-red-800 border-red-300',
    dot: 'bg-red-600',
    text: 'text-red-800',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    text: 'text-slate-700',
  },
}

/** Hierarquia visual de linhas de relatório: total > subtotal > analítica. */
export type RowLevel = 'total' | 'subtotal' | 'analitica' | 'grupo'

export interface RowLevelStyle {
  row: string
  cell: string
  indentPerLevel: number
}

export const rowLevelStyles: Record<RowLevel, RowLevelStyle> = {
  total: {
    row: 'bg-slate-100/90 border-t-2 border-slate-300 font-semibold',
    cell: 'text-slate-900',
    indentPerLevel: 0,
  },
  subtotal: {
    row: 'bg-slate-50 border-t border-slate-200 font-semibold',
    cell: 'text-slate-900',
    indentPerLevel: 0,
  },
  grupo: {
    row: 'bg-white font-medium',
    cell: 'text-slate-800',
    indentPerLevel: 12,
  },
  analitica: {
    row: 'bg-white',
    cell: 'text-slate-700',
    indentPerLevel: 20,
  },
}

/** Cor de barra de gráfico conforme sinal do valor. */
export const chartBarColor = (value: number): string => (value < 0 ? '#b42318' : '#0b2545')

export const CHART_COLORS = ['#0b2545', '#155a80', '#6b8fae', '#12805c', '#b58a0b']

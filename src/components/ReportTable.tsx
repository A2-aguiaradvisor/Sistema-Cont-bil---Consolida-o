// Tabela de relatório financeiro reutilizável: grupos expansíveis, cabeçalho fixo,
// valores à direita, variação absoluta e %, alternância de escala.

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPercent,
  formatValor,
  variacaoAbsoluta,
  variacaoPercentual,
  type UnitScale,
} from '@/lib/visual'
import { Button } from '@/components/ui/button'

export interface ReportLinha {
  id: string
  descricao: string
  codigo: string
  atual: number
  anterior: number
  level: number // profundidade para indentação
  kind: 'analitica' | 'grupo' | 'subtotal' | 'total'
  filhos?: ReportLinha[]
}

export const ReportTable: React.FC<{
  linhas: ReportLinha[]
  scale: UnitScale
  onContaClick?: (linha: ReportLinha) => void
  colPeriodoAtual: string
  colPeriodoAnterior: string
}> = ({ linhas, scale, onContaClick, colPeriodoAtual, colPeriodoAnterior }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const renderLinha = (l: ReportLinha, depth: number): React.ReactNode[] => {
    const isExpandable = !!l.filhos && l.filhos.length > 0
    const isCollapsed = collapsed.has(l.id)
    const abs = variacaoAbsoluta(l.atual, l.anterior)
    const pct = variacaoPercentual(l.atual, l.anterior)
    const isTotal = l.kind === 'total'
    const isSubtotal = l.kind === 'subtotal'

    const nodes: React.ReactNode[] = [
      <tr
        key={l.id}
        className={cn(
          'border-b border-slate-100',
          isTotal && 'bg-slate-100 border-t-2 border-slate-300 font-semibold',
          isSubtotal && 'bg-slate-50 border-t border-slate-200 font-semibold',
          !isTotal && !isSubtotal && 'hover:bg-slate-50/60',
        )}
      >
        <td className="py-1.5 pl-3 pr-2 text-[13px]">
          <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
            {isExpandable ? (
              <button
                onClick={() => toggle(l.id)}
                className="mr-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={isCollapsed ? 'Expandir grupo' : 'Recolher grupo'}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="mr-1 inline-block w-[18px]" />
            )}
            <span
              onClick={() => onContaClick?.(l)}
              className={cn(
                onContaClick && 'cursor-pointer hover:text-petrol hover:underline',
                l.kind === 'total' || l.kind === 'subtotal' ? 'text-graphite' : 'text-slate-700',
              )}
            >
              {l.descricao}
            </span>
          </div>
        </td>
        <td className="px-2 py-1.5 text-left font-mono text-[11px] text-slate-500">{l.codigo}</td>
        <td
          className={cn(
            'px-3 py-1.5 text-right tabular-nums text-[13px]',
            isTotal || isSubtotal ? 'text-graphite' : 'text-slate-800',
          )}
        >
          {formatValor(l.atual, scale)}
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums text-[13px] text-slate-500">
          {formatValor(l.anterior, scale)}
        </td>
        <td
          className={cn(
            'px-3 py-1.5 text-right tabular-nums text-[13px]',
            abs < 0 ? 'text-red-700' : abs > 0 ? 'text-slate-800' : 'text-slate-400',
          )}
        >
          {formatValor(abs, scale)}
        </td>
        <td
          className={cn(
            'px-3 py-1.5 text-right tabular-nums text-[13px]',
            pct !== null && pct < 0 ? 'text-red-700' : 'text-slate-600',
          )}
        >
          {formatPercent(pct)}
        </td>
      </tr>,
    ]

    if (isExpandable && !isCollapsed) {
      for (const f of l.filhos!) nodes.push(...renderLinha(f, depth + 1))
    }
    return nodes
  }

  return (
    <div className="overflow-auto max-h-[640px] rounded-md border border-slate-200">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">Descrição</th>
            <th className="px-2 py-2.5 text-left font-medium">Código</th>
            <th className="px-3 py-2.5 text-right font-medium">{colPeriodoAtual}</th>
            <th className="px-3 py-2.5 text-right font-medium">{colPeriodoAnterior}</th>
            <th className="px-3 py-2.5 text-right font-medium">Variação</th>
            <th className="px-3 py-2.5 text-right font-medium">Var. %</th>
          </tr>
        </thead>
        <tbody>{linhas.map((l) => renderLinha(l, 0))}</tbody>
      </table>
    </div>
  )
}

export default ReportTable

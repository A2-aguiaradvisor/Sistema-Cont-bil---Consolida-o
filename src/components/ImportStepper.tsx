// Stepper visual do fluxo de importação de balancete (6 etapas).
// A etapa ativa é derivada do estado da tela, não é decorativa.

import React from 'react'
import { cn } from '@/lib/utils'
import { UploadCloud, Building2, Table2, Eye, ShieldCheck, CheckCircle2, Check } from 'lucide-react'

export const IMPORT_STEPS = [
  { id: 1, label: 'Selecionar arquivo', icon: UploadCloud },
  { id: 2, label: 'Identificar empresa e período', icon: Building2 },
  { id: 3, label: 'Mapear colunas', icon: Table2 },
  { id: 4, label: 'Visualizar dados', icon: Eye },
  { id: 5, label: 'Validar', icon: ShieldCheck },
  { id: 6, label: 'Confirmar', icon: CheckCircle2 },
] as const

/**
 * Deriva a etapa atual (1-6) a partir do estado da tela de importação.
 * 1: sem arquivo · 2/3: arquivo carregado, parâmetros/colunas detectados
 * 4: prévia disponível · 5: há linhas inválidas a revisar · 6: importação concluída.
 */
export function derivarEtapaImportacao(state: {
  fileName: string | null
  processando: boolean
  totalLinhas: number
  invalidas: number
  importado: boolean
}): number {
  if (state.importado) return 6
  if (state.totalLinhas === 0) return state.fileName ? 2 : 1
  if (state.processando) return 3
  if (state.invalidas > 0) return 5
  return 4
}

export const ImportStepper: React.FC<{ etapa: number }> = ({ etapa }) => {
  return (
    <ol
      className="flex flex-col gap-0 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:gap-0 sm:overflow-x-auto"
      aria-label="Etapas da importação"
    >
      {IMPORT_STEPS.map((step, idx) => {
        const Icon = step.icon
        const done = etapa > step.id
        const active = etapa === step.id
        return (
          <li key={step.id} className="flex items-center gap-2 sm:flex-1">
            <div className="flex items-center gap-2 py-1.5">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                  done && 'border-emerald-600 bg-emerald-600 text-white',
                  active && 'border-navy bg-navy text-white',
                  !done && !active && 'border-slate-300 bg-white text-slate-400',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] leading-tight',
                  active
                    ? 'font-semibold text-graphite'
                    : done
                      ? 'text-slate-600'
                      : 'text-slate-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < IMPORT_STEPS.length - 1 && (
              <span
                className={cn(
                  'hidden h-px flex-1 sm:block',
                  done ? 'bg-emerald-500' : 'bg-slate-200',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import { balancetesService } from '@/services/accounting'
import type { BalanceteRecord } from '@/types/accounting'
import { computeResumo } from '@/lib/dashboard'
import { formatValor, type UnitScale } from '@/lib/visual'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  Scale as ScaleIcon,
} from 'lucide-react'

type CheckStatus = 'ok' | 'warn' | 'block'

interface CheckLinha {
  id: string
  nome: string
  demonstracao: string
  esperado: number
  encontrado: number
  status: CheckStatus
  detalhes: string[]
}

const UNITS: { value: UnitScale; label: string }[] = [
  { value: 'unidade', label: 'Unidade' },
  { value: 'milhar', label: 'Milhar' },
  { value: 'milhao', label: 'Milhão' },
]

const statusMeta: Record<CheckStatus, { label: string; badge: string; Icon: React.ElementType }> = {
  ok: {
    label: 'Aprovado',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
  },
  warn: {
    label: 'Atenção',
    badge: 'bg-amber-50 text-amber-800 border-amber-300',
    Icon: AlertTriangle,
  },
  block: {
    label: 'Bloqueado',
    badge: 'bg-red-50 text-red-800 border-red-300',
    Icon: XCircle,
  },
}

export const Conciliacao: React.FC = () => {
  const [rows, setRows] = useState<BalanceteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState('TODAS')
  const [periodo, setPeriodo] = useState('TODOS')
  const [demonstracao, setDemonstracao] = useState('TODAS')
  const [scale, setScale] = useState<UnitScale>('milhao')
  const [detalhe, setDetalhe] = useState<CheckLinha | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await balancetesService.listAll())
    } catch (e) {
      console.error(e)
      setError('Falha ao carregar saldos para os checks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const empresas = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.empresa)))
        .filter(Boolean)
        .sort(),
    [rows],
  )
  const periodos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.periodo))).filter(Boolean),
    [rows],
  )

  const checks: CheckLinha[] = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (empresa === 'TODAS' || r.empresa === empresa) &&
        (periodo === 'TODOS' || r.periodo === periodo),
    )
    const byEmpresaPeriodo = new Map<string, BalanceteRecord[]>()
    for (const r of filtered) {
      const key = `${r.empresa}|${r.periodo}`
      const arr = byEmpresaPeriodo.get(key) ?? []
      arr.push(r)
      byEmpresaPeriodo.set(key, arr)
    }

    const linhas: CheckLinha[] = []
    for (const [key, subset] of byEmpresaPeriodo) {
      const [emp, per] = key.split('|')
      const resumo = computeResumo(subset)
      const dif = resumo.ativoTotal - (resumo.passivoTotal + resumo.plTotal)
      const absDif = Math.abs(dif)
      linhas.push({
        id: `${key}-quadratura`,
        nome: 'Quadratura Ativo = Passivo + PL',
        demonstracao: 'Balanço Patrimonial',
        esperado: resumo.ativoTotal,
        encontrado: resumo.passivoTotal + resumo.plTotal,
        status: absDif < 0.01 ? 'ok' : absDif < 1 ? 'warn' : 'block',
        detalhes: [
          `Empresa: ${emp} · Período: ${per}`,
          `Ativo total calculado: ${formatValor(resumo.ativoTotal)}`,
          `Passivo + PL calculado: ${formatValor(resumo.passivoTotal + resumo.plTotal)}`,
          `Diferença: ${formatValor(dif)}`,
        ],
      })

      const totalLinhasConta = subset.reduce((acc, r) => acc + (Number(r.saldo) || 0), 0)
      const somaAnaliticas = subset
        .filter((r) => r.conta.split('.').length >= 4)
        .reduce((acc, r) => acc + (Number(r.saldo) || 0), 0)
      if (subset.some((r) => r.conta.split('.').length >= 4)) {
        const difSint = totalLinhasConta - somaAnaliticas
        linhas.push({
          id: `${key}-sinteticas`,
          nome: 'Contas sintéticas vs. analíticas',
          demonstracao: 'Balancete',
          esperado: totalLinhasConta,
          encontrado: somaAnaliticas,
          status: Math.abs(difSint) < 0.01 ? 'ok' : 'warn',
          detalhes: [
            `Empresa: ${emp} · Período: ${per}`,
            `Soma de todas as linhas: ${formatValor(totalLinhasConta)}`,
            `Soma apenas de contas analíticas (4+ níveis): ${formatValor(somaAnaliticas)}`,
            `Diferença (sintéticas): ${formatValor(difSint)}`,
          ],
        })
      }
    }

    return linhas.filter((l) => demonstracao === 'TODAS' || l.demonstracao === demonstracao)
  }, [rows, empresa, periodo, demonstracao])

  const resumo = useMemo(() => {
    return {
      ok: checks.filter((c) => c.status === 'ok').length,
      warn: checks.filter((c) => c.status === 'warn').length,
      block: checks.filter((c) => c.status === 'block').length,
    }
  }, [checks])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <XCircle className="h-8 w-8 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-graphite">Painel de Conciliação</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Validações contábeis derivadas dos saldos importados — quadratura e conferência de saldos.
        </p>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Empresa</Label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {periodos.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Demonstração</Label>
            <Select value={demonstracao} onValueChange={setDemonstracao}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="Balanço Patrimonial">Balanço Patrimonial</SelectItem>
                <SelectItem value="Balancete">Balancete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Escala</Label>
            <Select value={scale} onValueChange={(v) => setScale(v as UnitScale)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo de status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={statusMeta.ok.badge}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {resumo.ok} aprovados
        </Badge>
        <Badge variant="outline" className={statusMeta.warn.badge}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" /> {resumo.warn} em atenção
        </Badge>
        <Badge variant="outline" className={statusMeta.block.badge}>
          <XCircle className="h-3.5 w-3.5 mr-1" /> {resumo.block} bloqueados
        </Badge>
        <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      {/* Tabela de checks */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-graphite">
            <ScaleIcon className="h-4 w-4 text-petrol" /> Validações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Validação</th>
                  <th className="px-3 py-2.5 text-left font-medium">Demonstração</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor esperado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor encontrado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Diferença</th>
                  <th className="px-3 py-2.5 text-center font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((c) => {
                  const meta = statusMeta[c.status]
                  const Icon = meta.Icon
                  const dif = c.encontrado - c.esperado
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{c.nome}</td>
                      <td className="px-3 py-2.5 text-slate-500">{c.demonstracao}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatValor(c.esperado, scale)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatValor(c.encontrado, scale)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                          Math.abs(dif) < 0.01 ? 'text-slate-500' : 'text-red-700'
                        }`}
                      >
                        {formatValor(dif, scale)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className={meta.badge}>
                          <Icon className="h-3 w-3 mr-1" /> {meta.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-petrol hover:bg-petrol/10"
                          onClick={() => setDetalhe(c)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver detalhes
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {checks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhuma validação para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-graphite">
              {detalhe?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detalhe?.demonstracao} · Composição do cálculo
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-2 py-2">
              {detalhe.detalhes.map((d, i) => (
                <p key={i} className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {d}
                </p>
              ))}
              <Badge variant="outline" className={statusMeta[detalhe.status].badge}>
                {statusMeta[detalhe.status].label}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Conciliacao

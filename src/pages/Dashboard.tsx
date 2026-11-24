import React, { useEffect, useMemo, useState } from 'react'
import { balancetesService } from '@/services/accounting'
import type { BalanceteRecord } from '@/types/accounting'
import {
  computeEvolucao,
  computeQualidade,
  computeResumo,
  type EvolucaoPonto,
  type QualidadeContabil,
  type ResumoFinanceiro,
} from '@/lib/dashboard'
import { formatValor, type UnitScale } from '@/lib/visual'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Scale,
  Wallet,
  Coins,
  PiggyBank,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react'

const UNITS: { value: UnitScale; label: string }[] = [
  { value: 'unidade', label: 'Unidade' },
  { value: 'milhar', label: 'Milhar' },
  { value: 'milhao', label: 'Milhão' },
]

const MetricCard: React.FC<{
  label: string
  value: number
  scale: UnitScale
  icon: React.ElementType
  hint?: string
  negativeIsBad?: boolean
}> = ({ label, value, scale, icon: Icon, hint, negativeIsBad }) => {
  const isNeg = value < 0
  const tone = negativeIsBad && isNeg ? 'text-red-700' : isNeg ? 'text-red-700' : 'text-slate-900'
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
              {formatValor(value, scale)}
            </p>
            {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-petrol/10">
            <Icon className="h-4 w-4 text-petrol" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

const QualityPill: React.FC<{ tone: 'ok' | 'warn' | 'block'; count: number; label: string }> = ({
  tone,
  count,
  label,
}) => {
  const map = {
    ok: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
    warn: { cls: 'bg-amber-50 text-amber-800 border-amber-300', Icon: AlertTriangle },
    block: { cls: 'bg-red-50 text-red-800 border-red-300', Icon: XCircle },
  }[tone]
  const Icon = map.Icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${map.cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold tabular-nums">{count}</span>
      <span>{label}</span>
    </span>
  )
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [rows, setRows] = useState<BalanceteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState<UnitScale>('milhao')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await balancetesService.listAll()
      setRows(data)
    } catch (e) {
      console.error(e)
      setError('Não foi possível carregar os dados do balancete.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resumo: ResumoFinanceiro | null = useMemo(
    () => (rows.length ? computeResumo(rows) : null),
    [rows],
  )
  const evolucao: EvolucaoPonto[] = useMemo(() => computeEvolucao(rows), [rows])
  const qualidade: QualidadeContabil | null = useMemo(
    () => (rows.length ? computeQualidade(rows) : null),
    [rows],
  )

  const periodos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.periodo))).filter(Boolean),
    [rows],
  )
  const periodoAtual = periodos[periodos.length - 1] ?? '—'
  const statusFechamento = qualidade
    ? qualidade.bloqueios > 0
      ? 'Bloqueado'
      : qualidade.alertas > 0
        ? 'Em revisão'
        : 'Aprovado'
    : '—'

  const chartTicker = (v: number) => formatValor(v, scale)

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
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
    <div className="space-y-6">
      {/* Cabeçalho executivo */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-graphite">Dashboard Executivo</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Grupo ABC · Período <span className="font-medium text-slate-700">{periodoAtual}</span> ·
            Fechamento{' '}
            <Badge
              variant="outline"
              className={
                statusFechamento === 'Aprovado'
                  ? 'ml-1 border-emerald-200 bg-emerald-50 text-emerald-800'
                  : statusFechamento === 'Bloqueado'
                    ? 'ml-1 border-red-300 bg-red-50 text-red-800'
                    : 'ml-1 border-amber-300 bg-amber-50 text-amber-800'
              }
            >
              {statusFechamento}
            </Badge>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Última atualização: {new Date().toLocaleString('pt-BR')} · Responsável:{' '}
            {user?.name || user?.email || '—'}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
          {UNITS.map((u) => (
            <button
              key={u.value}
              onClick={() => setScale(u.value)}
              className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                scale === u.value ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {!resumo && (
        <Card className="border-slate-200">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Nenhum balancete importado ainda. Comece pela{' '}
            <Link to="/importar" className="font-medium text-petrol underline">
              importação de arquivos
            </Link>
            .
          </CardContent>
        </Card>
      )}

      {resumo && (
        <>
          {/* Cards de indicadores */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Ativo Total"
              value={resumo.ativoTotal}
              scale={scale}
              icon={Landmark}
              hint="Soma das linhas Ativo do BP"
            />
            <MetricCard
              label="Passivo Total"
              value={resumo.passivoTotal}
              scale={scale}
              icon={Scale}
              hint="Soma das linhas Passivo do BP"
            />
            <MetricCard
              label="Patrimônio Líquido"
              value={resumo.plTotal}
              scale={scale}
              icon={PiggyBank}
              hint="Contas de PL do balancete"
            />
            <MetricCard
              label="Receita Líquida"
              value={resumo.receitaLiquida}
              scale={scale}
              icon={Coins}
              hint="Linhas de Receita da DRE"
            />
            <MetricCard
              label="Resultado Líquido"
              value={resumo.resultadoLiquido}
              scale={scale}
              icon={resumo.resultadoLiquido >= 0 ? TrendingUp : TrendingDown}
              negativeIsBad
              hint="Linhas de Resultado da DRE"
            />
            <MetricCard
              label="Caixa e Equivalentes"
              value={resumo.caixaEquivalentes}
              scale={scale}
              icon={Wallet}
              hint="Conta 1.1.01 e equivalentes"
            />
          </div>

          {/* Qualidade contábil */}
          {qualidade && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-graphite">
                  <Activity className="h-4 w-4 text-petrol" /> Qualidade Contábil do Fechamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <QualityPill tone="ok" count={qualidade.aprovados} label="aprovados" />
                  <QualityPill tone="warn" count={qualidade.alertas} label="alertas" />
                  <QualityPill tone="block" count={qualidade.bloqueios} label="bloqueios" />
                  <span className="ml-auto text-xs text-slate-500">
                    Conclusão do fechamento:{' '}
                    <span className="font-semibold text-graphite tabular-nums">
                      {qualidade.percentual}%
                    </span>
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${qualidade.percentual}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Derivado da quadratura Ativo = Passivo + PL e da presença de receita, resultado e
                  caixa no período.
                </p>
                <Link
                  to="/conciliacao"
                  className="mt-2 inline-block text-xs font-medium text-petrol hover:underline"
                >
                  Abrir painel de conciliação →
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Gráficos */}
          {evolucao.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-graphite">
                    Evolução por período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={evolucao}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={chartTicker} tick={{ fontSize: 10 }} width={80} />
                      <ReTooltip formatter={(v: number) => formatValor(Number(v), scale)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="ativo"
                        name="Ativo"
                        stroke="#0b2545"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="receita"
                        name="Receita"
                        stroke="#155a80"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="resultado"
                        name="Resultado"
                        stroke="#12805c"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="caixa"
                        name="Caixa"
                        stroke="#b58a0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-graphite">
                    Comparativo entre períodos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={evolucao}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={chartTicker} tick={{ fontSize: 10 }} width={80} />
                      <ReTooltip formatter={(v: number) => formatValor(Number(v), scale)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ativo" name="Ativo" fill="#0b2545" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="receita" name="Receita" fill="#155a80" radius={[3, 3, 0, 0]} />
                      <Bar
                        dataKey="resultado"
                        name="Resultado"
                        fill="#12805c"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar dataKey="caixa" name="Caixa" fill="#b58a0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard

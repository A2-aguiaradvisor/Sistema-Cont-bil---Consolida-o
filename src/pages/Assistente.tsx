// Painel do Assistente Contábil (IA): recomendações de mapeamento/revisão contábil.
// Sem backend de IA ativo, exibe estado vazio honesto — nenhum dado fictício.

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { balancetesService, deparaService } from '@/services/accounting'
import type { BalanceteRecord, DeParaRecord } from '@/types/accounting'
import {
  Bot,
  CheckCircle2,
  CircleSlash,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  XCircle,
  RefreshCw,
  Filter,
  FileSpreadsheet,
  Info,
} from 'lucide-react'

type StatusSugestao = 'pendente' | 'aprovada' | 'rejeitada'
type StatusFiltro = 'todas' | 'pendente' | 'aprovada' | 'rejeitada'

/** Sugestão REAL derivada dos dados do PocketBase: conta sem mapeamento De-Para. */
export interface SugestaoMapeamento {
  chave: string
  conta: string
  descricao: string
  empresa: string
  periodo: string
  status: StatusSugestao
}

const StatusBadge: React.FC<{ status: StatusSugestao }> = ({ status }) => {
  const map = {
    pendente: { cls: 'bg-amber-50 text-amber-800 border-amber-300', label: 'Pendente' },
    aprovada: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Aprovada' },
    rejeitada: { cls: 'bg-slate-100 text-slate-600 border-slate-300', label: 'Rejeitada' },
  }[status]
  return (
    <Badge variant="outline" className={`text-[11px] ${map.cls}`}>
      {map.label}
    </Badge>
  )
}

const CardEmpty: React.FC = () => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-petrol/10">
        <Sparkles className="h-5 w-5 text-petrol" />
      </span>
      <div>
        <p className="text-sm font-medium text-graphite">
          Nenhuma recomendação do Assistente Contábil no momento
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500">
          O motor de IA ainda não está conectado a este ambiente — nenhum saldo ou sugestão é
          inventado aqui. Quando ativado, as recomendações de mapeamento e revisão aparecerão nesta
          lista com justificativa e botões de aprovação/rejeição.
        </p>
      </div>
      <Link to="/depara">
        <Button size="sm" variant="outline" className="text-xs">
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Gerenciar mapeamento manualmente
        </Button>
      </Link>
    </CardContent>
  </Card>
)

export const Assistente: React.FC = () => {
  const [rows, setRows] = useState<BalanceteRecord[]>([])
  const [depara, setDepara] = useState<DeParaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<StatusFiltro>('todas')
  const [decisoes, setDecisoes] = useState<Record<string, StatusSugestao>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [bal, dep] = await Promise.all([balancetesService.listAll(), deparaService.listAll()])
      setRows(bal)
      setDepara(dep)
    } catch (e) {
      console.error(e)
      setError('Não foi possível carregar os dados do PocketBase.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Deriva sugestões REAIS (PocketBase): contas do balancete sem linha_bp/linha_dre no De-Para.
  const sugestoes: SugestaoMapeamento[] = useMemo(() => {
    const mapeadas = new Set(depara.map((d) => d.conta.trim()))
    const vistos = new Map<string, SugestaoMapeamento>()
    for (const r of rows) {
      const conta = r.conta?.trim()
      if (!conta || mapeadas.has(conta)) continue
      const chave = `${r.empresa}|${conta}`
      if (vistos.has(chave)) continue
      vistos.set(chave, {
        chave,
        conta,
        descricao: r.descricao || '',
        empresa: r.empresa,
        periodo: r.periodo,
        status: decisoes[chave] ?? 'pendente',
      })
    }
    return Array.from(vistos.values()).sort((a, b) => a.conta.localeCompare(b.conta))
  }, [rows, depara, decisoes])

  const contagem = useMemo(
    () => ({
      todas: sugestoes.length,
      pendente: sugestoes.filter((s) => s.status === 'pendente').length,
      aprovada: sugestoes.filter((s) => s.status === 'aprovada').length,
      rejeitada: sugestoes.filter((s) => s.status === 'rejeitada').length,
    }),
    [sugestoes],
  )

  const filtradas = useMemo(
    () => (filtro === 'todas' ? sugestoes : sugestoes.filter((s) => s.status === filtro)),
    [sugestoes, filtro],
  )

  const decidir = (chave: string, status: StatusSugestao) =>
    setDecisoes((prev) => ({ ...prev, [chave]: status }))

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
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

  const totalPendentes = contagem.pendente

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-graphite flex items-center gap-2">
            <Bot className="h-5 w-5 text-petrol" /> Assistente Contábil (IA)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Recomendações de mapeamento e revisão contábil para o Grupo ABC
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      {/* Faixa informativa: motor de IA não conectado */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-petrol" />
          <div className="text-xs text-slate-600">
            <p className="font-medium text-graphite">Sobre este painel</p>
            <p className="mt-1 text-slate-500">
              As recomendações abaixo são derivadas{' '}
              <span className="font-medium">dos seus dados reais</span> (contas do balancete ainda
              sem mapeamento De-Para), não de IA. A integração com o motor de inteligência
              artificial está pendente e, enquanto isso, nenhuma sugestão automática é simulada.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estado vazio honesto: nada a recomendar */}
      {sugestoes.length === 0 && <CardEmpty />}

      {sugestoes.length > 0 && (
        <>
          {/* Filtros por status */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            {(
              [
                ['todas', 'Todas'],
                ['pendente', 'Pendentes'],
                ['aprovada', 'Aprovadas'],
                ['rejeitada', 'Rejeitadas'],
              ] as [StatusFiltro, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFiltro(value)}
                className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                  filtro === value
                    ? 'border-navy bg-navy text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label} ({contagem[value]})
              </button>
            ))}
          </div>

          {/* Lista de sugestões */}
          {filtradas.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-10 text-center text-sm text-slate-500">
                Nenhuma sugestão com status “{filtro}”.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtradas.map((s) => (
                <Card key={s.chave} className="border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-graphite">
                        <span className="font-mono text-[13px]">{s.conta}</span>
                        <StatusBadge status={s.status} />
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.descricao || 'Sem descrição'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {s.empresa || '—'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {s.periodo || '—'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Justificativa honesta: vem dos dados, não de IA */}
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                      <p className="font-medium">Justificativa da recomendação</p>
                      <p className="mt-0.5">
                        Esta conta está no balancete importado ({s.empresa} · {s.periodo}) mas não
                        possui mapeamento De-Para cadastrado — impacta as linhas do BP/DRE e a
                        consolidação do grupo.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="text-xs"
                        disabled={s.status === 'aprovada'}
                        onClick={() => decidir(s.chave, 'aprovada')}
                      >
                        <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        disabled={s.status === 'rejeitada'}
                        onClick={() => decidir(s.chave, 'rejeitada')}
                      >
                        <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                        Rejeitar
                      </Button>
                      {s.status === 'rejeitada' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <CircleSlash className="h-3 w-3" /> Sugerida ignorada nesta sessão
                        </span>
                      )}
                      {s.status === 'aprovada' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Aprovada nesta sessão
                        </span>
                      )}
                      <Link
                        to="/depara"
                        className="ml-auto text-[11px] font-medium text-petrol hover:underline"
                      >
                        Abrir De-Para →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {totalPendentes > 0 && (
                <p className="text-[11px] text-slate-400">
                  {totalPendentes} pendente(s) · aprovações desta sessão não persistem até a
                  integração do motor de IA — nenhuma alteração é gravada no PocketBase por aqui.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Assistente

import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { balancetesService, eliminacoesService, deparaService } from '@/services/accounting'
import type { BalanceteRecord, EliminacaoRecord } from '@/types/accounting'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Scale,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  ArrowRight,
  SlidersHorizontal,
  UploadCloud,
  FileCheck2,
  Info,
} from 'lucide-react'

export const Dashboard: React.FC = () => {
  const [periodo, setPeriodo] = useState<string>('Dez/25')
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([])
  const [balancetes, setBalancetes] = useState<BalanceteRecord[]>([])
  const [eliminacoes, setEliminacoes] = useState<EliminacaoRecord[]>([])
  const [deparaCount, setDeparaCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [allPeriodos, allBalancetes, allElims, allDepara] = await Promise.all([
        balancetesService.listPeriodos(),
        balancetesService.listAll(),
        eliminacoesService.listByPeriodo(periodo),
        deparaService.listAll(),
      ])
      setPeriodosDisponiveis(allPeriodos)
      if (allPeriodos.length > 0 && !allPeriodos.includes(periodo)) {
        setPeriodo(allPeriodos[0])
      }
      setBalancetes(allBalancetes)
      setEliminacoes(allElims)
      setDeparaCount(allDepara.length)
    } catch (e) {
      console.error('Erro ao carregar dados do dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    eliminacoesService.listByPeriodo(periodo).then(setEliminacoes).catch(console.error)
  }, [periodo])

  // Filtrar balancetes do período selecionado
  const balancetesPeriodo = useMemo(() => {
    return balancetes.filter((b) => b.periodo === periodo)
  }, [balancetes, periodo])

  const empresasPeriodo = useMemo(() => {
    return Array.from(new Set(balancetesPeriodo.map((b) => b.empresa)))
  }, [balancetesPeriodo])

  // Cálculo de Ativo, Passivo, PL e Consolidação
  const metricas = useMemo(() => {
    let totalAtivoAlfa = 0
    let totalPassivoAlfa = 0
    let totalPLAlfa = 0

    let totalAtivoCombinado = 0
    let totalPassivoCombinado = 0
    let totalPLCombinado = 0

    // Soma das linhas do balanço
    for (const b of balancetesPeriodo) {
      const contaPrimeiroDigito = b.conta.trim()[0]
      const val = Number(b.saldo) || 0

      // Ativo (grupo 1)
      if (contaPrimeiroDigito === '1') {
        totalAtivoCombinado += val
        if (b.empresa.toUpperCase() === 'ALFA') {
          totalAtivoAlfa += val
        }
      }
      // Passivo Circulante e Não Circulante (grupo 2.1, 2.2, 2.3)
      else if (
        b.conta.startsWith('2.1') ||
        b.conta.startsWith('2.2') ||
        b.conta.startsWith('2.3')
      ) {
        totalPassivoCombinado += val
        if (b.empresa.toUpperCase() === 'ALFA') {
          totalPassivoAlfa += val
        }
      }
      // Patrimônio Líquido (grupo 2.4)
      else if (b.conta.startsWith('2.4') || b.conta.startsWith('2.5')) {
        totalPLCombinado += val
        if (b.empresa.toUpperCase() === 'ALFA') {
          totalPLAlfa += val
        }
      }
    }

    // Impacto das eliminações em Ativo e Passivo/PL
    let elimAtivo = 0
    let elimPassivoPL = 0

    for (const el of eliminacoes) {
      if (el.tipo_quadro === 'BP') {
        // Se a eliminação reduz ativo
        if (
          el.linha_balanco.includes('Realizável') ||
          el.linha_balanco.includes('Investimento') ||
          el.linha_balanco.includes('Ativo') ||
          el.linha_balanco.includes('Caixa') ||
          el.linha_balanco.includes('Clientes')
        ) {
          elimAtivo += Number(el.valor) || 0
        } else {
          elimPassivoPL += Number(el.valor) || 0
        }
      }
    }

    const ativoConsolidado = totalAtivoCombinado + elimAtivo
    const passivoConsolidado = totalPassivoCombinado + elimPassivoPL
    const plConsolidado = totalPLCombinado
    const passivoMaisPL = passivoConsolidado + plConsolidado

    const diferencaQuadratura = Math.abs(ativoConsolidado - passivoMaisPL)
    const isQuadrado = diferencaQuadratura < 0.05 // tolerância de centavos

    return {
      totalAtivoCombinado,
      totalPassivoCombinado,
      totalPLCombinado,
      ativoConsolidado,
      passivoConsolidado,
      plConsolidado,
      passivoMaisPL,
      diferencaQuadratura,
      isQuadrado,
      totalAtivoAlfa,
      totalPassivoAlfa,
      totalPLAlfa,
    }
  }, [balancetesPeriodo, eliminacoes])

  const formatMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Header do Dashboard com Seletor de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Painel Geral de Consolidação
            <Badge variant="secondary" className="font-mono text-xs">
              {periodo}
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Demonstrações consolidadas do Grupo ABC (Empresas:{' '}
            {empresasPeriodo.join(', ') || 'Nenhuma'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período Ativo:</span>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[140px] h-9 text-xs font-semibold">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {periodosDisponiveis.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link to="/importar">
              <UploadCloud className="h-4 w-4 mr-1.5" />
              Nova Importação
            </Link>
          </Button>
        </div>
      </div>

      {/* Banner de Status da Quadratura Contábil */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-all ${
          metricas.isQuadrado
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              metricas.isQuadrado ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {metricas.isQuadrado ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm sm:text-base">
                {metricas.isQuadrado
                  ? 'Quadratura do Balanço Aprovada (Ativo = Passivo + PL)'
                  : 'Atenção: Balanço Desbalanceado no Período'}
              </h2>
              <Badge
                variant={metricas.isQuadrado ? 'default' : 'destructive'}
                className="text-[11px] uppercase tracking-wider"
              >
                {metricas.isQuadrado ? 'CHECK OK' : 'DIFERENÇA'}
              </Badge>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {metricas.isQuadrado
                ? `A consolidação contábil do período ${periodo} fecha perfeitamente em ${formatMoeda(metricas.ativoConsolidado)}.`
                : `Diferença encontrada de ${formatMoeda(metricas.diferencaQuadratura)}. Revise as contas importadas ou lançamentos de eliminação.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            asChild
            size="sm"
            variant={metricas.isQuadrado ? 'secondary' : 'default'}
            className="text-xs"
          >
            <Link to="/balanco-consolidado">
              <Scale className="h-4 w-4 mr-1.5" />
              Ver Balanço Completo
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="text-xs bg-white/70">
            <Link to="/eliminacoes">
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              Eliminações ({eliminacoes.length})
            </Link>
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ativo Total */}
        <Card className="border shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ativo Total Consolidado
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {formatMoeda(metricas.ativoConsolidado)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Combinado: {formatMoeda(metricas.totalAtivoCombinado)}</span>
              <span className="text-blue-700 font-medium">Balanço</span>
            </p>
          </CardContent>
        </Card>

        {/* Passivo Total */}
        <Card className="border shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Passivo Exigível Consolidado
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {formatMoeda(metricas.passivoConsolidado)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Circulante + Não Circulante</span>
              <span className="text-rose-700 font-medium">Passivo</span>
            </p>
          </CardContent>
        </Card>

        {/* Patrimônio Líquido */}
        <Card className="border shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Patrimônio Líquido (PL)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {formatMoeda(metricas.plConsolidado)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Capital + Reservas + Lucros</span>
              <span className="text-emerald-700 font-medium">PL</span>
            </p>
          </CardContent>
        </Card>

        {/* Passivo + PL Total */}
        <Card className="border shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Passivo + PL
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {formatMoeda(metricas.passivoMaisPL)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
              <span>Quadratura com Ativo:</span>
              <span
                className={
                  metricas.isQuadrado
                    ? 'text-emerald-600 font-semibold'
                    : 'text-amber-600 font-semibold'
                }
              >
                {metricas.isQuadrado ? 'R$ 0,00' : formatMoeda(metricas.diferencaQuadratura)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção Informativa de Módulos e Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="md:col-span-2 border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Resumo Contábil por Empresa no Período ({periodo})
                </CardTitle>
                <CardDescription className="text-xs">
                  Valores antes das eliminações intercompany
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {empresasPeriodo.length} Empresa(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b text-muted-foreground uppercase font-medium text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3 text-right">Ativo</th>
                    <th className="py-2.5 px-3 text-right">Passivo</th>
                    <th className="py-2.5 px-3 text-right">PL</th>
                    <th className="py-2.5 px-3 text-right">Passivo + PL</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {empresasPeriodo.map((emp) => {
                    const linhasEmp = balancetesPeriodo.filter((b) => b.empresa === emp)
                    let atv = 0
                    let pas = 0
                    let pl = 0
                    for (const l of linhasEmp) {
                      const dig = l.conta.trim()[0]
                      const s = Number(l.saldo) || 0
                      if (dig === '1') atv += s
                      else if (
                        l.conta.startsWith('2.1') ||
                        l.conta.startsWith('2.2') ||
                        l.conta.startsWith('2.3')
                      )
                        pas += s
                      else if (l.conta.startsWith('2.4') || l.conta.startsWith('2.5')) pl += s
                    }
                    const totalP_PL = pas + pl
                    const diff = Math.abs(atv - totalP_PL)
                    const ok = diff < 0.05
                    return (
                      <tr key={emp} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          {emp}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatMoeda(atv)}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatMoeda(pas)}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatMoeda(pl)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                          {formatMoeda(totalP_PL)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                              ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {ok ? 'Fechado' : `Dif: ${formatMoeda(diff)}`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {empresasPeriodo.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        Nenhum balancete importado para o período {periodo}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Card lateral de Ações e De-Para */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Mapeamento De-Para
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contas cadastradas:</span>
                <span className="font-bold text-foreground text-sm">{deparaCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                As contas de balancete são amarradas às linhas estruturais de BP e DRE para
                consolidação automática.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full text-xs">
                <Link to="/depara">
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                  Gerenciar De-Para
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase text-primary tracking-wider flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                DRE Consolidada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Visualize a Demonstração do Resultado Consolidada (ROL, Custos, Despesas e Lucro
                Líquido) com comparativo entre períodos.
              </p>
              <Button asChild size="sm" className="w-full text-xs">
                <Link to="/dre">
                  Acessar DRE Consolidada
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default Dashboard

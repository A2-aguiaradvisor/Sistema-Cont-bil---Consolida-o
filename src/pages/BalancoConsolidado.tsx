import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { balancetesService, deparaService, eliminacoesService } from '@/services/accounting'
import type { BalanceteRecord, DeParaRecord, EliminacaoRecord } from '@/types/accounting'
import { montarBalanco, type GrupoBalanco } from '@/lib/balanco'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Scale, Download, CheckCircle2, AlertTriangle, RefreshCw, ListChecks } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const formatMoeda = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export const BalancoConsolidado: React.FC = () => {
  const [periodoAtual, setPeriodoAtual] = useState<string>('')
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([])
  const [balancetes, setBalancetes] = useState<BalanceteRecord[]>([])
  const [depara, setDepara] = useState<DeParaRecord[]>([])
  const [eliminacoes, setEliminacoes] = useState<EliminacaoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [allBalancetes, allDepara, allElims, pers] = await Promise.all([
        balancetesService.listAll(),
        deparaService.listAll(),
        eliminacoesService.listAll(),
        balancetesService.listPeriodos(),
      ])
      setBalancetes(allBalancetes)
      setDepara(allDepara)
      setEliminacoes(allElims)
      setPeriodosDisponiveis(pers)
      setPeriodoAtual((ant) => (ant && pers.includes(ant) ? ant : (pers[0] ?? '')))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const quadro = useMemo(
    () => montarBalanco(balancetes, depara, eliminacoes, periodoAtual),
    [balancetes, depara, eliminacoes, periodoAtual],
  )

  const totalAtivo = quadro.check.totalAtivo
  const totalPassivoPL = quadro.check.totalPassivoPL

  // Exportar Balanço em CSV
  const handleExportCSV = () => {
    let csv = 'Grupo;Linha;Combinado;Eliminacao;Consolidado\n'
    const secao = (g: GrupoBalanco) => {
      for (const l of g.linhas) {
        csv += `"${g.grupo}";"${l.linha}";${l.combinado.toFixed(2)};${l.eliminacao.toFixed(2)};${l.consolidado.toFixed(2)}\n`
      }
      csv += `"${g.grupo}";"TOTAL ${g.grupo}";${g.totalCombinado.toFixed(2)};${g.totalEliminacao.toFixed(2)};${g.totalConsolidado.toFixed(2)}\n`
    }
    quadro.ativo.forEach(secao)
    quadro.passivoPL.forEach(secao)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balanco_patrimonial_consolidado_${periodoAtual || 'geral'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderGrupo = (g: GrupoBalanco) => (
    <React.Fragment key={g.grupo}>
      <TableRow className="bg-muted/40 font-semibold border-t border-b">
        <TableCell
          colSpan={4}
          className="py-2 px-4 uppercase text-[11px] tracking-wide text-primary"
        >
          {g.grupo}
        </TableCell>
      </TableRow>
      {g.linhas.map((l) => (
        <TableRow key={l.linha} className="hover:bg-muted/30 transition-colors">
          <TableCell className="py-2 px-4 pl-8 max-w-[320px] truncate text-xs">{l.linha}</TableCell>
          <TableCell className="py-2 px-3 text-right font-mono text-xs text-slate-700">
            {l.combinado ? formatMoeda(l.combinado) : '—'}
          </TableCell>
          <TableCell className="py-2 px-3 text-right font-mono text-xs">
            <span
              className={
                l.eliminacao < 0
                  ? 'text-rose-600'
                  : l.eliminacao > 0
                    ? 'text-blue-600'
                    : 'text-muted-foreground'
              }
            >
              {l.eliminacao ? formatMoeda(l.eliminacao) : '—'}
            </span>
          </TableCell>
          <TableCell className="py-2 px-3 text-right font-mono text-xs font-semibold bg-primary/5">
            {l.consolidado ? formatMoeda(l.consolidado) : '—'}
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="font-semibold bg-muted/20">
        <TableCell className="py-2 px-4 pl-8 text-xs uppercase">Total {g.grupo}</TableCell>
        <TableCell className="py-2 px-3 text-right font-mono text-xs">
          {formatMoeda(g.totalCombinado)}
        </TableCell>
        <TableCell className="py-2 px-3 text-right font-mono text-xs">
          {formatMoeda(g.totalEliminacao)}
        </TableCell>
        <TableCell className="py-2 px-3 text-right font-mono text-xs font-bold bg-primary/5">
          {formatMoeda(g.totalConsolidado)}
        </TableCell>
      </TableRow>
    </React.Fragment>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" aria-hidden />
            Balanço Patrimonial Consolidado
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Soma dos saldos do balancete pelas LinhasBP do De-Para, com eliminações do período —
            nenhum valor digitado: tudo calculado do banco.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            <Select value={periodoAtual} onValueChange={setPeriodoAtual}>
              <SelectTrigger
                className="w-[130px] h-9 text-xs font-semibold"
                aria-label="Período do balanço"
              >
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
          <Button size="sm" variant="outline" onClick={carregarDados} className="text-xs">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs">
            <Download className="h-4 w-4 mr-1.5" /> Baixar em CSV
          </Button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {/* Faixa de Quadratura do Balanço — CHECK real, calculado dos dados */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          quadro.check.quadrado
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}
        role="status"
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              quadro.check.quadrado ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
            aria-hidden
          >
            {quadro.check.quadrado ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm">
                CHECK Ativo = Passivo + PL:{' '}
                {quadro.check.quadrado
                  ? 'fechado'
                  : `divergência de ${formatMoeda(quadro.check.diferenca)}`}
              </span>
              <Badge
                variant={quadro.check.quadrado ? 'default' : 'destructive'}
                className="text-[10px]"
              >
                {quadro.check.quadrado ? 'QUADRADO' : 'CONFERIR'}
              </Badge>
            </div>
            <p className="text-[11px] opacity-90">
              Ativo Consolidado: {formatMoeda(totalAtivo)} | Passivo + PL:{' '}
              {formatMoeda(totalPassivoPL)}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground self-end sm:self-auto font-mono">
          Calculado de: balancetes × depara × eliminacoes
        </div>
      </div>

      {/* Contas de ajuste (29999999...) exibidas separadamente */}
      {quadro.ajustes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" aria-hidden /> Ajustes fora do balanço (
              {quadro.ajustes.length})
            </CardTitle>
            <CardDescription className="text-xs text-amber-800">
              Lançamentos de ajuste (conta{' '}
              {quadro.ajustes[0]?.conta.startsWith('29999999') ? '29999999' : 'de ajuste'} —
              resultado já apropriado no PL), excluídos da soma do balanço:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {quadro.ajustes.map((a, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="font-mono">
                  {a.empresa} · {a.conta} — {a.descricao}
                </span>
                <span className="font-mono font-semibold">{formatMoeda(a.saldo)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contas sem mapeamento no De-Para */}
      {quadro.semMapeamento.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
              <ListChecks className="h-4 w-4" aria-hidden /> Contas sem mapeamento (
              {quadro.semMapeamento.length})
            </CardTitle>
            <CardDescription className="text-xs text-blue-800">
              Estas contas do balancete não têm LinhaBP no De-Para e por isso ficam fora do quadro —
              classifique-as na tela De-Para para entrarem no balanço.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-40 overflow-y-auto">
            {quadro.semMapeamento.map((a, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="font-mono">
                  {a.empresa} · {a.conta} — {a.descricao}
                </span>
                <span className="font-mono">{formatMoeda(a.saldo)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela do Balanço Consolidado */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <caption className="sr-only">
                Balanço patrimonial consolidado do período {periodoAtual || '—'} com colunas
                combinado, eliminação e consolidado
              </caption>
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-semibold border-b">
                <tr>
                  <th scope="col" className="py-3 px-4 min-w-[280px]">
                    Linha do Balanço
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Combinado
                  </th>
                  <th scope="col" className="py-3 px-3 text-right">
                    Eliminação
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-right font-bold text-foreground bg-primary/5"
                  >
                    Consolidado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quadro.ativo.map(renderGrupo)}
                {quadro.passivoPL.map(renderGrupo)}
                <TableRow className="bg-slate-100/90 font-bold border-t-2">
                  <TableCell className="py-2.5 px-4 uppercase text-[11px] tracking-wide">
                    Total do Ativo
                  </TableCell>
                  <TableCell colSpan={2} className="py-2.5 px-3 text-right font-mono">
                    {formatMoeda(totalAtivo)}
                  </TableCell>
                  <TableCell className="py-2.5 px-3" />
                </TableRow>
                <TableRow className="bg-slate-100/90 font-bold border-b-2">
                  <TableCell className="py-2.5 px-4 uppercase text-[11px] tracking-wide">
                    Total do Passivo + PL
                  </TableCell>
                  <TableCell colSpan={2} className="py-2.5 px-3 text-right font-mono">
                    {formatMoeda(totalPassivoPL)}
                  </TableCell>
                  <TableCell className="py-2.5 px-3" />
                </TableRow>
                {quadro.ativo.length === 0 && quadro.passivoPL.length === 0 && !loading && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground text-xs"
                    >
                      Nenhuma linha a exibir. Importe um balancete e o De-Para (com LinhaBP) para
                      montar o balanço do período {periodoAtual || '—'}.
                    </TableCell>
                  </TableRow>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {loading && <p className="text-xs text-muted-foreground">Carregando dados do banco…</p>}
    </div>
  )
}
export default BalancoConsolidado

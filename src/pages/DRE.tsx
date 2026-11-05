import React, { useEffect, useState, useMemo } from 'react'
import { balancetesService, estruturaService, eliminacoesService } from '@/services/accounting'
import type { BalanceteRecord, EstruturaBalancoRecord, EliminacaoRecord } from '@/types/accounting'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Download, Building2, Percent, CheckCircle2, ArrowRight } from 'lucide-react'

export const DRE: React.FC = () => {
  const [periodoAtual, setPeriodoAtual] = useState<string>('Dez/25')
  const [periodoAnterior, setPeriodoAnterior] = useState<string>('Dez/24')
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([])

  const [balancetes, setBalancetes] = useState<BalanceteRecord[]>([])
  const [estruturaDRE, setEstruturaDRE] = useState<EstruturaBalancoRecord[]>([])
  const [eliminacoesDRE, setEliminacoesDRE] = useState<EliminacaoRecord[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [allBalancetes, dre, pers, elims] = await Promise.all([
        balancetesService.listAll(),
        estruturaService.listAll('DRE'),
        balancetesService.listPeriodos(),
        eliminacoesService.listByPeriodo(periodoAtual, 'DRE'),
      ])
      setBalancetes(allBalancetes)
      setEstruturaDRE(dre)
      setPeriodosDisponiveis(pers)
      setEliminacoesDRE(elims)

      if (pers.length >= 2 && !pers.includes(periodoAnterior)) {
        setPeriodoAnterior(pers.find((p) => p !== periodoAtual) || pers[1])
      }
    } catch (e) {
      console.error('Erro ao carregar dados da DRE:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    eliminacoesDREService()
  }, [periodoAtual])

  const eliminacoesDREService = async () => {
    try {
      const elims = await eliminacoesService.listByPeriodo(periodoAtual, 'DRE')
      setEliminacoesDRE(elims)
    } catch (e) {
      console.error(e)
    }
  }

  // Apuração das linhas da DRE:
  // Receita Bruta, Deduções, ROL, CPV/CMV, Lucro Bruto, Despesas Operacionais, EBITDA, Resultado Fin, LAIR, Impostos, Lucro Líquido
  const quadroDRE = useMemo(() => {
    const balancetesAtual = balancetes.filter((b) => b.periodo === periodoAtual)
    const balancetesAnt = balancetes.filter((b) => b.periodo === periodoAnterior)

    const mapaAtual = new Map<string, number>()
    const mapaAnt = new Map<string, number>()

    for (const b of balancetesAtual) {
      const l = b.linha_dre?.trim()
      if (!l) continue
      const v = Number(b.saldo) || 0
      mapaAtual.set(l, (mapaAtual.get(l) || 0) + v)
    }

    for (const b of balancetesAnt) {
      const l = b.linha_dre?.trim()
      if (!l) continue
      const v = Number(b.saldo) || 0
      mapaAnt.set(l, (mapaAnt.get(l) || 0) + v)
    }

    // Mapa de Eliminações de Resultado
    const mapaElim = new Map<string, number>()
    for (const el of eliminacoesDRE) {
      const l = el.linha_balanco?.trim()
      if (!l) continue
      mapaElim.set(l, (mapaElim.get(l) || 0) + (Number(el.valor) || 0))
    }

    // Valores analíticos
    const rbAtual = mapaAtual.get('Receita Bruta de Vendas e Serviços') || 0
    const dedAtual = mapaAtual.get('Deduções da Receita Bruta e Abatimentos') || 0
    const rolAtual = rbAtual - dedAtual

    const cmvAtual = mapaAtual.get('Custo dos Produtos e Serviços Vendidos (CPV/CMV)') || 0
    const lbAtual = rolAtual - cmvAtual

    const despComAtual = mapaAtual.get('Despesas Comerciais e de Vendas') || 0
    const despAdmAtual = mapaAtual.get('Despesas Gerais e Administrativas') || 0
    const outrasOpAtual = mapaAtual.get('Outras Receitas e Despesas Operacionais') || 0
    const ebitdaAtual = lbAtual - despComAtual - despAdmAtual + outrasOpAtual

    const recFinAtual = mapaAtual.get('Receitas Financeiras') || 0
    const despFinAtual = mapaAtual.get('Despesas Financeiras') || 0
    const resFinAtual = recFinAtual - despFinAtual
    const lairAtual = ebitdaAtual + resFinAtual

    const irpjAtual = mapaAtual.get('Provisão para IRPJ e CSLL') || 0
    const lucroLiquidoAtual = lairAtual - irpjAtual

    // Valores do Comparativo Anterior
    const rbAnt = mapaAnt.get('Receita Bruta de Vendas e Serviços') || 0
    const dedAnt = mapaAnt.get('Deduções da Receita Bruta e Abatimentos') || 0
    const rolAnt = rbAnt - dedAnt

    const cmvAnt = mapaAnt.get('Custo dos Produtos e Serviços Vendidos (CPV/CMV)') || 0
    const lbAnt = rolAnt - cmvAnt

    const despComAnt = mapaAnt.get('Despesas Comerciais e de Vendas') || 0
    const despAdmAnt = mapaAnt.get('Despesas Gerais e Administrativas') || 0
    const outrasOpAnt = mapaAnt.get('Outras Receitas e Despesas Operacionais') || 0
    const ebitdaAnt = lbAnt - despComAnt - despAdmAnt + outrasOpAnt

    const recFinAnt = mapaAnt.get('Receitas Financeiras') || 0
    const despFinAnt = mapaAnt.get('Despesas Financeiras') || 0
    const resFinAnt = recFinAnt - despFinAnt
    const lairAnt = ebitdaAnt + resFinAnt

    const irpjAnt = mapaAnt.get('Provisão para IRPJ e CSLL') || 0
    const lucroLiquidoAnt = lairAnt - irpjAnt

    // Montar tabela estruturada
    const linhas = estruturaDRE.map((item) => {
      let valAtual = 0
      let valAnt = 0

      if (item.linha === 'Receita Bruta de Vendas e Serviços') {
        valAtual = rbAtual
        valAnt = rbAnt
      } else if (item.linha === 'Deduções da Receita Bruta e Abatimentos') {
        valAtual = -Math.abs(dedAtual)
        valAnt = -Math.abs(dedAnt)
      } else if (item.linha === 'RECEITA OPERACIONAL LÍQUIDA (ROL)') {
        valAtual = rolAtual
        valAnt = rolAnt
      } else if (item.linha === 'Custo dos Produtos e Serviços Vendidos (CPV/CMV)') {
        valAtual = -Math.abs(cmvAtual)
        valAnt = -Math.abs(cmvAnt)
      } else if (item.linha === 'LUCRO BRUTO') {
        valAtual = lbAtual
        valAnt = lbAnt
      } else if (item.linha === 'Despesas Comerciais e de Vendas') {
        valAtual = -Math.abs(despComAtual)
        valAnt = -Math.abs(despComAnt)
      } else if (item.linha === 'Despesas Gerais e Administrativas') {
        valAtual = -Math.abs(despAdmAtual)
        valAnt = -Math.abs(despAdmAnt)
      } else if (item.linha === 'Outras Receitas e Despesas Operacionais') {
        valAtual = outrasOpAtual
        valAnt = outrasOpAnt
      } else if (item.linha.includes('EBITDA')) {
        valAtual = ebitdaAtual
        valAnt = ebitdaAnt
      } else if (item.linha === 'Receitas Financeiras') {
        valAtual = recFinAtual
        valAnt = recFinAnt
      } else if (item.linha === 'Despesas Financeiras') {
        valAtual = -Math.abs(despFinAtual)
        valAnt = -Math.abs(despFinAnt)
      } else if (item.linha.includes('LAIR')) {
        valAtual = lairAtual
        valAnt = lairAnt
      } else if (item.linha === 'Provisão para IRPJ e CSLL') {
        valAtual = -Math.abs(irpjAtual)
        valAnt = -Math.abs(irpjAnt)
      } else if (item.linha.includes('LUCRO LÍQUIDO')) {
        valAtual = lucroLiquidoAtual
        valAnt = lucroLiquidoAnt
      } else {
        valAtual = mapaAtual.get(item.linha) || 0
        valAnt = mapaAnt.get(item.linha) || 0
      }

      // Variação % em relação à ROL (Análise Vertical)
      const avAtual = rolAtual > 0 ? (valAtual / rolAtual) * 100 : 0
      const avAnt = rolAnt > 0 ? (valAnt / rolAnt) * 100 : 0
      // Variação Horizontal (% de crescimento)
      const vh = valAnt !== 0 ? ((valAtual - valAnt) / Math.abs(valAnt)) * 100 : 0

      return {
        id: item.id,
        linha: item.linha,
        cod_nota: item.cod_nota,
        nivel: item.nivel,
        is_total: item.is_total,
        valAtual,
        valAnt,
        avAtual,
        avAnt,
        vh,
      }
    })

    return {
      linhas,
      rolAtual,
      lbAtual,
      ebitdaAtual,
      lucroLiquidoAtual,
      margemBruta: rolAtual > 0 ? (lbAtual / rolAtual) * 100 : 0,
      margemEbitda: rolAtual > 0 ? (ebitdaAtual / rolAtual) * 100 : 0,
      margemLiquida: rolAtual > 0 ? (lucroLiquidoAtual / rolAtual) * 100 : 0,
    }
  }, [balancetes, estruturaDRE, eliminacoesDRE, periodoAtual, periodoAnterior])

  const formatMoeda = (val: number) => {
    if (val === 0) return 'R$ 0'
    const sign = val < 0 ? '-' : ''
    const absVal = Math.abs(val)
    return `${sign}${new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absVal)}`
  }

  // Exportar DRE em CSV
  const handleExportCSV = () => {
    let csv = `Linha da DRE;Nota;${periodoAtual} (R$);AV % (${periodoAtual});${periodoAnterior} (R$);AV % (${periodoAnterior});Var Horiz %\n`
    for (const r of quadroDRE.linhas) {
      csv += `"${r.linha}";"${r.cod_nota || ''}";${r.valAtual};${r.avAtual.toFixed(1)}%;${r.valAnt};${r.avAnt.toFixed(1)}%;${r.vh.toFixed(1)}%\n`
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dre_consolidada_${periodoAtual.replace('/', '-')}_vs_${periodoAnterior.replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Demonstração do Resultado (DRE Consolidada)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Apuração de Receitas, Custos, Margens e Lucro Líquido consolidado com comparativo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            <Select value={periodoAtual} onValueChange={setPeriodoAtual}>
              <SelectTrigger className="w-[120px] h-9 text-xs font-semibold">
                <SelectValue />
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

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Comparar:</span>
            <Select value={periodoAnterior} onValueChange={setPeriodoAnterior}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue />
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

          <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs">
            <Download className="h-4 w-4 mr-1.5" />
            Baixar DRE em CSV
          </Button>
        </div>
      </div>

      {/* Margens de Desempenho Operacional */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Receita Operacional Líquida (ROL)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {formatMoeda(quadroDRE.rolAtual)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Base 100% da Análise Vertical
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Lucro Bruto Consolidado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {formatMoeda(quadroDRE.lbAtual)}
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <Percent className="h-3 w-3" /> Margem Bruta: {quadroDRE.margemBruta.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              EBITDA / Resultado Operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {formatMoeda(quadroDRE.ebitdaAtual)}
            </div>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
              <Percent className="h-3 w-3" /> Margem EBITDA: {quadroDRE.margemEbitda.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Lucro Líquido do Exercício
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-primary">
              {formatMoeda(quadroDRE.lucroLiquidoAtual)}
            </div>
            <p className="text-[11px] text-primary font-semibold mt-0.5 flex items-center gap-1">
              <Percent className="h-3 w-3" /> Margem Líquida: {quadroDRE.margemLiquida.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Estruturada da DRE */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4 min-w-[320px]">Demonstração do Resultado</th>
                  <th className="py-3 px-2 text-center w-14">Nota</th>
                  <th className="py-3 px-3 text-right bg-primary/5 font-bold text-foreground">
                    {periodoAtual}
                  </th>
                  <th className="py-3 px-2 text-right text-muted-foreground">AV %</th>
                  <th className="py-3 px-3 text-right text-muted-foreground">{periodoAnterior}</th>
                  <th className="py-3 px-2 text-right text-muted-foreground">AV %</th>
                  <th className="py-3 px-3 text-right text-muted-foreground">Var Horiz %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quadroDRE.linhas.map((row) => {
                  const isTotalMacro = row.nivel === 1
                  const isSubtotal = row.nivel === 2
                  const rowClass = isTotalMacro
                    ? 'bg-primary/10 font-bold text-primary border-t-2 border-b-2 border-primary/30 text-sm'
                    : isSubtotal
                      ? 'bg-muted/50 font-semibold text-foreground border-t border-b'
                      : 'hover:bg-muted/30 transition-colors'

                  return (
                    <tr key={row.id} className={rowClass}>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block ${
                            row.nivel === 3
                              ? 'pl-5 text-slate-700'
                              : row.nivel === 2
                                ? 'pl-1 uppercase'
                                : 'uppercase font-bold tracking-wide'
                          }`}
                        >
                          {row.linha}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted-foreground">
                        {row.cod_nota || ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold bg-primary/5">
                        {formatMoeda(row.valAtual)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-muted-foreground">
                        {row.avAtual !== 0 ? `${row.avAtual.toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {formatMoeda(row.valAnt)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-muted-foreground">
                        {row.avAnt !== 0 ? `${row.avAnt.toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                        {row.valAnt !== 0 ? (
                          <span
                            className={
                              row.vh > 0
                                ? 'text-emerald-700 font-semibold'
                                : row.vh < 0
                                  ? 'text-rose-700 font-semibold'
                                  : 'text-muted-foreground'
                            }
                          >
                            {row.vh > 0 ? `+${row.vh.toFixed(1)}%` : `${row.vh.toFixed(1)}%`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default DRE

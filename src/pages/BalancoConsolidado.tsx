import React, { useEffect, useState, useMemo } from 'react'
import { balancetesService, eliminacoesService, estruturaService } from '@/services/accounting'
import type { BalanceteRecord, EliminacaoRecord, EstruturaBalancoRecord } from '@/types/accounting'
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
import {
  Scale,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  RefreshCw,
} from 'lucide-react'

export const BalancoConsolidado: React.FC = () => {
  const [periodoAtual, setPeriodoAtual] = useState<string>('Dez/25')
  const [periodoAnterior, setPeriodoAnterior] = useState<string>('Dez/24')
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([])

  const [balancetes, setBalancetes] = useState<BalanceteRecord[]>([])
  const [eliminacoes, setEliminacoes] = useState<EliminacaoRecord[]>([])
  const [estruturaBP, setEstruturaBP] = useState<EstruturaBalancoRecord[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [allBalancetes, allElims, bp, pers] = await Promise.all([
        balancetesService.listAll(),
        eliminacoesService.listByPeriodo(periodoAtual, 'BP'),
        estruturaService.listAll('BP'),
        balancetesService.listPeriodos(),
      ])
      setBalancetes(allBalancetes)
      setEliminacoes(allElims)
      setEstruturaBP(bp)
      setPeriodosDisponiveis(pers)

      if (pers.length >= 2 && !pers.includes(periodoAnterior)) {
        setPeriodoAnterior(pers.find((p) => p !== periodoAtual) || pers[1])
      }
    } catch (e) {
      console.error('Erro ao carregar dados do Balanço Consolidado:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    eliminacoesService.listByPeriodo(periodoAtual, 'BP').then(setEliminacoes).catch(console.error)
  }, [periodoAtual])

  // Processamento do quadro com colunas: Linha, Nota, ALFA, Demais/Combinado, Eliminações, Consolidado, Período Anterior
  const quadroConsolidado = useMemo(() => {
    // Balancetes do período atual
    const balancetesAtual = balancetes.filter((b) => b.periodo === periodoAtual)
    // Balancetes do período anterior
    const balancetesAnt = balancetes.filter((b) => b.periodo === periodoAnterior)

    // Agrupar saldos por linha do BP
    // 1. Alfa Atual
    const mapaAlfa = new Map<string, number>()
    // 2. Combinado (Todas as empresas do grupo ABC no período atual)
    const mapaCombinado = new Map<string, number>()
    // 3. Demais empresas (Combinado - ALFA)
    const mapaOutras = new Map<string, number>()
    // 4. Período Anterior Consolidado
    const mapaAnterior = new Map<string, number>()

    for (const b of balancetesAtual) {
      const linha = b.linha_bp?.trim()
      if (!linha) continue
      const val = Number(b.saldo) || 0

      const atualComb = mapaCombinado.get(linha) || 0
      mapaCombinado.set(linha, atualComb + val)

      if (b.empresa.toUpperCase() === 'ALFA') {
        const atualAlfa = mapaAlfa.get(linha) || 0
        mapaAlfa.set(linha, atualAlfa + val)
      } else {
        const atualOutra = mapaOutras.get(linha) || 0
        mapaOutras.set(linha, atualOutra + val)
      }
    }

    for (const b of balancetesAnt) {
      const linha = b.linha_bp?.trim()
      if (!linha) continue
      const val = Number(b.saldo) || 0
      const atualAnt = mapaAnterior.get(linha) || 0
      mapaAnterior.set(linha, atualAnt + val)
    }

    // Mapa de Eliminações por linha
    const mapaElim = new Map<string, number>()
    for (const el of eliminacoes) {
      const linha = el.linha_balanco?.trim()
      if (!linha) continue
      const atualElim = mapaElim.get(linha) || 0
      mapaElim.set(linha, atualElim + (Number(el.valor) || 0))
    }

    // Montar linhas da estrutura
    // Também calculamos os subtotais e totais
    let sumAtivoCircAlfa = 0,
      sumAtivoCircComb = 0,
      sumAtivoCircElim = 0,
      sumAtivoCircCons = 0,
      sumAtivoCircAnt = 0
    let sumAtivoNaoCircAlfa = 0,
      sumAtivoNaoCircComb = 0,
      sumAtivoNaoCircElim = 0,
      sumAtivoNaoCircCons = 0,
      sumAtivoNaoCircAnt = 0

    let sumPassivoCircAlfa = 0,
      sumPassivoCircComb = 0,
      sumPassivoCircElim = 0,
      sumPassivoCircCons = 0,
      sumPassivoCircAnt = 0
    let sumPassivoNaoCircAlfa = 0,
      sumPassivoNaoCircComb = 0,
      sumPassivoNaoCircElim = 0,
      sumPassivoNaoCircCons = 0,
      sumPassivoNaoCircAnt = 0
    let sumPLAlfa = 0,
      sumPLComb = 0,
      sumPLElim = 0,
      sumPLCons = 0,
      sumPLAnt = 0

    const linhasCalculadas = estruturaBP.map((item) => {
      if (item.is_total) {
        // Retornará valor acumulado conforme o totalizador
        return {
          id: item.id,
          tipo: item.tipo,
          grupo: item.grupo,
          linha: item.linha,
          cod_nota: item.cod_nota,
          nivel: item.nivel,
          is_total: true,
          alfa: 0,
          combinado: 0,
          outras: 0,
          eliminacao: 0,
          consolidado: 0,
          anterior: 0,
        }
      }

      const valAlfa = mapaAlfa.get(item.linha) || 0
      const valComb = mapaCombinado.get(item.linha) || 0
      const valOutras = mapaOutras.get(item.linha) || 0
      const valElim = mapaElim.get(item.linha) || 0
      const valConsolidado = valComb + valElim
      const valAnterior = mapaAnterior.get(item.linha) || 0

      // Acumular conforme grupo
      if (item.grupo === 'ATIVO CIRCULANTE') {
        sumAtivoCircAlfa += valAlfa
        sumAtivoCircComb += valComb
        sumAtivoCircElim += valElim
        sumAtivoCircCons += valConsolidado
        sumAtivoCircAnt += valAnterior
      } else if (item.grupo === 'ATIVO NÃO CIRCULANTE') {
        sumAtivoNaoCircAlfa += valAlfa
        sumAtivoNaoCircComb += valComb
        sumAtivoNaoCircElim += valElim
        sumAtivoNaoCircCons += valConsolidado
        sumAtivoNaoCircAnt += valAnterior
      } else if (item.grupo === 'PASSIVO CIRCULANTE') {
        sumPassivoCircAlfa += valAlfa
        sumPassivoCircComb += valComb
        sumPassivoCircElim += valElim
        sumPassivoCircCons += valConsolidado
        sumPassivoCircAnt += valAnterior
      } else if (item.grupo === 'PASSIVO NÃO CIRCULANTE') {
        sumPassivoNaoCircAlfa += valAlfa
        sumPassivoNaoCircComb += valComb
        sumPassivoNaoCircElim += valElim
        sumPassivoNaoCircCons += valConsolidado
        sumPassivoNaoCircAnt += valAnterior
      } else if (item.grupo === 'PATRIMÔNIO LÍQUIDO') {
        sumPLAlfa += valAlfa
        sumPLComb += valComb
        sumPLElim += valElim
        sumPLCons += valConsolidado
        sumPLAnt += valAnterior
      }

      return {
        id: item.id,
        tipo: item.tipo,
        grupo: item.grupo,
        linha: item.linha,
        cod_nota: item.cod_nota,
        nivel: item.nivel,
        is_total: false,
        alfa: valAlfa,
        combinado: valComb,
        outras: valOutras,
        eliminacao: valElim,
        consolidado: valConsolidado,
        anterior: valAnterior,
      }
    })

    // Atribuir subtotais aos itens marcados como is_total
    const totalAtivoCons = sumAtivoCircCons + sumAtivoNaoCircCons
    const totalPassivoMaisPLCons = sumPassivoCircCons + sumPassivoNaoCircCons + sumPLCons

    for (const linha of linhasCalculadas) {
      if (!linha.is_total) continue

      if (linha.linha.includes('ATIVO CIRCULANTE')) {
        linha.alfa = sumAtivoCircAlfa
        linha.combinado = sumAtivoCircComb
        linha.eliminacao = sumAtivoCircElim
        linha.consolidado = sumAtivoCircCons
        linha.anterior = sumAtivoCircAnt
      } else if (linha.linha.includes('ATIVO NÃO CIRCULANTE')) {
        linha.alfa = sumAtivoNaoCircAlfa
        linha.combinado = sumAtivoNaoCircComb
        linha.eliminacao = sumAtivoNaoCircElim
        linha.consolidado = sumAtivoNaoCircCons
        linha.anterior = sumAtivoNaoCircAnt
      } else if (linha.linha === 'TOTAL DO ATIVO') {
        linha.alfa = sumAtivoCircAlfa + sumAtivoNaoCircAlfa
        linha.combinado = sumAtivoCircComb + sumAtivoNaoCircComb
        linha.eliminacao = sumAtivoCircElim + sumAtivoNaoCircElim
        linha.consolidado = totalAtivoCons
        linha.anterior = sumAtivoCircAnt + sumAtivoNaoCircAnt
      } else if (linha.linha.includes('PASSIVO CIRCULANTE')) {
        linha.alfa = sumPassivoCircAlfa
        linha.combinado = sumPassivoCircComb
        linha.eliminacao = sumPassivoCircElim
        linha.consolidado = sumPassivoCircCons
        linha.anterior = sumPassivoCircAnt
      } else if (linha.linha.includes('PASSIVO NÃO CIRCULANTE')) {
        linha.alfa = sumPassivoNaoCircAlfa
        linha.combinado = sumPassivoNaoCircComb
        linha.eliminacao = sumPassivoNaoCircElim
        linha.consolidado = sumPassivoNaoCircCons
        linha.anterior = sumPassivoNaoCircAnt
      } else if (linha.linha.includes('PATRIMÔNIO LÍQUIDO')) {
        linha.alfa = sumPLAlfa
        linha.combinado = sumPLComb
        linha.eliminacao = sumPLElim
        linha.consolidado = sumPLCons
        linha.anterior = sumPLAnt
      } else if (linha.linha.includes('PASSIVO E PATRIMÔNIO LÍQUIDO')) {
        linha.alfa = sumPassivoCircAlfa + sumPassivoNaoCircAlfa + sumPLAlfa
        linha.combinado = sumPassivoCircComb + sumPassivoNaoCircComb + sumPLComb
        linha.eliminacao = sumPassivoCircElim + sumPassivoNaoCircElim + sumPLElim
        linha.consolidado = totalPassivoMaisPLCons
        linha.anterior = sumPassivoCircAnt + sumPassivoNaoCircAnt + sumPLAnt
      }
    }

    const diferencaQuadratura = Math.abs(totalAtivoCons - totalPassivoMaisPLCons)
    const isQuadrado = diferencaQuadratura < 0.05

    return {
      linhas: linhasCalculadas,
      totalAtivoCons,
      totalPassivoMaisPLCons,
      diferencaQuadratura,
      isQuadrado,
    }
  }, [balancetes, eliminacoes, estruturaBP, periodoAtual, periodoAnterior])

  const formatMoeda = (val: number) => {
    if (val === 0) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Exportar Balanço em CSV
  const handleExportCSV = () => {
    let csv = `Linha do Balanço Patrimonial;Nota;ALFA (${periodoAtual});Combinado (${periodoAtual});Eliminações;Consolidado (${periodoAtual});Comparativo (${periodoAnterior})\n`
    for (const r of quadroConsolidado.linhas) {
      csv += `"${r.linha}";"${r.cod_nota || ''}";${r.alfa};${r.combinado};${r.eliminacao};${r.consolidado};${r.anterior}\n`
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balanco_patrimonial_consolidado_${periodoAtual.replace('/', '-')}_vs_${periodoAnterior.replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Balanço Patrimonial Consolidado
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quadro comparativo com colunas ALFA, Combinado, Eliminações, Consolidado e Período
            Anterior
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período Base:</span>
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
            <span className="text-xs font-medium text-muted-foreground">Comparar com:</span>
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
            Baixar em CSV
          </Button>
        </div>
      </div>

      {/* Faixa de Quadratura do Balanço */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          quadroConsolidado.isQuadrado
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/90 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              quadroConsolidado.isQuadrado ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {quadroConsolidado.isQuadrado ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm">
                Conferência de Quadratura:{' '}
                {quadroConsolidado.isQuadrado ? 'Ativo = Passivo + PL (OK)' : 'Divergência'}
              </span>
              <Badge
                variant={quadroConsolidado.isQuadrado ? 'default' : 'destructive'}
                className="text-[10px]"
              >
                {quadroConsolidado.isQuadrado ? 'QUADRADO' : 'AJUSTE NECESSÁRIO'}
              </Badge>
            </div>
            <p className="text-[11px] opacity-90">
              Ativo Consolidado: {formatMoeda(quadroConsolidado.totalAtivoCons)} | Passivo + PL:{' '}
              {formatMoeda(quadroConsolidado.totalPassivoMaisPLCons)}
              {!quadroConsolidado.isQuadrado &&
                ` (Diferença: ${formatMoeda(quadroConsolidado.diferencaQuadratura)})`}
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground self-end sm:self-auto font-mono">
          Grupo ABC — CPC 36 Consolidação
        </div>
      </div>

      {/* Tabela do Balanço Consolidado */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-semibold border-b">
                <tr>
                  <th className="py-3 px-4 min-w-[280px]">Balanço Patrimonial</th>
                  <th className="py-3 px-2 text-center w-14">Nota</th>
                  <th className="py-3 px-3 text-right">ALFA ({periodoAtual})</th>
                  <th className="py-3 px-3 text-right">Combinado</th>
                  <th className="py-3 px-3 text-right">Eliminações</th>
                  <th className="py-3 px-3 text-right font-bold text-foreground bg-primary/5">
                    Consolidado ({periodoAtual})
                  </th>
                  <th className="py-3 px-3 text-right text-muted-foreground">
                    Comparativo ({periodoAnterior})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {quadroConsolidado.linhas.map((row) => {
                  const isTotalMacro = row.nivel === 1
                  const isSubtotal = row.nivel === 2
                  const rowClass = isTotalMacro
                    ? 'bg-slate-100/90 font-bold text-slate-900 border-t-2 border-b-2 border-slate-300'
                    : isSubtotal
                      ? 'bg-muted/40 font-semibold text-foreground border-t border-b'
                      : 'hover:bg-muted/30 transition-colors'

                  return (
                    <tr key={row.id} className={rowClass}>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block ${
                            row.nivel === 3
                              ? 'pl-4 text-slate-700'
                              : row.nivel === 2
                                ? 'pl-1 uppercase'
                                : 'uppercase tracking-wide text-primary'
                          }`}
                        >
                          {row.linha}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted-foreground">
                        {row.cod_nota || ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatMoeda(row.alfa)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatMoeda(row.combinado)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            row.eliminacao < 0
                              ? 'text-rose-600'
                              : row.eliminacao > 0
                                ? 'text-blue-600'
                                : 'text-muted-foreground'
                          }
                        >
                          {formatMoeda(row.eliminacao)}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono bg-primary/5 font-bold ${
                          isTotalMacro ? 'text-primary text-sm' : 'text-foreground'
                        }`}
                      >
                        {formatMoeda(row.consolidado)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {formatMoeda(row.anterior)}
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
export default BalancoConsolidado

import React, { useEffect, useState, useMemo } from 'react'
import { eliminacoesService, balancetesService, estruturaService } from '@/services/accounting'
import type { EliminacaoRecord, EstruturaBalancoRecord } from '@/types/accounting'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  SlidersHorizontal,
  PlusCircle,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Info,
} from 'lucide-react'

export const Eliminacoes: React.FC = () => {
  const [eliminacoes, setEliminacoes] = useState<EliminacaoRecord[]>([])
  const [periodo, setPeriodo] = useState<string>('Dez/25')
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([])
  const [linhasBP, setLinhasBP] = useState<EstruturaBalancoRecord[]>([])
  const [linhasDRE, setLinhasDRE] = useState<EstruturaBalancoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EliminacaoRecord> | null>(null)
  const [saving, setSaving] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [pers, bp, dre] = await Promise.all([
        balancetesService.listPeriodos(),
        estruturaService.listAll('BP'),
        estruturaService.listAll('DRE'),
      ])
      setPeriodosDisponiveis(pers)
      setLinhasBP(bp.filter((b) => !b.is_total))
      setLinhasDRE(dre.filter((d) => !d.is_total))
      const elims = await eliminacoesService.listByPeriodo(periodo)
      setEliminacoes(elims)
    } catch (e) {
      console.error('Erro ao carregar dados de eliminações:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    eliminacoesService.listByPeriodo(periodo).then(setEliminacoes).catch(console.error)
  }, [periodo])

  // Totalizadores de Eliminações (Débito, Crédito e Quadratura das Eliminações)
  const { totalDebitos, totalCreditos, diferencaElims, isQuadraturaElimsOk } = useMemo(() => {
    let deb = 0
    let cred = 0
    for (const el of eliminacoes) {
      deb += Number(el.debito) || 0
      cred += Number(el.credito) || 0
    }
    const diff = Math.abs(deb - cred)
    return {
      totalDebitos: deb,
      totalCreditos: cred,
      diferencaElims: diff,
      isQuadraturaElimsOk: diff < 0.05,
    }
  }, [eliminacoes])

  const formatMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const handleOpenCreate = () => {
    setEditItem({
      ano: 2025,
      periodo: periodo,
      empresa: 'GRUPO ABC',
      tipo_quadro: 'BP',
      linha_balanco: linhasBP[0]?.linha || 'Realizável a Longo Prazo',
      descricao: '',
      debito: 0,
      credito: 0,
      valor: 0,
    })
    setModalOpen(true)
  }

  const handleOpenEdit = (item: EliminacaoRecord) => {
    setEditItem({ ...item })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editItem || !editItem.descricao || !editItem.linha_balanco) return
    setSaving(true)
    try {
      const deb = Number(editItem.debito) || 0
      const cred = Number(editItem.credito) || 0
      // Valor líquido aplicado à consolidação da linha:
      // No balanço, Débitos aumentam ativo ou reduzem passivo; Créditos reduzem ativo ou aumentam passivo.
      // Definimos o impacto líquido da linha baseado nos débitos/créditos informados
      const valorLiquido =
        editItem.valor !== undefined && editItem.valor !== 0
          ? editItem.valor
          : deb > 0
            ? deb
            : -cred

      const payload = {
        ...editItem,
        debito: deb,
        credito: cred,
        valor: valorLiquido,
        periodo: periodo,
        ano: editItem.ano || 2025,
      }

      if (editItem.id) {
        await eliminacoesService.update(editItem.id, payload)
      } else {
        await eliminacoesService.create(
          payload as Omit<EliminacaoRecord, 'id' | 'created' | 'updated'>,
        )
      }
      setModalOpen(false)
      const atualizados = await eliminacoesService.listByPeriodo(periodo)
      setEliminacoes(atualizados)
    } catch (e) {
      console.error('Erro ao salvar eliminação:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este lançamento de eliminação?')) return
    try {
      await eliminacoesService.delete(id)
      const atualizados = await eliminacoesService.listByPeriodo(periodo)
      setEliminacoes(atualizados)
    } catch (e) {
      console.error('Erro ao deletar eliminação:', e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Lançamentos de Eliminação
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ajustes e exclusões de operações intercompany para apuração das demonstrações
            consolidadas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
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
          <Button size="sm" onClick={handleOpenCreate} className="text-xs">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Nova Eliminação
          </Button>
        </div>
      </div>

      {/* Banner de Quadratura das Eliminações (Partidas Dobradas) */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isQuadraturaElimsOk
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isQuadraturaElimsOk ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {isQuadraturaElimsOk ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-sm">
              {isQuadraturaElimsOk
                ? 'Conferência de Partidas Dobradas: Balanceada'
                : 'Atenção: Eliminações Desbalanceadas entre Débitos e Créditos'}
            </h2>
            <p className="text-xs opacity-90 mt-0.5">
              {isQuadraturaElimsOk
                ? `Total de Débitos (${formatMoeda(totalDebitos)}) = Total de Créditos (${formatMoeda(totalCreditos)}).`
                : `Diferença de ${formatMoeda(diferencaElims)} entre o total debitado e creditado nas eliminações.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <div className="bg-white/80 px-3 py-1.5 rounded-md border text-slate-800">
            Débitos: {formatMoeda(totalDebitos)}
          </div>
          <div className="bg-white/80 px-3 py-1.5 rounded-md border text-slate-800">
            Créditos: {formatMoeda(totalCreditos)}
          </div>
        </div>
      </div>

      {/* Tabela de Lançamentos de Eliminação */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Lançamentos de Consolidação — {periodo} ({eliminacoes.length} lançamentos)
          </CardTitle>
          <CardDescription className="text-xs">
            Exclusão de saldos de mútuos, vendas intercompany e estoques não realizados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-medium border-b">
                <tr>
                  <th className="py-2.5 px-3">Quadro</th>
                  <th className="py-2.5 px-3">Linha do Balanço / DRE</th>
                  <th className="py-2.5 px-3">Descrição do Ajuste</th>
                  <th className="py-2.5 px-3">Empresa / Parte</th>
                  <th className="py-2.5 px-3 text-right">Débito</th>
                  <th className="py-2.5 px-3 text-right">Crédito</th>
                  <th className="py-2.5 px-3 text-right">Impacto Líquido</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eliminacoes.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold">
                      <Badge variant="outline" className="text-[10px]">
                        {item.tipo_quadro}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {item.linha_balanco}
                    </td>
                    <td className="py-2.5 px-3 text-foreground max-w-[280px]">{item.descricao}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {item.empresa || 'GRUPO ABC'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {item.debito ? formatMoeda(item.debito) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {item.credito ? formatMoeda(item.credito) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      <span className={item.valor < 0 ? 'text-rose-600' : 'text-blue-600'}>
                        {formatMoeda(item.valor)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(item)}
                          title="Editar lançamento"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          title="Excluir lançamento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {eliminacoes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-xs">
                      Nenhum lançamento de eliminação cadastrado para o período {periodo}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Criação / Edição de Eliminação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editItem?.id ? 'Editar Lançamento de Eliminação' : 'Novo Lançamento de Eliminação'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe a linha afetada, motivo do ajuste e os valores de débito/crédito
            </DialogDescription>
          </DialogHeader>

          {editItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quadro</Label>
                  <Select
                    value={editItem.tipo_quadro || 'BP'}
                    onValueChange={(val: 'BP' | 'DRE') =>
                      setEditItem({ ...editItem, tipo_quadro: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BP" className="text-xs">
                        Balanço Patrimonial (BP)
                      </SelectItem>
                      <SelectItem value="DRE" className="text-xs">
                        Demonstração do Resultado (DRE)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Empresa / Parte Envolvida</Label>
                  <Input
                    value={editItem.empresa || ''}
                    onChange={(e) => setEditItem({ ...editItem, empresa: e.target.value })}
                    placeholder="ALFA x BETA"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Linha do Balanço / DRE Afetada</Label>
                <Select
                  value={editItem.linha_balanco || ''}
                  onValueChange={(val) => setEditItem({ ...editItem, linha_balanco: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione a Linha" />
                  </SelectTrigger>
                  <SelectContent>
                    {(editItem.tipo_quadro === 'BP' ? linhasBP : linhasDRE).map((l) => (
                      <SelectItem key={l.id} value={l.linha} className="text-xs">
                        {l.linha} ({l.grupo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descrição do Motivo</Label>
                <Input
                  value={editItem.descricao || ''}
                  onChange={(e) => setEditItem({ ...editItem, descricao: e.target.value })}
                  placeholder="Ex: Eliminação de mútuo financeiro intercompany"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor do Débito</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.debito ?? 0}
                    onChange={(e) => {
                      const d = parseFloat(e.target.value) || 0
                      setEditItem({
                        ...editItem,
                        debito: d,
                        valor: d > 0 ? d : -(editItem.credito || 0),
                      })
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Valor do Crédito</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.credito ?? 0}
                    onChange={(e) => {
                      const c = parseFloat(e.target.value) || 0
                      setEditItem({
                        ...editItem,
                        credito: c,
                        valor: (editItem.debito || 0) > 0 ? editItem.debito : -c,
                      })
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Impacto Líquido na Linha (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItem.valor ?? 0}
                  onChange={(e) =>
                    setEditItem({ ...editItem, valor: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  Use valor negativo se a eliminação reduz a linha consolidade (ex: -150000).
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Gravando...' : 'Salvar Eliminação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Eliminacoes

import React, { useEffect, useState, useMemo } from 'react'
import { balancetesService, deparaService } from '@/services/accounting'
import type { BalanceteRecord, DeParaRecord } from '@/types/accounting'
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
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Building2,
  SlidersHorizontal,
  Edit2,
  Trash2,
  PlusCircle,
  Download,
} from 'lucide-react'

export const Balancete: React.FC = () => {
  const [balancetes, setBalancetes] = useState<BalanceteRecord[]>([])
  const [deparaList, setDeparaList] = useState<DeParaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('TODAS')
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('Dez/25')
  const [filtroBusca, setFiltroBusca] = useState<string>('')
  const [filtroLinhaBP, setFiltroLinhaBP] = useState<string>('TODAS')
  const [filtroLinhaDRE, setFiltroLinhaDRE] = useState<string>('TODAS')

  // Modal de edição / criação
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<BalanceteRecord> | null>(null)
  const [saving, setSaving] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [itens, deparas] = await Promise.all([
        balancetesService.listAll(),
        deparaService.listAll(),
      ])
      setBalancetes(itens)
      setDeparaList(deparas)
    } catch (e) {
      console.error('Erro ao carregar balancete:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const empresasDisponiveis = useMemo(() => {
    return Array.from(new Set(balancetes.map((b) => b.empresa))).filter(Boolean)
  }, [balancetes])

  const periodosDisponiveis = useMemo(() => {
    const pers = Array.from(new Set(balancetes.map((b) => b.periodo))).filter(Boolean)
    return pers.length > 0 ? pers : ['Dez/25', 'Dez/24']
  }, [balancetes])

  const linhasBPDisponiveis = useMemo(() => {
    return Array.from(new Set(balancetes.map((b) => b.linha_bp).filter(Boolean))) as string[]
  }, [balancetes])

  const linhasDREDisponiveis = useMemo(() => {
    return Array.from(new Set(balancetes.map((b) => b.linha_dre).filter(Boolean))) as string[]
  }, [balancetes])

  // Filtragem
  const balancetesFiltrados = useMemo(() => {
    return balancetes.filter((item) => {
      if (filtroEmpresa !== 'TODAS' && item.empresa !== filtroEmpresa) return false
      if (filtroPeriodo !== 'TODOS' && item.periodo !== filtroPeriodo) return false
      if (filtroLinhaBP !== 'TODOS' && item.linha_bp !== filtroLinhaBP) return false
      if (filtroLinhaDRE !== 'TODOS' && item.linha_dre !== filtroLinhaDRE) return false

      if (filtroBusca.trim()) {
        const busca = filtroBusca.toLowerCase()
        const matchConta = item.conta.toLowerCase().includes(busca)
        const matchDesc = item.descricao.toLowerCase().includes(busca)
        const matchBp = item.linha_bp?.toLowerCase().includes(busca)
        const matchDre = item.linha_dre?.toLowerCase().includes(busca)
        if (!matchConta && !matchDesc && !matchBp && !matchDre) return false
      }

      return true
    })
  }, [balancetes, filtroEmpresa, filtroPeriodo, filtroLinhaBP, filtroLinhaDRE, filtroBusca])

  // Totais calculados — das 4 colunas de saldo gravadas pela importação
  const { totalDebitos, totalCreditos, saldoInicial, saldoFinal } = useMemo(() => {
    let si = 0
    let deb = 0
    let cred = 0
    let sf = 0
    for (const b of balancetesFiltrados) {
      si += Number(b.saldo_inicial) || 0
      deb += Number(b.debitos) || 0
      cred += Number(b.creditos) || 0
      sf += Number(b.saldo_final ?? b.saldo) || 0
    }
    return {
      saldoInicial: si,
      totalDebitos: deb,
      totalCreditos: cred,
      saldoFinal: sf,
    }
  }, [balancetesFiltrados])

  const formatMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  // Ações de Salvar / Deletar
  const handleOpenEdit = (item: BalanceteRecord) => {
    setEditItem({ ...item })
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setEditItem({
      empresa: filtroEmpresa !== 'TODAS' ? filtroEmpresa : 'ALFA',
      periodo: filtroPeriodo !== 'TODOS' ? filtroPeriodo : '',
      ano: new Date().getFullYear(),
      conta: '',
      descricao: '',
      saldo: 0,
      saldo_inicial: 0,
      debitos: 0,
      creditos: 0,
      saldo_final: 0,
      natureza: 'D',
      linha_bp: '',
      linha_dre: '',
      cod_nota: '',
    })
    setModalOpen(true)
  }

  const handleSaveItem = async () => {
    if (!editItem || !editItem.conta || !editItem.descricao) return
    setSaving(true)
    try {
      if (editItem.id) {
        await balancetesService.update(editItem.id, editItem)
      } else {
        await balancetesService.create(
          editItem as Omit<BalanceteRecord, 'id' | 'created' | 'updated'>,
        )
      }
      setModalOpen(false)
      await carregarDados()
    } catch (e) {
      console.error('Erro ao salvar item de balancete:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Deseja realmente remover esta linha do balancete?')) return
    try {
      await balancetesService.delete(id)
      await carregarDados()
    } catch (e) {
      console.error('Erro ao excluir item do balancete:', e)
    }
  }

  // Exportar balancete filtrado em CSV
  const handleExportCSV = () => {
    let csv = 'Empresa;Ano;Periodo;Conta;Descricao;Saldo;Natureza;Linha_BP;Linha_DRE;Cod_Nota\n'
    for (const b of balancetesFiltrados) {
      csv += `"${b.empresa}";${b.ano};"${b.periodo}";"${b.conta}";"${b.descricao}";${b.saldo};"${b.natureza}";"${b.linha_bp || ''}";"${b.linha_dre || ''}";"${b.cod_nota || ''}"\n`
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balancete_${filtroEmpresa}_${filtroPeriodo.replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Balancete de Verificação
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consulta e conferência analítica das contas contábeis por empresa e período
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="text-xs">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Empresa */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Empresa</Label>
              <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS" className="text-xs">
                    Todas as Empresas
                  </SelectItem>
                  {empresasDisponiveis.map((emp) => (
                    <SelectItem key={emp} value={emp} className="text-xs">
                      {emp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS" className="text-xs">
                    Todos os Períodos
                  </SelectItem>
                  {periodosDisponiveis.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha BP */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Linha BP</Label>
              <Select value={filtroLinhaBP} onValueChange={setFiltroLinhaBP}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Linha BP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS" className="text-xs">
                    Todas as Linhas BP
                  </SelectItem>
                  {linhasBPDisponiveis.map((lb) => (
                    <SelectItem key={lb} value={lb} className="text-xs">
                      {lb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linha DRE */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">Linha DRE</Label>
              <Select value={filtroLinhaDRE} onValueChange={setFiltroLinhaDRE}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Linha DRE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS" className="text-xs">
                    Todas as Linhas DRE
                  </SelectItem>
                  {linhasDREDisponiveis.map((ld) => (
                    <SelectItem key={ld} value={ld} className="text-xs">
                      {ld}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">
                Buscar Conta / Descrição
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  placeholder="Ex: Banco, 1.1.01..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo de Totais do Balancete — as 4 colunas de saldo gravadas pela importação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-3.5 bg-card border rounded-lg shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Saldo Inicial
          </span>
          <div className="text-lg font-bold text-foreground">{formatMoeda(saldoInicial)}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-lg shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Débitos
          </span>
          <div className="text-lg font-bold text-foreground">{formatMoeda(totalDebitos)}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-lg shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Créditos
          </span>
          <div className="text-lg font-bold text-foreground">{formatMoeda(totalCreditos)}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-lg shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Saldo Final
          </span>
          <div className="text-lg font-bold text-foreground">{formatMoeda(saldoFinal)}</div>
        </div>
        <div className="p-3.5 bg-card border rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Linhas Filtradas
            </span>
            <div className="text-lg font-bold text-foreground">
              {balancetesFiltrados.length} contas
            </div>
          </div>
          <Badge variant="secondary">Registro</Badge>
        </div>
      </div>

      {/* Tabela de Balancetes */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-medium border-b">
                <tr>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-3">Período</th>
                  <th className="py-2.5 px-3">Conta</th>
                  <th className="py-2.5 px-3">Descrição da Conta</th>
                  <th className="py-2.5 px-3 text-right">Saldo Inicial</th>
                  <th className="py-2.5 px-3 text-right">Débitos</th>
                  <th className="py-2.5 px-3 text-right">Créditos</th>
                  <th className="py-2.5 px-3 text-right">Saldo Final</th>
                  <th className="py-2.5 px-3 text-center">Nat</th>
                  <th className="py-2.5 px-3">Linha BP</th>
                  <th className="py-2.5 px-3">Linha DRE</th>
                  <th className="py-2.5 px-3 text-center">Nota</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {balancetesFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      {item.empresa}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono">{item.periodo}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-800">
                      {item.conta}
                    </td>
                    <td
                      className="py-2.5 px-3 font-medium text-foreground max-w-[240px] truncate"
                      title={item.descricao}
                    >
                      {item.descricao}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      {formatMoeda(item.saldo_inicial ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">
                      {formatMoeda(item.debitos ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">
                      {formatMoeda(item.creditos ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      {formatMoeda(item.saldo_final ?? item.saldo ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant={item.natureza === 'D' ? 'default' : 'secondary'}
                        className={`text-[10px] px-1.5 py-0 font-mono ${
                          item.natureza === 'D' ? 'bg-blue-600' : 'bg-slate-600 text-white'
                        }`}
                      >
                        {item.natureza}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                      {item.linha_bp ? (
                        <span className="text-slate-700">{item.linha_bp}</span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                      {item.linha_dre ? (
                        <span className="text-slate-700">{item.linha_dre}</span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
                      {item.cod_nota || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(item)}
                          title="Editar conta"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                          title="Excluir conta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {balancetesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-muted-foreground text-xs">
                      Nenhuma conta localizada com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Criação / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editItem?.id ? 'Editar Conta do Balancete' : 'Nova Conta no Balancete'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajuste as informações cadastrais e o mapeamento de consolidação
            </DialogDescription>
          </DialogHeader>

          {editItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Empresa</Label>
                  <Input
                    value={editItem.empresa || ''}
                    onChange={(e) =>
                      setEditItem({ ...editItem, empresa: e.target.value.toUpperCase() })
                    }
                    placeholder="ALFA"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período</Label>
                  <Input
                    value={editItem.periodo || ''}
                    onChange={(e) => setEditItem({ ...editItem, periodo: e.target.value })}
                    placeholder="Dez/25"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Número da Conta</Label>
                  <Input
                    value={editItem.conta || ''}
                    onChange={(e) => setEditItem({ ...editItem, conta: e.target.value })}
                    placeholder="1.1.01.001"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Natureza</Label>
                  <Select
                    value={editItem.natureza || 'D'}
                    onValueChange={(val: 'D' | 'C') => setEditItem({ ...editItem, natureza: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D" className="text-xs">
                        D (Devedora)
                      </SelectItem>
                      <SelectItem value="C" className="text-xs">
                        C (Credora)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descrição da Conta</Label>
                <Input
                  value={editItem.descricao || ''}
                  onChange={(e) => setEditItem({ ...editItem, descricao: e.target.value })}
                  placeholder="Nome oficial da conta"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Saldo Inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.saldo_inicial ?? 0}
                    onChange={(e) =>
                      setEditItem({ ...editItem, saldo_inicial: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Saldo Final</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.saldo_final ?? editItem.saldo ?? 0}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        saldo_final: parseFloat(e.target.value) || 0,
                        saldo: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Débitos</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.debitos ?? 0}
                    onChange={(e) =>
                      setEditItem({ ...editItem, debitos: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Créditos</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editItem.creditos ?? 0}
                    onChange={(e) =>
                      setEditItem({ ...editItem, creditos: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código da Nota</Label>
                <Input
                  value={editItem.cod_nota || ''}
                  onChange={(e) => setEditItem({ ...editItem, cod_nota: e.target.value })}
                  placeholder="03"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Linha do Balanço Patrimonial (BP)</Label>
                <Input
                  value={editItem.linha_bp || ''}
                  onChange={(e) => setEditItem({ ...editItem, linha_bp: e.target.value })}
                  placeholder="Caixa e Equivalentes de Caixa"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Linha da DRE</Label>
                <Input
                  value={editItem.linha_dre || ''}
                  onChange={(e) => setEditItem({ ...editItem, linha_dre: e.target.value })}
                  placeholder="Receita Bruta de Vendas e Serviços"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveItem} disabled={saving}>
              {saving ? 'Gravando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Balancete

import React, { useEffect, useState, useMemo } from 'react'
import { deparaService, estruturaService } from '@/services/accounting'
import type { DeParaRecord, EstruturaBalancoRecord } from '@/types/accounting'
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
  GitCompareArrows,
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Download,
} from 'lucide-react'

export const DePara: React.FC = () => {
  const [deparaList, setDeparaList] = useState<DeParaRecord[]>([])
  const [estruturaBP, setEstruturaBP] = useState<EstruturaBalancoRecord[]>([])
  const [estruturaDRE, setEstruturaDRE] = useState<EstruturaBalancoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS')
  const [filtroBusca, setFiltroBusca] = useState<string>('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<DeParaRecord> | null>(null)
  const [saving, setSaving] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [itens, bp, dre] = await Promise.all([
        deparaService.listAll(),
        estruturaService.listAll('BP'),
        estruturaService.listAll('DRE'),
      ])
      setDeparaList(itens)
      setEstruturaBP(bp)
      setEstruturaDRE(dre)
    } catch (e) {
      console.error('Erro ao carregar De-Para:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Filtros
  const listaFiltrada = useMemo(() => {
    return deparaList.filter((item) => {
      if (filtroTipo !== 'TODOS' && item.tipo_conta !== filtroTipo) return false
      if (filtroBusca.trim()) {
        const b = filtroBusca.toLowerCase()
        const mConta = item.conta.toLowerCase().includes(b)
        const mDesc = item.descricao.toLowerCase().includes(b)
        const mBp = item.linha_bp?.toLowerCase().includes(b)
        const mDre = item.linha_dre?.toLowerCase().includes(b)
        const mGrupo = item.grupo_bp?.toLowerCase().includes(b)
        if (!mConta && !mDesc && !mBp && !mDre && !mGrupo) return false
      }
      return true
    })
  }, [deparaList, filtroTipo, filtroBusca])

  const handleOpenEdit = (item: DeParaRecord) => {
    setEditItem({ ...item })
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setEditItem({
      conta: '',
      descricao: '',
      linha_bp: '',
      grupo_bp: 'Ativo Circulante',
      linha_dre: '',
      cod_nota: '',
      tipo_conta: 'ATIVO',
      observacao: '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!editItem || !editItem.conta || !editItem.descricao) return
    setSaving(true)
    try {
      if (editItem.id) {
        await deparaService.update(editItem.id, editItem)
      } else {
        await deparaService.create(editItem as Omit<DeParaRecord, 'id' | 'created' | 'updated'>)
      }
      setModalOpen(false)
      await carregarDados()
    } catch (e) {
      console.error('Erro ao salvar De-Para:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este mapeamento De-Para?')) return
    try {
      await deparaService.delete(id)
      await carregarDados()
    } catch (e) {
      console.error('Erro ao excluir item De-Para:', e)
    }
  }

  const handleExportCSV = () => {
    let csv = 'Conta;Descricao;Tipo_Conta;Linha_BP;Grupo_BP;Linha_DRE;Cod_Nota;Observacao\n'
    for (const d of listaFiltrada) {
      csv += `"${d.conta}";"${d.descricao}";"${d.tipo_conta || ''}";"${d.linha_bp || ''}";"${d.grupo_bp || ''}";"${d.linha_dre || ''}";"${d.cod_nota || ''}";"${d.observacao || ''}"\n`
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `depara_contas_grupo_abc.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Mapeamento De-Para de Contas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Parametrização contábil: direcionamento de contas do balancete para as linhas de BP e
            DRE
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
            <Download className="h-4 w-4 mr-1.5" />
            Exportar De-Para
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="text-xs">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Novo De-Para
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-medium">
                Grupo / Tipo de Conta
              </Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS" className="text-xs">
                    Todos os Tipos
                  </SelectItem>
                  <SelectItem value="ATIVO" className="text-xs">
                    ATIVO (Circulante / Não Circulante)
                  </SelectItem>
                  <SelectItem value="PASSIVO" className="text-xs">
                    PASSIVO (Circulante / Não Circulante)
                  </SelectItem>
                  <SelectItem value="PL" className="text-xs">
                    PATRIMÔNIO LÍQUIDO
                  </SelectItem>
                  <SelectItem value="RESULTADO" className="text-xs">
                    RESULTADO / DRE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground font-medium">
                Buscar Conta, Descrição ou Linha
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 pl-8 text-xs"
                  placeholder="Ex: 1.1.01.001, Fornecedores, Caixa, CMV..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela do De-Para */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/80 text-[10px] text-muted-foreground uppercase font-medium border-b">
                <tr>
                  <th className="py-2.5 px-3">Conta Contábil</th>
                  <th className="py-2.5 px-3">Descrição da Conta</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Linha BP Mapeada</th>
                  <th className="py-2.5 px-3">Grupo BP</th>
                  <th className="py-2.5 px-3">Linha DRE Mapeada</th>
                  <th className="py-2.5 px-3 text-center">Nota</th>
                  <th className="py-2.5 px-3">Observação</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listaFiltrada.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      {item.conta}
                    </td>
                    <td
                      className="py-2.5 px-3 font-medium text-foreground max-w-[220px] truncate"
                      title={item.descricao}
                    >
                      {item.descricao}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          item.tipo_conta === 'ATIVO'
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : item.tipo_conta === 'PASSIVO'
                              ? 'text-rose-700 bg-rose-50 border-rose-200'
                              : item.tipo_conta === 'PL'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-purple-700 bg-purple-50 border-purple-200'
                        }`}
                      >
                        {item.tipo_conta || 'OUTRO'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {item.linha_bp || <span className="text-muted-foreground/60 italic">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                      {item.grupo_bp || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      {item.linha_dre || <span className="text-muted-foreground/60 italic">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                      {item.cod_nota || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-[150px] truncate">
                      {item.observacao || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(item)}
                          title="Editar De-Para"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          title="Excluir De-Para"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {listaFiltrada.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                      Nenhum mapeamento De-Para encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal De-Para */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editItem?.id ? 'Editar De-Para da Conta' : 'Novo Mapeamento De-Para'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule a conta contábil à linha oficial do Balanço Patrimonial e/ou da DRE
            </DialogDescription>
          </DialogHeader>

          {editItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Conta Contábil</Label>
                  <Input
                    value={editItem.conta || ''}
                    onChange={(e) => setEditItem({ ...editItem, conta: e.target.value })}
                    placeholder="Ex: 1.1.01.001"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Conta</Label>
                  <Select
                    value={editItem.tipo_conta || 'ATIVO'}
                    onValueChange={(val: 'ATIVO' | 'PASSIVO' | 'PL' | 'RESULTADO') =>
                      setEditItem({ ...editItem, tipo_conta: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO" className="text-xs">
                        ATIVO
                      </SelectItem>
                      <SelectItem value="PASSIVO" className="text-xs">
                        PASSIVO
                      </SelectItem>
                      <SelectItem value="PL" className="text-xs">
                        PL
                      </SelectItem>
                      <SelectItem value="RESULTADO" className="text-xs">
                        RESULTADO
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
                  placeholder="Ex: Banco Itaú C/C"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Linha do BP (Balanço Patrimonial)</Label>
                  <Select
                    value={editItem.linha_bp || 'NONE'}
                    onValueChange={(val) =>
                      setEditItem({ ...editItem, linha_bp: val === 'NONE' ? '' : val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione a Linha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" className="text-xs">
                        Nenhuma (apenas DRE)
                      </SelectItem>
                      {estruturaBP
                        .filter((e) => !e.is_total)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.linha} className="text-xs">
                            {e.linha} ({e.grupo})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Grupo BP</Label>
                  <Input
                    value={editItem.grupo_bp || ''}
                    onChange={(e) => setEditItem({ ...editItem, grupo_bp: e.target.value })}
                    placeholder="Ativo Circulante, Passivo..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Linha da DRE</Label>
                  <Select
                    value={editItem.linha_dre || 'NONE'}
                    onValueChange={(val) =>
                      setEditItem({ ...editItem, linha_dre: val === 'NONE' ? '' : val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione a Linha DRE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE" className="text-xs">
                        Nenhuma (apenas BP)
                      </SelectItem>
                      {estruturaDRE
                        .filter((e) => !e.is_total)
                        .map((e) => (
                          <SelectItem key={e.id} value={e.linha} className="text-xs">
                            {e.linha}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Código da Nota Explicativa</Label>
                  <Input
                    value={editItem.cod_nota || ''}
                    onChange={(e) => setEditItem({ ...editItem, cod_nota: e.target.value })}
                    placeholder="Ex: 03, 04, 15..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observação / Instrução Contábil</Label>
                <Input
                  value={editItem.observacao || ''}
                  onChange={(e) => setEditItem({ ...editItem, observacao: e.target.value })}
                  placeholder="Ex: Sujeito a eliminação intercompany..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Gravando...' : 'Salvar Mapeamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default DePara

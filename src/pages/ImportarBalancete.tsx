import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { balancetesService, deparaService } from '@/services/accounting'
import type { BalanceteRecord, DeParaRecord } from '@/types/accounting'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Info,
  Trash2,
  Download,
} from 'lucide-react'
import { ImportStepper, derivarEtapaImportacao } from '@/components/ImportStepper'

interface ParsedRow {
  empresa: string
  ano: number
  periodo: string
  conta: string
  descricao: string
  saldo: number
  natureza: 'D' | 'C'
  linha_bp?: string
  linha_dre?: string
  cod_nota?: string
  erros: string[]
  isValid: boolean
}

export const ImportarBalancete: React.FC = () => {
  const navigate = useNavigate()
  const [empresaDefault, setEmpresaDefault] = useState('ALFA')
  const [periodoDefault, setPeriodoDefault] = useState('Dez/25')
  const [anoDefault, setAnoDefault] = useState('2025')
  const [replaceExisting, setReplaceExisting] = useState(true)

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{ imported: number; replaced: number } | null>(
    null,
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modelo de CSV para download
  const handleDownloadTemplate = () => {
    const csvContent =
      'empresa;ano;periodo;conta;descricao;saldo;natureza;linha_bp;linha_dre;cod_nota\n' +
      'ALFA;2025;Dez/25;1.1.01.001;Caixa Geral Matriz;45000.00;D;Caixa e Equivalentes de Caixa;;03\n' +
      'ALFA;2025;Dez/25;1.1.01.002;Banco Conta Movimento;280000.00;D;Caixa e Equivalentes de Caixa;;03\n' +
      'ALFA;2025;Dez/25;1.1.03.001;Clientes a Receber;520000.00;D;Contas a Receber de Clientes;;05\n' +
      'ALFA;2025;Dez/25;2.1.01.001;Fornecedores Nacionais;380000.00;C;Fornecedores Nacionais e Estrangeiros;;13\n' +
      'ALFA;2025;Dez/25;2.4.01.001;Capital Social;800000.00;C;Capital Social Subscrito e Integralizado;;21\n' +
      'ALFA;2025;Dez/25;3.1.01.001;Receita de Vendas;3200000.00;C;;Receita Bruta de Vendas e Serviços;25\n'

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'modelo_balancete_grupo_abc.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Processamento do arquivo de texto (CSV delimitado por ; ou , ou tab)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setIsProcessing(true)
    setErrorMsg(null)
    setImportSummary(null)

    try {
      const text = await file.text()
      // Carrega mapeamento De-Para para preencher automaticamente campos não informados
      const deparaMap = await deparaService.getMap()

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length < 2) {
        throw new Error('O arquivo selecionado está vazio ou contém apenas o cabeçalho.')
      }

      // Identificar separador (; ou , ou tab)
      const firstLine = lines[0]
      let sep = ';'
      if (firstLine.includes(';') && !firstLine.includes('\t')) sep = ';'
      else if (firstLine.includes('\t')) sep = '\t'
      else if (firstLine.includes(',') && !firstLine.includes(';')) sep = ','

      // Mapear cabeçalhos
      const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ''))

      const colIdx = {
        empresa: headers.findIndex((h) => h.includes('empresa')),
        ano: headers.findIndex((h) => h.includes('ano')),
        periodo: headers.findIndex(
          (h) => h.includes('periodo') || h.includes('período') || h.includes('mes'),
        ),
        conta: headers.findIndex(
          (h) => h.includes('conta') || h.includes('codigo') || h.includes('código'),
        ),
        descricao: headers.findIndex(
          (h) => h.includes('desc') || h.includes('nome') || h.includes('titulo'),
        ),
        saldo: headers.findIndex((h) => h.includes('saldo') || h.includes('valor')),
        natureza: headers.findIndex(
          (h) => h.includes('nat') || h.includes('d/c') || h.includes('deb_cred'),
        ),
        linha_bp: headers.findIndex((h) => h.includes('bp') || h.includes('linha_bp')),
        linha_dre: headers.findIndex((h) => h.includes('dre') || h.includes('linha_dre')),
        cod_nota: headers.findIndex((h) => h.includes('nota') || h.includes('cod_nota')),
      }

      const rows: ParsedRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i].trim()
        if (!rawLine) continue

        const cols = rawLine.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''))
        const erros: string[] = []

        // Extrai ou usa defaults
        const emp = (colIdx.empresa >= 0 ? cols[colIdx.empresa] : '') || empresaDefault
        const anoNum = colIdx.ano >= 0 ? parseInt(cols[colIdx.ano], 10) : parseInt(anoDefault, 10)
        const ano = isNaN(anoNum) ? parseInt(anoDefault, 10) : anoNum
        const per = (colIdx.periodo >= 0 ? cols[colIdx.periodo] : '') || periodoDefault

        const conta = colIdx.conta >= 0 ? cols[colIdx.conta] : ''
        const desc = colIdx.descricao >= 0 ? cols[colIdx.descricao] : ''

        let saldoRaw = colIdx.saldo >= 0 ? cols[colIdx.saldo] : '0'
        // Tratar formato numérico brasileiro ex 1.234,56 ou 1234.56
        saldoRaw = saldoRaw.replace(/\./g, '').replace(',', '.')
        const saldo = parseFloat(saldoRaw)

        let nat = (colIdx.natureza >= 0 ? cols[colIdx.natureza]?.toUpperCase() : '') as 'D' | 'C'
        if (nat !== 'D' && nat !== 'C') {
          // Inferir natureza pelo primeiro dígito da conta
          if (conta.startsWith('1') || (conta.startsWith('3') && !conta.startsWith('3.1'))) {
            nat = 'D'
          } else {
            nat = 'C'
          }
        }

        // Validações
        if (!conta) erros.push('Número da conta ausente')
        if (!desc) erros.push('Descrição da conta ausente')
        if (isNaN(saldo)) erros.push('Saldo inválido')

        // De-Para automático
        const deparaInfo = deparaMap.get(conta.trim())
        const linha_bp =
          (colIdx.linha_bp >= 0 ? cols[colIdx.linha_bp] : '') || deparaInfo?.linha_bp || ''
        const linha_dre =
          (colIdx.linha_dre >= 0 ? cols[colIdx.linha_dre] : '') || deparaInfo?.linha_dre || ''
        const cod_nota =
          (colIdx.cod_nota >= 0 ? cols[colIdx.cod_nota] : '') || deparaInfo?.cod_nota || ''

        rows.push({
          empresa: emp.toUpperCase(),
          ano,
          periodo: per,
          conta,
          descricao: desc,
          saldo: isNaN(saldo) ? 0 : saldo,
          natureza: nat,
          linha_bp,
          linha_dre,
          cod_nota,
          erros,
          isValid: erros.length === 0,
        })
      }

      setParsedRows(rows)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao processar o arquivo.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Executa a confirmação da importação no banco PocketBase
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      setErrorMsg('Não há registros válidos para importar.')
      return
    }

    setIsImporting(true)
    setErrorMsg(null)

    try {
      const recordsToSave: Omit<BalanceteRecord, 'id' | 'created' | 'updated'>[] = validRows.map(
        (r) => ({
          empresa: r.empresa,
          ano: r.ano,
          periodo: r.periodo,
          conta: r.conta,
          descricao: r.descricao,
          saldo: r.saldo,
          natureza: r.natureza,
          linha_bp: r.linha_bp || '',
          linha_dre: r.linha_dre || '',
          cod_nota: r.cod_nota || '',
        }),
      )

      const result = await balancetesService.importBatch(recordsToSave, replaceExisting)
      setImportSummary(result)
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao persistir balancetes no banco de dados.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const invalidCount = parsedRows.filter((r) => !r.isValid).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Importar Balancete Contábil
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envie arquivos em formato CSV ou XLSX para carga e consolidação do período
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="text-xs">
          <Download className="h-4 w-4 mr-1.5" />
          Baixar Modelo de Planilha
        </Button>
      </div>

      {/* Stepper visual: 6 etapas do fluxo de importação */}
      <ImportStepper
        etapa={derivarEtapaImportacao({
          fileName,
          processando: isProcessing,
          totalLinhas: parsedRows.length,
          invalidas: invalidCount,
          importado: !!importSummary,
        })}
      />

      {/* Card de Configurações da Carga */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Parâmetros Padrão da Carga</CardTitle>
          <CardDescription className="text-xs">
            Valores aplicados para linhas que não contenham tais colunas no arquivo importado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Empresa Padrão</Label>
              <Select value={empresaDefault} onValueChange={setEmpresaDefault}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALFA" className="text-xs">
                    ALFA (Matriz)
                  </SelectItem>
                  <SelectItem value="BETA" className="text-xs">
                    BETA (Filial/Controlada)
                  </SelectItem>
                  <SelectItem value="GAMA" className="text-xs">
                    GAMA
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Período de Referência</Label>
              <Input
                className="text-xs h-9"
                value={periodoDefault}
                onChange={(e) => setPeriodoDefault(e.target.value)}
                placeholder="Ex: Dez/25 ou 12/2025"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ano Contábil</Label>
              <Input
                type="number"
                className="text-xs h-9"
                value={anoDefault}
                onChange={(e) => setAnoDefault(e.target.value)}
                placeholder="2025"
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-foreground">
                Substituir registros existentes do período/empresa
              </span>
              <p className="text-[11px] text-muted-foreground">
                Evita duplicidade ao reimportar o mesmo mês contábil
              </p>
            </div>
            <Switch checked={replaceExisting} onCheckedChange={setReplaceExisting} />
          </div>
        </CardContent>
      </Card>

      {/* Área de Seleção de Arquivo */}
      <Card className="border-dashed border-2 border-border shadow-sm">
        <CardContent className="py-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">
              Selecione o arquivo de balancete (CSV ou XLSX)
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Separadores aceitos: ponto e vírgula (;), vírgula (,) ou tabulação. O sistema aplicará
              o De-Para cadastrado automaticamente.
            </p>
          </div>

          <div className="flex justify-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv, .txt, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileUpload}
              />
              <span className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 shadow-sm">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Escolher Arquivo no Computador
              </span>
            </label>
          </div>

          {fileName && (
            <div className="inline-flex items-center gap-2 text-xs font-mono bg-muted px-3 py-1.5 rounded-md">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Arquivo selecionado: {fileName}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas e Mensagens */}
      {errorMsg && (
        <Alert variant="destructive" className="text-xs">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Erro no arquivo ou na importação</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {importSummary && (
        <Alert className="bg-emerald-50 text-emerald-950 border-emerald-200 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-xs font-bold text-emerald-900">
            Importação Concluída com Sucesso!
          </AlertTitle>
          <AlertDescription className="space-y-2 mt-1">
            <p>
              Foram importadas <strong>{importSummary.imported}</strong> contas contábeis.{' '}
              {importSummary.replaced > 0 &&
                `(Registros anteriores substituídos: ${importSummary.replaced})`}
            </p>
            <div className="pt-2 flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="text-xs"
                onClick={() => navigate('/balancete')}
              >
                Ver Balancete Atualizado
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => navigate('/balanco-consolidado')}
              >
                Ver Balanço Consolidado
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Prévia da Importação e Validação de Campos */}
      {parsedRows.length > 0 && !importSummary && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Prévia da Importação ({parsedRows.length} linhas detectadas)
              </CardTitle>
              <CardDescription className="text-xs">
                Revise os campos e as associações De-Para antes de confirmar a persistência
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[11px]"
              >
                {validCount} Válidas
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  {invalidCount} com Inconsistências
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[420px] border-t">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/80 sticky top-0 z-10 text-[10px] text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3">Período</th>
                    <th className="py-2.5 px-3">Conta</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-center">D/C</th>
                    <th className="py-2.5 px-3">Linha BP Mapeada</th>
                    <th className="py-2.5 px-3">Linha DRE Mapeada</th>
                    <th className="py-2.5 px-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className={row.isValid ? 'hover:bg-muted/30' : 'bg-rose-50/60'}>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center text-emerald-600 font-medium text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center text-rose-600 font-medium text-[10px] gap-1"
                            title={row.erros.join(', ')}
                          >
                            <AlertTriangle className="h-3 w-3" /> Erro
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold">{row.empresa}</td>
                      <td className="py-2 px-3">{row.periodo}</td>
                      <td className="py-2 px-3 font-mono text-[11px] font-medium">{row.conta}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={row.descricao}>
                        {row.descricao}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(row.saldo)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {row.natureza}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-[11px]">
                        {row.linha_bp || <span className="text-amber-600 italic">Sem BP</span>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-[11px]">
                        {row.linha_dre || '-'}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-[10px]">
                        {row.cod_nota || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 50 && (
              <div className="p-2 text-center text-[11px] text-muted-foreground bg-muted/20 border-t">
                Exibindo primeiras 50 de {parsedRows.length} linhas. Todas as linhas válidas serão
                importadas.
              </div>
            )}
          </CardContent>
          <CardFooter className="py-3 px-4 border-t bg-muted/10 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParsedRows([])
                setFileName(null)
              }}
              className="text-xs text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-500" />
              Cancelar e Limpar
            </Button>

            <Button
              size="sm"
              onClick={handleConfirmImport}
              disabled={validCount === 0 || isImporting}
              className="text-xs font-semibold"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Gravando Balancetes...
                </>
              ) : (
                <>
                  Confirmar e Importar {validCount} Contas
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
export default ImportarBalancete

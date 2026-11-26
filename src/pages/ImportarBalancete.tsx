import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  autoDetectColMap,
  parseDePara,
  parseRows,
  loadDeparaMap,
  CSV_MODELO_BALANCETE,
  CSV_MODELO_DEPARA,
  CONTA_AJUSTE,
  type ColumnMap,
  type ParseDefaults,
  type ParseError,
  type ParsedDeParaRow,
  type ParsedRow,
} from '@/lib/importParser'
import {
  balancetesService,
  deparaService,
  estruturaService,
  gerarLote,
  importarBalanceteLote,
  importarDeParaLote,
} from '@/services/accounting'
import type { BalanceteRecord, DeParaRecord } from '@/types/accounting'
import { ImportStepper } from '@/components/ImportStepper'
import { formatMoeda } from '@/lib/visual'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ImportarBalanceteProps {
  tipoArquivo?: 'balancete' | 'depara'
}

type EtapaImportador = 'selecionar' | 'mapear' | 'validar' | 'previa' | 'concluido'

export function ImportarBalancete({ tipoArquivo = 'balancete' }: ImportarBalanceteProps) {
  const { user } = useAuth()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [texto, setTexto] = useState<string>('')
  const [etapa, setEtapa] = useState<EtapaImportador>('selecionar')
  const [progesso, setProgesso] = useState(0)
  const [colMap, setColMap] = useState<ColumnMap | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [defaults, setDefaults] = useState<ParseDefaults>({
    empresa: '',
    periodo: '',
    ano: '',
  })
  const [rowsBalancete, setRowsBalancete] = useState<ParsedRow[]>([])
  const [rowsDepara, setRowsDepara] = useState<ParsedDeParaRow[]>([])
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [deparaMap, setDeparaMap] = useState<Map<string, DeParaRecord>>(new Map())
  const [lote, setLote] = useState<string>('')
  const [importando, setImportando] = useState(false)
  const [importados, setImportados] = useState(0)

  const carregarDepara = useCallback(async () => {
    try {
      setDeparaMap(await loadDeparaMap())
    } catch {
      /* depara vazio */
    }
  }, [])

  useEffect(() => {
    carregarDepara()
  }, [carregarDepara])

  const ehDePara = tipoArquivo === 'depara'

  const handleSelecionarArquivo = async (file: File | undefined) => {
    if (!file) return
    setArquivo(file)
    setTexto(await file.text())
    setEtapa('mapear')
    setFatalError(null)
    setRowsBalancete([])

    const bruto = (await file.text()).replace(/^\uFEFF/, '')
    const primeira = bruto.split(/\r?\n/)[0] ?? ''
    const sep = primeira.includes(';') ? ';' : ','
    const hs = primeira.split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ''))
    setHeaders(hs)
    setColMap(autoDetectColMap(hs))

    if (ehDePara) {
      const r = parseDePara(bruto)
      setRowsDepara(r.rows)
      setFatalError(r.fatalError)
      if (!r.fatalError) setEtapa('previa')
    }
  }

  const validar = () => {
    if (!colMap || !texto) return
    if (ehDePara) {
      const r = parseDePara(texto)
      setRowsDepara(r.rows)
      setFatalError(r.fatalError)
      if (!r.fatalError) setEtapa('previa')
      return
    }
    const r = parseRows(texto, colMap, defaults, deparaMap)
    setRowsBalancete(r.rows)
    setFatalError(r.fatalError)
    if (!r.fatalError) setEtapa('previa')
  }

  const errosBalancete = rowsBalancete.flatMap((r) => r.erros)
  const alertasBalancete = rowsBalancete.flatMap((r) => r.alertas)
  const errosDepara = rowsDepara.flatMap((r) => r.erros)
  const linhasValidas = ehDePara
    ? rowsDepara.filter((r) => r.isValid)
    : rowsBalancete.filter((r) => r.isValid)
  const erros = ehDePara ? errosDepara : errosBalancete

  const contasSemMapeamento = useMemo(
    () => rowsBalancete.filter((r) => r.isValid && !r.linha_bp && !r.linha_dre),
    [rowsBalancete],
  )

  const confirmarImportacao = async () => {
    if (!arquivo || linhasValidas.length === 0) return
    setImportando(true)
    setProgesso(10)
    const loteAtual = gerarLote()
    setLote(loteAtual)
    try {
      if (ehDePara) {
        const validas = rowsDepara.filter((r) => r.isValid)
        const res = await importarDeParaLote(
          validas.map((r) => ({
            conta: r.conta,
            descricao: r.descricao,
            linha_bp: r.linha_bp,
            linha_dre: r.linha_dre,
            grupo_bp: r.grupo_bp,
            cod_nota: r.cod_nota,
          })),
        )
        setImportados(res.criados + res.atualizados)
      } else {
        const validas = rowsBalancete.filter((r) => r.isValid)
        const empresas = Array.from(new Set(validas.map((r) => r.empresa || 'GERAL')))
        const periodos = Array.from(new Set(validas.map((r) => r.periodo)))
        let total = 0
        for (const emp of empresas) {
          for (const per of periodos) {
            const linhas = validas.filter(
              (r) => (r.empresa || 'GERAL') === emp && r.periodo === per,
            )
            const anoLinha =
              linhas[0]?.ano ?? parseInt(defaults.ano, 10) ?? new Date().getFullYear()
            const gravadas = await importarBalanceteLote(
              linhas.map((r) => ({
                empresa: r.empresa || 'GERAL',
                ano: r.ano,
                periodo: r.periodo,
                conta: r.conta,
                descricao: r.descricao,
                saldo: r.saldo_final,
                saldo_inicial: r.saldo_inicial,
                debitos: r.debitos,
                creditos: r.creditos,
                saldo_final: r.saldo_final,
                natureza: r.natureza,
                moeda: r.moeda,
                centro_custo: r.centro_custo,
                segmento: r.segmento,
                lote: loteAtual,
                linha_bp: r.linha_bp,
                linha_dre: r.linha_dre,
                cod_nota: r.cod_nota,
              })),
              { empresa: emp, ano: anoLinha, periodo: per },
            )
            total += gravadas
          }
        }
        setImportados(total)
      }
      setProgesso(100)
      setEtapa('concluido')
      toast({ title: 'Importação concluída', description: `${importados || 'linhas'} gravadas.` })
    } catch (e) {
      toast({
        title: 'Falha na importação',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  const reiniciar = () => {
    setArquivo(null)
    setTexto('')
    setEtapa('selecionar')
    setColMap(null)
    setHeaders([])
    setRowsBalancete([])
    setRowsDepara([])
    setFatalError(null)
    setImportados(0)
    setProgesso(0)
  }

  const baixarModelo = (conteudo: string, nome: string) => {
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          Importação de {ehDePara ? 'De-Para' : 'Balancete'}
        </h1>
        <p className="text-xs text-muted-foreground">
          CSV exportado do Excel (separador ponto-e-vírgula, números 5.756,17, período 2024-08).
          Prévia obrigatória antes de gravar.
        </p>
      </div>

      <ImportStepper
        etapa={
          etapa === 'selecionar'
            ? 1
            : etapa === 'mapear'
              ? 3
              : etapa === 'concluido'
                ? 6
                : erros.length > 0
                  ? 5
                  : 4
        }
      />

      {etapa === 'selecionar' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Selecione o arquivo CSV</CardTitle>
            <CardDescription>
              O arquivo pode conter BOM, quebras de linha do Windows, aspas e células vazias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="arquivo-csv">Arquivo CSV</Label>
              <Input
                id="arquivo-csv"
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={(e) => handleSelecionarArquivo(e.target.files?.[0])}
              />
            </div>

            {!ehDePara && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="def-empresa">Empresa padrão</Label>
                  <Input
                    id="def-empresa"
                    value={defaults.empresa}
                    onChange={(e) =>
                      setDefaults({ ...defaults, empresa: e.target.value.toUpperCase() })
                    }
                    placeholder="ALFA"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="def-periodo">Período padrão</Label>
                  <Input
                    id="def-periodo"
                    value={defaults.periodo}
                    onChange={(e) => setDefaults({ ...defaults, periodo: e.target.value })}
                    placeholder="2024-08"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="def-ano">Ano padrão</Label>
                  <Input
                    id="def-ano"
                    value={defaults.ano}
                    onChange={(e) => setDefaults({ ...defaults, ano: e.target.value })}
                    placeholder="2024"
                    inputMode="numeric"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => baixarModelo(CSV_MODELO_BALANCETE, 'modelo-balancete.csv')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Baixar modelo balancete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => baixarModelo(CSV_MODELO_DEPARA, 'modelo-depara.csv')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Baixar modelo De-Para
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 'mapear' && colMap && !ehDePara && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Conferência das colunas detectadas</CardTitle>
            <CardDescription>
              Arquivo: {arquivo?.name}. Confirme para validar as {rowsBalancete.length || '...'}{' '}
              linhas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ['empresa', 'Empresa'],
                  ['ano', 'Ano'],
                  ['periodo', 'Período'],
                  ['conta', 'Conta'],
                  ['descricao', 'Descrição'],
                  ['saldo_inicial', 'Saldo Inicial'],
                  ['debitos', 'Débitos'],
                  ['creditos', 'Créditos'],
                  ['saldo_final', 'Saldo Final'],
                  ['natureza', 'Natureza'],
                  ['moeda', 'Moeda'],
                  ['centro_custo', 'Centro de Custo'],
                  ['segmento', 'Segmento'],
                  ['linha_bp', 'Linha BP'],
                  ['linha_dre', 'Linha DRE'],
                  ['cod_nota', 'Cod. Nota'],
                ] as Array<[keyof ColumnMap, string]>
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[11px]">{label}</Label>
                  <Select
                    value={String(colMap[key])}
                    onValueChange={(v) => setColMap({ ...colMap, [key]: parseInt(v, 10) })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1" className="text-xs">
                        (não usar)
                      </SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)} className="text-xs">
                          {i + 1}. {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={validar}>
                Validar e ver prévia
              </Button>
              <Button variant="ghost" size="sm" onClick={reiniciar}>
                Trocar arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 'previa' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                3. Prévia — {linhasValidas.length} linhas prontas para gravar
              </CardTitle>
              <CardDescription>
                {ehDePara
                  ? 'Mapeamento substitui o anterior conta a conta, sem duplicar.'
                  : 'Reimportar o mesmo período substitui os valores, sem duplicar contas.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fatalError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Arquivo rejeitado</AlertTitle>
                  <AlertDescription>{fatalError}</AlertDescription>
                </Alert>
              )}
              {erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{erros.length} erro(s) de validação</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                      {erros.slice(0, 30).map((e, i) => (
                        <li key={i}>
                          <b>Linha {e.linha}</b>, coluna <b>{e.coluna}</b>: {e.msg}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {alertasBalancete.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{alertasBalancete.length} alerta(s) de conferência</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
                      {alertasBalancete.slice(0, 30).map((e, i) => (
                        <li key={i}>
                          <b>Linha {e.linha}</b>, coluna <b>{e.coluna}</b>: {e.msg}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {!fatalError && erros.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Tudo validado</AlertTitle>
                  <AlertDescription>
                    Nenhum erro.{' '}
                    {ehDePara
                      ? 'Pronto para substituir o mapeamento.'
                      : 'Pronto para gravar os 4 saldos por conta.'}
                  </AlertDescription>
                </Alert>
              )}

              {!ehDePara && contasSemMapeamento.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{contasSemMapeamento.length} conta(s) sem mapeamento</AlertTitle>
                  <AlertDescription>
                    Elas serão gravadas, mas não entram no Balanço até serem classificadas no
                    De-Para:
                    <ul className="list-disc pl-4 mt-1">
                      {contasSemMapeamento.slice(0, 10).map((r) => (
                        <li key={r.linhaArquivo}>
                          {r.conta} — {r.descricao}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {erros.length === 0 && !fatalError && linhasValidas.length > 0 && (
                <div className="border rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead className="text-xs">Linha</TableHead>
                        {ehDePara ? (
                          <>
                            <TableHead className="text-xs">Conta</TableHead>
                            <TableHead className="text-xs">Descrição</TableHead>
                            <TableHead className="text-xs">LinhaBP</TableHead>
                            <TableHead className="text-xs">LinhaDRE</TableHead>
                            <TableHead className="text-xs">Grupo_BP</TableHead>
                            <TableHead className="text-xs">Cod_Nota</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="text-xs">Empresa</TableHead>
                            <TableHead className="text-xs">Conta</TableHead>
                            <TableHead className="text-xs">Descrição</TableHead>
                            <TableHead className="text-xs text-right">Saldo Inicial</TableHead>
                            <TableHead className="text-xs text-right">Débitos</TableHead>
                            <TableHead className="text-xs text-right">Créditos</TableHead>
                            <TableHead className="text-xs text-right">Saldo Final</TableHead>
                            <TableHead className="text-xs text-center">Nat</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ehDePara ? rowsDepara : rowsBalancete).slice(0, 100).map((r) => (
                        <TableRow
                          key={r.linhaArquivo}
                          className={r.isValid ? '' : 'bg-destructive/5'}
                        >
                          <TableCell className="text-xs font-mono">{r.linhaArquivo}</TableCell>
                          {'conta' in r && (
                            <>
                              <TableCell className="text-xs font-mono">{r.conta}</TableCell>
                              <TableCell className="text-xs max-w-[220px] truncate">
                                {r.descricao}
                              </TableCell>
                              {'linha_bp' in r && (
                                <>
                                  <TableCell className="text-xs">{r.linha_bp || '—'}</TableCell>
                                  <TableCell className="text-xs">{r.linha_dre || '—'}</TableCell>
                                  {'grupo_bp' in r && (
                                    <TableCell className="text-xs">{r.grupo_bp || '—'}</TableCell>
                                  )}
                                  <TableCell className="text-xs">{r.cod_nota || '—'}</TableCell>
                                </>
                              )}
                              {'saldo_inicial' in r && (
                                <>
                                  <TableCell className="text-xs text-right font-mono">
                                    {formatMoeda((r as ParsedRow).saldo_inicial)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    {formatMoeda((r as ParsedRow).debitos)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    {formatMoeda((r as ParsedRow).creditos)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono font-semibold">
                                    {formatMoeda((r as ParsedRow).saldo_final)}
                                  </TableCell>
                                  <TableCell className="text-xs text-center">
                                    <Badge variant="outline">{(r as ParsedRow).natureza}</Badge>
                                  </TableCell>
                                </>
                              )}
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Separator />
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  onClick={confirmarImportacao}
                  disabled={
                    importando || erros.length > 0 || !!fatalError || linhasValidas.length === 0
                  }
                >
                  {importando
                    ? 'Gravando...'
                    : `Confirmar importação (${linhasValidas.length} linhas)`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEtapa('selecionar')}
                  disabled={importando}
                >
                  Voltar
                </Button>
              </div>
              {importando && <Progress value={progesso} />}
            </CardContent>
          </Card>
        </div>
      )}

      {etapa === 'concluido' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importação concluída
            </CardTitle>
            <CardDescription>
              {importados} linha(s) gravada(s) no lote {lote || '—'}.
              {user?.email ? ` Operador: ${user.email}.` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button size="sm" onClick={reiniciar}>
              Importar outro arquivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ImportarBalancete

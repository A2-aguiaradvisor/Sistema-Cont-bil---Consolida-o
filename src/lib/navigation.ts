// Definição das categorias e itens do menu lateral fixo.
// Itens sem módulo funcional ainda são marcados como "desenvolvimento" e renderizam desabilitados.

import {
  LayoutDashboard,
  UploadCloud,
  Bot,
  FileSpreadsheet,
  GitCompareArrows,
  Scale,
  TrendingUp,
  Building2,
  Network,
  CalendarRange,
  BookOpen,
  ArrowLeftRight,
  FileText,
  SlidersHorizontal,
  Link2,
  Layers,
  PieChart,
  BarChart3,
  LineChart,
  CheckSquare,
  ClipboardCheck,
  AlertTriangle,
  Stamp,
  History,
  ScrollText,
  Workflow,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path?: string
  icon: LucideIcon
  disabled?: boolean
  tooltip?: string
}

export interface NavCategory {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'gestao',
    label: 'Gestão',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Empresas', icon: Building2, disabled: true },
      { label: 'Grupos econômicos', icon: Network, disabled: true },
      { label: 'Períodos contábeis', icon: CalendarRange, disabled: true },
    ],
  },
  {
    id: 'processamento',
    label: 'Processamento',
    items: [
      { label: 'Importação de arquivos', path: '/importar', icon: UploadCloud },
      { label: 'Balancetes', path: '/balancete', icon: FileSpreadsheet },
      { label: 'Plano de contas', icon: BookOpen, disabled: true },
      { label: 'Mapeamento contábil', path: '/depara', icon: GitCompareArrows },
      { label: 'Movimentações e razão', icon: ArrowLeftRight, disabled: true },
    ],
  },
  {
    id: 'consolidacao',
    label: 'Consolidação',
    items: [
      { label: 'Ajustes contábeis', icon: FileText, disabled: true },
      { label: 'Eliminações', path: '/eliminacoes', icon: SlidersHorizontal },
      { label: 'Intercompany', icon: Link2, disabled: true },
      { label: 'Balancete consolidado', icon: Layers, disabled: true },
    ],
  },
  {
    id: 'demonstracoes',
    label: 'Demonstrações',
    items: [
      { label: 'Balanço patrimonial', path: '/balanco-consolidado', icon: Scale },
      { label: 'DRE', path: '/dre', icon: TrendingUp },
      { label: 'DFC', icon: PieChart, disabled: true },
      { label: 'Comparativos financeiros', icon: BarChart3, disabled: true },
    ],
  },
  {
    id: 'controle',
    label: 'Controle e Revisão',
    items: [
      { label: 'Checks contábeis', path: '/conciliacao', icon: CheckSquare },
      { label: 'Conciliações', path: '/conciliacao', icon: ClipboardCheck },
      { label: 'Pendências', icon: AlertTriangle, disabled: true },
      { label: 'Aprovações', icon: Stamp, disabled: true },
      { label: 'Assistente IA', path: '/assistente', icon: Bot },
      { label: 'Histórico de auditoria', icon: History, disabled: true },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    items: [
      { label: 'Normas contábeis', icon: ScrollText, disabled: true },
      { label: 'Regras de processamento', icon: Workflow, disabled: true },
      { label: 'Usuários e permissões', icon: Users, disabled: true },
      { label: 'Configurações gerais', icon: Settings, disabled: true },
    ],
  },
]

export interface SearchResult {
  label: string
  category: string
  path?: string
  disabled?: boolean
}

/** Busca global simples: filtra itens do menu + telas existentes. */
export function searchNav(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: SearchResult[] = []
  for (const cat of NAV_CATEGORIES) {
    for (const item of cat.items) {
      if (item.label.toLowerCase().includes(q)) {
        results.push({
          label: item.label,
          category: cat.label,
          path: item.path,
          disabled: item.disabled,
        })
      }
    }
  }
  return results.slice(0, 8)
}

export const DISABLED_TOOLTIP = 'Módulo em desenvolvimento'

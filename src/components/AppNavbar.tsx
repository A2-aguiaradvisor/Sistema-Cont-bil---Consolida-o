import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  GitCompareArrows,
  SlidersHorizontal,
  Scale,
  TrendingUp,
  LogOut,
  Building2,
  Menu,
  X,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Importar Balancete', path: '/importar', icon: UploadCloud },
  { label: 'Balancete', path: '/balancete', icon: FileSpreadsheet },
  { label: 'De-Para de Contas', path: '/depara', icon: GitCompareArrows },
  { label: 'Eliminações', path: '/eliminacoes', icon: SlidersHorizontal },
  { label: 'Balanço Consolidado', path: '/balanco-consolidado', icon: Scale },
  { label: 'DRE Consolidada', path: '/dre', icon: TrendingUp },
]

export const AppNavbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo e Nome da Aplicação */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-foreground flex items-center gap-1.5">
                Grupo ABC <span className="text-primary font-bold">Consolidação</span>
              </span>
              <p className="text-[11px] text-muted-foreground leading-none">
                Sistema Contábil Corporativo
              </p>
            </div>
          </Link>
          <Badge
            variant="outline"
            className="hidden md:inline-flex text-[10px] ml-2 border-primary/30 text-primary bg-primary/5"
          >
            CPC 36 / IFRS 10
          </Badge>
        </div>

        {/* Navegação Desktop */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Perfil & Ações */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-foreground leading-tight flex items-center justify-end gap-1">
                  <UserCheck className="h-3 w-3 text-emerald-600" />
                  {user?.name || user?.email || 'Contabilidade'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {user?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="default" className="text-xs font-medium">
                Entrar
              </Button>
            </Link>
          )}

          {/* Botão Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t bg-background px-4 pt-2 pb-4 space-y-1 shadow-lg animate-in slide-in-from-top-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
          {isAuthenticated && (
            <div className="pt-2 border-t mt-2">
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair ({user?.email})
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

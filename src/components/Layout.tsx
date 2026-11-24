// Layout da aplicação: sidebar fixa com categorias + busca global + área de conteúdo.

import React, { useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, LogOut, Search, Menu, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_CATEGORIES, searchNav, DISABLED_TOOLTIP, type NavItem } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const GlobalSearch: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const results = useMemo(() => searchNav(query), [query])

  const go = (path?: string, disabled?: boolean) => {
    if (disabled || !path) return
    onNavigate()
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  return (
    <div className="relative px-3 pb-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) go(results[0].path, results[0].disabled)
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
          }}
          placeholder="Buscar conta, empresa, tela…"
          className="w-full h-9 rounded-md border border-slate-300 bg-white pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-petrol focus:outline-none focus:ring-1 focus:ring-petrol"
          aria-label="Busca global"
        />
        <kbd className="absolute right-2 top-2 rounded border border-slate-200 bg-slate-50 px-1 text-[10px] text-slate-400">
          /
        </kbd>
      </div>
      {open && query.trim() && (
        <div className="absolute z-50 mt-1 w-[calc(100%-24px)] rounded-md border border-slate-200 bg-white shadow-md max-h-72 overflow-auto">
          {results.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-500">Nenhum resultado para “{query}”.</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.category}-${r.label}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(r.path, r.disabled)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50',
                r.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="text-slate-800">{r.label}</span>
              <span className="text-[10px] text-slate-400">{r.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const NavRow: React.FC<{ item: NavItem; active: boolean; onNavigate?: () => void }> = ({
  item,
  active,
  onNavigate,
}) => {
  const Icon = item.icon
  const content = (
    <span
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-petrol/15 font-medium text-white'
          : item.disabled
            ? 'cursor-not-allowed text-slate-500'
            : 'text-slate-300 hover:bg-white/5 hover:text-white',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </span>
  )
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {item.disabled ? (
            <div className="w-full cursor-not-allowed">{content}</div>
          ) : (
            <Link to={item.path!} onClick={onNavigate} className="block" tabIndex={0}>
              {content}
            </Link>
          )}
        </TooltipTrigger>
        {item.disabled && <TooltipContent>{DISABLED_TOOLTIP}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  )
}

const SidebarContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const location = useLocation()
  const [openCategories, setOpenCategories] = useState<string[]>(NAV_CATEGORIES.map((c) => c.id))

  const toggle = (id: string) =>
    setOpenCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  return (
    <div className="flex h-full flex-col bg-navy text-slate-200">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
          <Building2 className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Grupo ABC</p>
          <p className="text-[10px] text-slate-400">Consolidação Contábil</p>
        </div>
      </div>

      <GlobalSearch onNavigate={onNavigate ?? (() => {})} />

      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1" aria-label="Menu principal">
        {NAV_CATEGORIES.map((cat) => {
          const isOpen = openCategories.includes(cat.id)
          const hasActive = cat.items.some((i) => i.path === location.pathname)
          return (
            <div key={cat.id}>
              <button
                onClick={() => toggle(cat.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  hasActive ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                )}
                aria-expanded={isOpen}
              >
                {cat.label}
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', !isOpen && '-rotate-90')}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 border-l border-white/10 pl-2 ml-2">
                  {cat.items.map((item) => (
                    <NavRow
                      key={item.label}
                      item={item}
                      active={item.path === location.pathname}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar fixa desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:shrink-0 border-r border-white/10">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 text-white hover:bg-white/10"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-slate-600"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-xs text-slate-500">
              Sistema Contábil · <span className="font-medium text-slate-700">Grupo ABC</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    aria-label="Menu do usuário"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-petrol/10 text-[11px] font-semibold text-petrol">
                      {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden sm:inline max-w-[140px] truncate">
                      {user?.name || user?.email || 'Usuário'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs">
                    <p className="font-medium text-slate-800 truncate">{user?.email}</p>
                    <p className="text-[10px] text-slate-400 font-normal">Conta autenticada</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-xs text-red-700 focus:text-red-800 focus:bg-red-50"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button size="sm" className="text-xs">
                  Entrar
                </Button>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default Layout

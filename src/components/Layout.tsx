import React from 'react'
import { Outlet } from 'react-router-dom'
import { AppNavbar } from '@/components/AppNavbar'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60 text-foreground antialiased">
      <AppNavbar />
      <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
      <footer className="border-t bg-card py-4 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Grupo ABC — Sistema de Consolidação Contábil CPC 36</p>
          <p className="text-[11px]">
            Balanço Patrimonial, DRE, De-Para de Contas e Quadratura Automatizada
          </p>
        </div>
      </footer>
    </div>
  )
}

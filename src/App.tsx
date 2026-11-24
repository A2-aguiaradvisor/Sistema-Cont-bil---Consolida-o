/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import Layout from '@/components/Layout'

// Páginas
import Dashboard from '@/pages/Dashboard'
import ImportarBalancete from '@/pages/ImportarBalancete'
import Balancete from '@/pages/Balancete'
import DePara from '@/pages/DePara'
import Eliminacoes from '@/pages/Eliminacoes'
import BalancoConsolidado from '@/pages/BalancoConsolidado'
import DRE from '@/pages/DRE'
import Assistente from '@/pages/Assistente'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'

// Rota protegida para garantir autenticação
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-xs text-muted-foreground">
        Carregando sessão contábil...
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/importar"
              element={
                <ProtectedRoute>
                  <ImportarBalancete />
                </ProtectedRoute>
              }
            />
            <Route
              path="/balancete"
              element={
                <ProtectedRoute>
                  <Balancete />
                </ProtectedRoute>
              }
            />
            <Route
              path="/depara"
              element={
                <ProtectedRoute>
                  <DePara />
                </ProtectedRoute>
              }
            />
            <Route
              path="/eliminacoes"
              element={
                <ProtectedRoute>
                  <Eliminacoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/balanco-consolidado"
              element={
                <ProtectedRoute>
                  <BalancoConsolidado />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dre"
              element={
                <ProtectedRoute>
                  <DRE />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assistente"
              element={
                <ProtectedRoute>
                  <Assistente />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App

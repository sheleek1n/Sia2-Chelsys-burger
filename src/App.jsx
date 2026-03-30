import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import { pagesConfig } from './pages.config'
import CashierEntry from './pages/CashierEntry'
import DisplayNameEntry from './pages/DisplayNameEntry'

const { Pages, Layout, mainPage, Login } = pagesConfig
const mainPageKey = mainPage ?? Object.keys(Pages)[0]
const MainPage = mainPageKey ? Pages[mainPageKey] : () => null

const ADMIN_ONLY_PAGES = ['Dashboard', 'Products', 'SupplyChain']

function LayoutWrapper({ children, currentPageName }) {
  if (!Layout) return <>{children}</>
  return <Layout currentPageName={currentPageName}>{children}</Layout>
}

function ProtectedRoute({ children, pageName }) {
  const { user, loading } = useAuth()
  const { displayName, username } = useCashierStore()
  const isAdmin = user?.role === 'admin'

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    )
  }

  // If there's an active Admin session, they have access to everything (or admin pages)
  if (isAdmin) {
    return children
  }

  // If no Admin session, but there IS a cashier session
  if (username && displayName) {
    // Cashiers cannot access admin pages
    if (pageName && ADMIN_ONLY_PAGES.includes(pageName)) {
      return <Navigate to="/CashierPOS" replace />
    }
    return children
  }

  // If neither, send to login screen
  return <Navigate to="/cashier-entry" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin-login" element={<Login />} />
      <Route path="/cashier-entry" element={<CashierEntry />} />
      <Route path="/display-name-entry" element={<DisplayNameEntry />} />
      <Route
        path="/"
        element={
          <ProtectedRoute pageName={mainPageKey}>
            <LayoutWrapper currentPageName={mainPageKey}>
              <MainPage />
            </LayoutWrapper>
          </ProtectedRoute>
        }
      />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute pageName={path}>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster />
      </Router>
    </AuthProvider>
  )
}

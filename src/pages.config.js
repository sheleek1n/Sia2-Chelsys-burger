import Dashboard from './pages/Dashboard'
import CashierPOS from './pages/CashierPOS'
import Orders from './pages/Orders'
import Products from './pages/Products'
import SupplyChain from './pages/SupplyChain'
import ProductionLog from './pages/ProductionLog'
import Settings from './pages/Settings'
import Layout from './Layout'

export const PAGES = {
  Dashboard,
  CashierPOS,
  Orders,
  ProductionLog,
  Products,
  SupplyChain,
  Settings,
}

export const pagesConfig = {
  mainPage: 'Dashboard',
  Pages: PAGES,
  Layout,
}

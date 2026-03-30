import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { api } from '@/api'
import { Plus, Pencil, Trash2, AlertTriangle, ToggleLeft, ToggleRight, Search, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useLocation } from 'react-router-dom'
import PageHeader from '@/components/shared/PageHeader'
import IngredientForm from '@/components/inventory/IngredientForm'
import { useAuth } from '@/lib/AuthContext'

const CATEGORIES = ['burger', 'sides', 'drinks', 'combo', 'dessert']
const CATEGORY_COLORS = {
  burger: 'bg-orange-100 text-orange-700',
  sides: 'bg-yellow-100 text-yellow-700',
  drinks: 'bg-blue-100 text-blue-700',
  combo: 'bg-purple-100 text-purple-700',
  dessert: 'bg-pink-100 text-pink-700',
}

// ── Action badge styling ────────────────────────────
const ACTION_BADGE_STYLES = {
  pack_opened:        'bg-gray-100 text-gray-700 border-gray-200',
  stock_adjusted:     'bg-blue-100 text-blue-700 border-blue-200',
  delivery_received:  'bg-green-100 text-green-700 border-green-200',
  low_stock:          'bg-yellow-100 text-yellow-800 border-yellow-200',
  item_added:         'bg-teal-100 text-teal-700 border-teal-200',
  item_edited:        'bg-indigo-100 text-indigo-700 border-indigo-200',
  item_deleted:       'bg-red-100 text-red-700 border-red-200',
  expiry_added:       'bg-cyan-100 text-cyan-700 border-cyan-200',
  expiring_soon:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  expired:            'bg-red-100 text-red-700 border-red-200',
}

const ACTION_LABELS = {
  pack_opened:        'PACK OPENED',
  stock_adjusted:     'STOCK ADJUSTED',
  delivery_received:  'DELIVERY',
  low_stock:          'LOW STOCK',
  item_added:         'ITEM ADDED',
  item_edited:        'ITEM EDITED',
  item_deleted:       'ITEM DELETED',
  expiry_added:       'EXPIRY ADDED',
  expiring_soon:      'EXPIRING SOON',
  expired:            'EXPIRED',
}

// ── Action filter groups ────────────────────────────
const ACTION_FILTER_GROUPS = {
  all:            null,
  stock_changes:  ['stock_adjusted', 'pack_opened', 'delivery_received'],
  alerts:         ['low_stock'],
  admin_actions:  ['item_added', 'item_edited', 'item_deleted'],
  expiry_alerts:  ['expiring_soon', 'expired'],
}

const SEVERITY_DOTS = {
  info:     'bg-green-500',
  warning:  'bg-yellow-500',
  critical: 'bg-red-500',
}

const SEVERITY_ROW_BG = {
  info:     '',
  warning:  'bg-yellow-50',
  critical: 'bg-red-50',
}

const ITEMS_PER_PAGE = 20

// ── Helper: format timestamp ────────────────────────
function formatLogTime(isoStr) {
  const d = new Date(isoStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return timeStr
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`
}

// ── Helper: get today as YYYY-MM-DD ─────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatExpiryDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getExpiryBadgeClass(status) {
  if (!status) return ''
  if (status.severity === 'critical') return 'bg-red-100 text-red-700 border-red-200'
  if (status.color === 'orange') return 'bg-orange-100 text-orange-700 border-orange-200'
  if (status.color === 'yellow') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

export default function Products() {
  const { user } = useAuth()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState('menu')
  const ingredientRowRefs = useRef({})

  // Menu State
  const [menuItems, setMenuItems] = useState([])
  const [menuFormOpen, setMenuFormOpen] = useState(false)
  const [menuEditing, setMenuEditing] = useState(null)
  const [menuForm, setMenuForm] = useState({ name: '', category: 'burger', price: 0, is_available: true })
  const [menuLoading, setMenuLoading] = useState(true)

  // Inventory State
  const [ingredients, setIngredients] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientFormOpen, setIngredientFormOpen] = useState(false)
  const [ingredientEditing, setIngredientEditing] = useState(null)
  const [ingredientLoading, setIngredientLoading] = useState(true)
  const [dismissedAlerts, setDismissedAlerts] = useState([])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ type: 'add', qty: 1, reason: '' })

  // Activity Log State
  const [logs, setLogs] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [logDateFrom, setLogDateFrom] = useState(todayStr())
  const [logDateTo, setLogDateTo] = useState(todayStr())
  const [logActionFilter, setLogActionFilter] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [logPage, setLogPage] = useState(1)

  const loadMenu = () => api.menuItems.list().then((i) => { setMenuItems(i); setMenuLoading(false) })
  const loadIngredients = () => api.ingredients.list().then((i) => { setIngredients(i); setIngredientLoading(false) })

  const loadLogs = useCallback(() => {
    setLogLoading(true)
    api.inventoryLogs.list({
      dateFrom: logDateFrom || undefined,
      dateTo: logDateTo || undefined,
    }).then((data) => {
      setLogs(data)
      setLogLoading(false)
    })
  }, [logDateFrom, logDateTo])

  useEffect(() => {
    loadMenu()
    loadIngredients()
  }, [])

  const checkAndLogExpiryAlerts = useCallback(async () => {
    if (!isAdmin) return
    const today = new Date().toDateString()
    const lastChecked = localStorage.getItem('expiry_check_date')
    if (lastChecked === today) return

    localStorage.setItem('expiry_check_date', today)
    await api.ingredients.checkAndLogExpiryAlerts()
    if (activeTab === 'activity') {
      loadLogs()
    }
  }, [activeTab, isAdmin, loadLogs])

  useEffect(() => {
    checkAndLogExpiryAlerts()
  }, [checkAndLogExpiryAlerts])

  useEffect(() => {
    const target = location.state?.defaultTab
    if (!target) return

    if (target === 'ingredients' || target === 'inventory') {
      setActiveTab('inventory')
      return
    }
    if (target === 'activity' && isAdmin) {
      setActiveTab('activity')
    }
  }, [isAdmin, location.state])

  // Reload logs when the activity log tab is active or filters change
  useEffect(() => {
    if (activeTab === 'activity') {
      loadLogs()
    }
  }, [activeTab, loadLogs])

  // Filtered logs (client-side for action group + search)
  const filteredLogs = useMemo(() => {
    let result = [...logs]

    // Action group filter
    const allowedActions = ACTION_FILTER_GROUPS[logActionFilter]
    if (allowedActions) {
      result = result.filter((l) => allowedActions.includes(l.action))
    }

    // Search by ingredient name
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase()
      result = result.filter((l) => (l.ingredientName || '').toLowerCase().includes(q))
    }

    return result
  }, [logs, logActionFilter, logSearch])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE))
  const paginatedLogs = filteredLogs.slice((logPage - 1) * ITEMS_PER_PAGE, logPage * ITEMS_PER_PAGE)

  // Reset page when filters change
  useEffect(() => { setLogPage(1) }, [logActionFilter, logSearch, logDateFrom, logDateTo])

  // Summary stats (today only)
  const todaySummary = useMemo(() => {
    const today = new Date()
    const todayLogs = logs.filter((l) => new Date(l.createdAt).toDateString() === today.toDateString())
    return {
      total: todayLogs.length,
      warnings: todayLogs.filter((l) => l.severity === 'warning').length,
      critical: todayLogs.filter((l) => l.severity === 'critical').length,
    }
  }, [logs])

  // Menu Handlers
  const openMenuForm = (item = null) => {
    setMenuEditing(item)
    setMenuForm(item ? { ...item } : { name: '', category: 'burger', price: 0, is_available: true })
    setMenuFormOpen(true)
  }

  const handleMenuSave = async () => {
    if (menuEditing) {
      await api.menuItems.update(menuEditing.id, menuForm)
      toast.success('Menu item updated!')
    } else {
      await api.menuItems.create(menuForm)
      toast.success('Menu item added!')
    }
    setMenuFormOpen(false)
    loadMenu()
  }

  const handleMenuDelete = async (id) => {
    await api.menuItems.delete(id)
    toast.success('Deleted!')
    loadMenu()
  }

  const toggleAvailability = async (item) => {
    await api.menuItems.update(item.id, { is_available: !item.is_available })
    loadMenu()
  }

  // Inventory Handlers
  const handleIngredientSave = async (data) => {
    if (ingredientEditing) {
      await api.ingredients.update(ingredientEditing.id, data)
      toast.success('Ingredient updated!')
    } else {
      await api.ingredients.create(data)
      toast.success('Ingredient added!')
    }
    setIngredientEditing(null)
    setIngredientFormOpen(false)
    loadIngredients()
  }

  const handleIngredientDelete = async (id) => {
    await api.ingredients.delete(id)
    toast.success('Deleted!')
    loadIngredients()
  }

  const openAdjustModal = (item) => {
    setAdjustingItem(item)
    setAdjustForm({ type: 'add', qty: 1, reason: '' })
    setAdjustOpen(true)
  }

  const handleAdjustSave = async () => {
    if (!adjustingItem) return
    const qty = Number(adjustForm.qty) || 0
    if (qty < 0 || (adjustForm.type !== 'set' && qty === 0)) {
      toast.error('Enter a valid quantity')
      return
    }

    await api.ingredients.adjust(adjustingItem.id, {
      type: adjustForm.type,
      qty,
      reason: adjustForm.reason || 'Adjustment from alert banner',
      loggedBy: user?.full_name || 'Admin',
    })

    toast.success('Stock adjusted')
    setAdjustOpen(false)
    setAdjustingItem(null)
    loadIngredients()
    if (activeTab === 'activity') {
      loadLogs()
    }
  }

  const viewIngredientInTable = (ingredientId) => {
    setActiveTab('inventory')
    setTimeout(() => {
      ingredientRowRefs.current[ingredientId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const alerts = useMemo(() => {
    const list = ingredients.flatMap((item) => {
      const issues = []
      const expiryStatus = api.ingredients.getExpiryStatus(item.expiry_date)

      if ((item.current_stock || 0) <= 1) {
        issues.push({
          key: `${item.id}:critical_stock`,
          ingredientId: item.id,
          severity: 'critical',
          priority: 1,
          icon: '🔴',
          label: 'Critical Stock',
          secondary: `Stock: ${item.current_stock || 0} remaining`,
          action: 'adjust',
          item,
        })
      } else if ((item.current_stock || 0) <= (item.warning_level || 0)) {
        issues.push({
          key: `${item.id}:low_stock`,
          ingredientId: item.id,
          severity: 'warning',
          priority: 3,
          icon: '🟡',
          label: 'Low Stock',
          secondary: `Warning level: ${item.warning_level}`,
          action: 'adjust',
          item,
        })
      }

      if (expiryStatus?.severity === 'critical') {
        issues.push({
          key: `${item.id}:expired`,
          ingredientId: item.id,
          severity: 'critical',
          priority: 0,
          icon: '🔴',
          label: `EXPIRED - ${formatExpiryDate(item.expiry_date)}`,
          secondary: `Stock: ${item.current_stock || 0} remaining`,
          action: 'view',
          item,
        })
      } else if (expiryStatus?.severity === 'warning') {
        issues.push({
          key: `${item.id}:expiring`,
          ingredientId: item.id,
          severity: 'warning',
          priority: expiryStatus.days <= 3 ? 2 : 4,
          icon: expiryStatus.days <= 3 ? '🟠' : '🟡',
          label: `${expiryStatus.label} - ${formatExpiryDate(item.expiry_date)}`,
          secondary: `Stock: ${item.current_stock || 0} remaining`,
          action: 'view',
          item,
        })
      }

      return issues
    })

    return list.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return (a.item.name || '').localeCompare(b.item.name || '')
    })
  }, [ingredients])

  const visibleAlerts = useMemo(() => {
    if (!isAdmin) return []
    return alerts.filter((a) => a.severity === 'critical' || !dismissedAlerts.includes(a.ingredientId))
  }, [alerts, dismissedAlerts, isAdmin])

  const hasCriticalAlerts = visibleAlerts.some((a) => a.severity === 'critical')

  const dismissAlert = (ingredientId) => {
    setDismissedAlerts((prev) => (prev.includes(ingredientId) ? prev : [...prev, ingredientId]))
  }

  const dismissAll = () => {
    if (hasCriticalAlerts) return
    setDismissedAlerts((prev) => [...new Set([...prev, ...visibleAlerts.map((a) => a.ingredientId)])])
  }

  const filteredIngredients = useMemo(() => {
    const query = ingredientSearch.toLowerCase()
    const list = ingredients.filter((i) => i.name?.toLowerCase().includes(query))

    const getSortPriority = (item) => {
      const expiryStatus = api.ingredients.getExpiryStatus(item.expiry_date)
      const isCriticalStock = (item.current_stock || 0) <= 0
      const isLow = (item.current_stock || 0) <= (item.warning_level || 0)

      if (expiryStatus?.severity === 'critical') return 0
      if (expiryStatus?.severity === 'warning' && expiryStatus.days <= 3) return 1
      if (expiryStatus?.severity === 'warning') return 2
      if (isCriticalStock) return 3
      if (isLow) return 4
      return 5
    }

    return list.sort((a, b) => {
      const pA = getSortPriority(a)
      const pB = getSortPriority(b)
      if (pA !== pB) return pA - pB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [ingredients, ingredientSearch])

  const groupedMenu = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = menuItems.filter((i) => i.category === cat)
    return acc
  }, {})

  // Determine header action button based on active tab
  const headerAction = (() => {
    if (activeTab === 'menu') {
      return <Button onClick={() => openMenuForm()}> <Plus className="w-4 h-4 mr-2" /> Add Menu Item</Button>
    }
    if (activeTab === 'inventory') {
      return (
        <Button onClick={() => { setIngredientEditing(null); setIngredientFormOpen(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Add Inventory Item
        </Button>
      )
    }
    return null
  })()

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader 
        title="Products & Inventory" 
        subtitle="Manage your menu items and inventory stock" 
        action={headerAction}
      />

      {isAdmin && visibleAlerts.length > 0 && (
        <div className={`transition-all duration-300 overflow-hidden border rounded-xl ${hasCriticalAlerts ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${hasCriticalAlerts ? 'text-red-600' : 'text-yellow-700'}`} />
              <p className={`text-sm font-semibold ${hasCriticalAlerts ? 'text-red-800' : 'text-yellow-800'}`}>
                {visibleAlerts.length} items need your attention
              </p>
            </div>
            <button
              type="button"
              onClick={dismissAll}
              disabled={hasCriticalAlerts}
              className="text-sm w-7 h-7 rounded-md border border-black/10 hover:bg-white/70 disabled:opacity-40 disabled:cursor-not-allowed"
              title={hasCriticalAlerts ? 'Critical alerts cannot be dismissed' : 'Dismiss all warnings for this session'}
            >
              x
            </button>
          </div>

          <div>
            {visibleAlerts.map((alert, idx) => (
              <div key={alert.key} className={`px-4 py-3 ${idx > 0 ? 'border-t border-black/10' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      <span className="mr-2">{alert.icon}</span>
                      {alert.item.name} ({alert.item.unit})
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{alert.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.secondary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => alert.action === 'adjust' ? openAdjustModal(alert.item) : viewIngredientInTable(alert.ingredientId)}
                      className="text-sm px-2.5 py-1 rounded-md border border-black/15 hover:bg-white/70"
                    >
                      {alert.action === 'adjust' ? 'Adjust' : 'View'}
                    </button>
                    {alert.severity !== 'critical' && (
                      <button
                        type="button"
                        onClick={() => dismissAlert(alert.ingredientId)}
                        className="text-xs px-2 py-1 rounded-md border border-black/15 hover:bg-white/70"
                        title="Dismiss for this session"
                      >
                        x
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4 space-x-6">
          <TabsTrigger 
            value="menu" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
          >
            Menu Items
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
          >
            Raw Ingredients
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger 
              value="activity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Activity Log
            </TabsTrigger>
          )}
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MENU ITEMS TAB                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="menu" className="m-0 flex-1 overflow-y-auto outline-none">
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const catItems = groupedMenu[cat] || []
              if (catItems.length === 0) return null
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                  </div>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {catItems.map((item) => (
                      <div key={item.id} className={`bg-card border rounded-xl p-4 shadow-sm ${!item.is_available ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-start">
                          <p className="font-semibold">{item.name}</p>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => openMenuForm(item)} className="text-muted-foreground hover:text-primary p-1"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleMenuDelete(item.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-primary font-bold text-lg mt-1">₱{(item.price || 0).toFixed(2)}</p>
                        <button type="button" onClick={() => toggleAvailability(item)} className={`mt-2 flex items-center gap-1 text-xs ${item.is_available ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {item.is_available ? <><ToggleRight className="w-4 h-4" /> Available</> : <><ToggleLeft className="w-4 h-4" /> Unavailable</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {!menuLoading && menuItems.length === 0 && <div className="text-center py-16 text-muted-foreground">No menu items yet. Click Add Menu Item to get started.</div>}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* INVENTORY TAB                                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="inventory" className="m-0 flex-1 flex flex-col outline-none">
          <div className="mb-4">
            <Input 
              placeholder="Search inventory..." 
              value={ingredientSearch} 
              onChange={(e) => setIngredientSearch(e.target.value)} 
              className="max-w-sm"
            />
          </div>
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Inventory Item</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Unit</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Stock</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Warning Level</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Cost/Unit</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Supplier</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {ingredientLoading && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</td></tr>}
                {!ingredientLoading && filteredIngredients.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No inventory items found.</td></tr>}
                {filteredIngredients.map((item) => {
                  const expiryStatus = api.ingredients.getExpiryStatus(item.expiry_date)
                  const isExpired = expiryStatus?.severity === 'critical'
                  const isExpiringSoon = expiryStatus?.severity === 'warning'
                  const isCriticalStock = (item.current_stock || 0) <= 0
                  const isLow = item.current_stock <= item.warning_level
                  return (
                    <tr
                      key={item.id}
                      id={`ingredient-row-${item.id}`}
                      ref={(el) => { ingredientRowRefs.current[item.id] = el }}
                      className={`border-b last:border-0 hover:bg-muted/10 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : isCriticalStock ? 'bg-red-50/70' : isLow ? 'bg-yellow-50/70' : ''}`}
                    >
                      <td className="px-5 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          {item.name}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{item.unit}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.current_stock}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{item.warning_level}</td>
                      <td className="px-5 py-3 text-right">₱{(item.cost_per_unit || 0).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted-foreground">{item.supplier || '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCriticalStock ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                          {isCriticalStock ? 'Critical' : isLow ? 'Low Stock' : 'OK'}
                        </span>
                      </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {expiryStatus ? (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium border ${getExpiryBadgeClass(expiryStatus)}`}
                              title={isExpired ? `Expired on ${formatExpiryDate(item.expiry_date)}` : undefined}
                            >
                              {expiryStatus.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setIngredientEditing(item); setIngredientFormOpen(true) }} className="text-muted-foreground hover:text-primary">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleIngredientDelete(item.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ACTIVITY LOG TAB  (Admin only)                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <TabsContent value="activity" className="m-0 flex-1 flex flex-col outline-none">
            {/* ── Filters Row ─────────────────────────────────────────── */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              {/* Date From */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {/* Date To */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {/* Action Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Filter</label>
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
                >
                  <option value="all">All Actions</option>
                  <option value="stock_changes">Stock Changes</option>
                  <option value="alerts">Alerts</option>
                  <option value="expiry_alerts">Expiry Alerts</option>
                  <option value="admin_actions">Admin Actions</option>
                </select>
              </div>
              {/* Search */}
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by ingredient name..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="h-9 w-full pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* ── Summary Chips ───────────────────────────────────────── */}
            <div className="flex gap-3 mb-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border shadow-sm">
                <span className="text-xs font-medium text-muted-foreground">Total today</span>
                <span className="text-sm font-bold">{todaySummary.total}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs font-medium text-yellow-700">Warnings</span>
                <span className="text-sm font-bold text-yellow-700">{todaySummary.warnings}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-700">Critical</span>
                <span className="text-sm font-bold text-red-700">{todaySummary.critical}</span>
              </div>
            </div>

            {/* ── Log Table ───────────────────────────────────────────── */}
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
              {logLoading ? (
                <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">Loading activity log...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">No activity recorded yet.</p>
                  <p className="text-sm text-center max-w-sm">Actions like opening packs, adjusting stock, and receiving deliveries will appear here.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b bg-muted/20">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                          <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-10"></th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Action</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Ingredient</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Details</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Before → After</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.map((log) => (
                          <tr key={log.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${SEVERITY_ROW_BG[log.severity] || ''}`}>
                            {/* Time */}
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                              {formatLogTime(log.createdAt)}
                            </td>
                            {/* Severity dot */}
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${SEVERITY_DOTS[log.severity] || 'bg-gray-400'}`} title={log.severity} />
                            </td>
                            {/* Action badge */}
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${ACTION_BADGE_STYLES[log.action] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </td>
                            {/* Ingredient */}
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {log.ingredientName || '—'}
                            </td>
                            {/* Details */}
                            <td className="px-4 py-3 text-muted-foreground max-w-[420px] whitespace-normal break-words">
                              {log.details}
                            </td>
                            {/* Before → After */}
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              {log.previousValue || log.newValue ? (
                                <span className="text-muted-foreground">
                                  {log.previousValue && <span>{log.previousValue}</span>}
                                  {log.previousValue && log.newValue && <span className="mx-1">→</span>}
                                  {log.newValue && <span className="font-medium text-foreground">{log.newValue}</span>}
                                </span>
                              ) : (
                                <span />
                              )}
                            </td>
                            {/* By */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.performedBy === 'System' ? 'bg-gray-100 text-gray-600' : log.performedBy === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
                                {log.performedBy}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                      <span className="text-xs text-muted-foreground">
                        Showing {(logPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(logPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                          disabled={logPage === 1}
                          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let page
                          if (totalPages <= 5) {
                            page = i + 1
                          } else if (logPage <= 3) {
                            page = i + 1
                          } else if (logPage >= totalPages - 2) {
                            page = totalPages - 4 + i
                          } else {
                            page = logPage - 2 + i
                          }
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setLogPage(page)}
                              className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${logPage === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                            >
                              {page}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setLogPage((p) => Math.min(totalPages, p + 1))}
                          disabled={logPage === totalPages}
                          className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Menu Dialog */}
      <Dialog open={menuFormOpen} onOpenChange={setMenuFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{menuEditing ? 'Edit Item' : 'Add Menu Item'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={menuForm.name} onChange={(e) => setMenuForm((f) => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={menuForm.category} onValueChange={(v) => setMenuForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₱)</Label>
                <Input type="number" value={menuForm.price} onChange={(e) => setMenuForm((f) => ({ ...f, price: +e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMenuFormOpen(false)}>Cancel</Button>
              <Button onClick={handleMenuSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ingredient Dialog */}
      <IngredientForm open={ingredientFormOpen} onClose={() => { setIngredientFormOpen(false); setIngredientEditing(null) }} onSave={handleIngredientSave} initial={ingredientEditing} />

      {/* Stock Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {adjustingItem ? `Item: ${adjustingItem.name} (${adjustingItem.unit})` : ''}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add</SelectItem>
                    <SelectItem value="remove">Remove</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{adjustForm.type === 'set' ? 'Set stock to' : 'Quantity'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={adjustForm.qty}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, qty: Number(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Optional reason"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjustSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { api } from '@/api'
import { Plus, Pencil, Trash2, AlertTriangle, ToggleLeft, ToggleRight, Search, ClipboardList, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, Package } from 'lucide-react'
import { format } from 'date-fns'
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
import { getMenuItemIcon } from '@/utils/menuItemIcons'
import MenuItemImage from '@/components/shared/MenuItemImage'
import DeleteConfirmModal from '@/components/shared/DeleteConfirmModal'

const CATEGORIES = ['burger', 'chicken', 'sides', 'drinks', 'combo', 'dessert', 'snacks', 'other']
const CATEGORY_COLORS = {
  burger: 'bg-orange-100 text-orange-700',
  chicken: 'bg-amber-100 text-amber-700',
  sides: 'bg-yellow-100 text-yellow-700',
  drinks: 'bg-blue-100 text-blue-700',
  combo: 'bg-purple-100 text-purple-700',
  dessert: 'bg-pink-100 text-pink-700',
  snacks: 'bg-lime-100 text-lime-700',
  other: 'bg-slate-100 text-slate-700',
}
const MENU_EMOJI_OPTIONS = ['🍔', '🍗', '🍟', '🥤', '🍱', '🍦', '🧆', '🍽️', '🌮', '🌯', '🥪', '🍕', '🥗', '🧁', '🍰', '🧃', '🫙', '🥚', '🧀', '🥩', '🍖', '🌶️', '🧂', '🫒']

// ── Action badge styling ────────────────────────────
const ACTION_BADGE_STYLES = {
  pack_opened:        'bg-gray-100 text-gray-700 border-gray-200',
  stock_adjusted:     'bg-blue-100 text-blue-700 border-blue-200',
  delivery_received:  'bg-green-100 text-green-700 border-green-200',
  delivery_discrepancy: 'bg-orange-100 text-orange-700 border-orange-200',
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
  delivery_discrepancy: 'DELIVERY ISSUE',
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
  delivery_issues: ['delivery_discrepancy'],
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
const DEFAULT_UNCATEGORIZED_ID = 7
const CATEGORY_EMOJI_OPTIONS = ['🥩', '🍞', '🧀', '🥫', '🍟', '🧴', '📦', '🥤', '🍔', '🌶️', '🧂', '🥚', '🧅', '🫙', '🛢️']

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
  const [menuForm, setMenuForm] = useState({ name: '', category: 'burger', price: 0, is_available: true, emoji: null, image: null, recipe: [] })
  const [menuLoading, setMenuLoading] = useState(true)
  const [salesCounts, setSalesCounts] = useState({})

  // Inventory State
  const [ingredients, setIngredients] = useState([])
  const [ingredientCategories, setIngredientCategories] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState('all')
  const [ingredientFormOpen, setIngredientFormOpen] = useState(false)
  const [ingredientEditing, setIngredientEditing] = useState(null)
  const [ingredientLoading, setIngredientLoading] = useState(true)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [categoryEditing, setCategoryEditing] = useState(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '📦' })
  const [dismissedAlerts, setDismissedAlerts] = useState([])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ type: 'add', qty: 1, reason: '' })
  const [expandedBatchId, setExpandedBatchId] = useState(null)
  const [batchData, setBatchData] = useState([])
  const [showExhausted, setShowExhausted] = useState(false)

  // Activity Log State
  const [logs, setLogs] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [logDateFrom, setLogDateFrom] = useState(todayStr())
  const [logDateTo, setLogDateTo] = useState(todayStr())
  const [logActionFilter, setLogActionFilter] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [logPage, setLogPage] = useState(1)
  const [showActivityFilters, setShowActivityFilters] = useState(false)
  const [activityCompactMode, setActivityCompactMode] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { type, id, name, onConfirm }

  const loadMenu = () => api.menuItems.list().then((i) => { setMenuItems(i); setMenuLoading(false) }).catch(() => { setMenuLoading(false); toast.error('Failed to load menu items') })
  const loadSalesCounts = () => api.orders.list().then((orders) => {
    const counts = {}
    orders.filter((o) => o.status === 'completed').forEach((o) => {
      ;(o.items || []).forEach((item) => {
        counts[item.menu_item_id] = (counts[item.menu_item_id] || 0) + (item.quantity || 1)
      })
    })
    setSalesCounts(counts)
  }).catch(() => {})
  const loadIngredients = () => api.ingredients.list().then((i) => { setIngredients(i); setIngredientLoading(false) }).catch(() => { setIngredientLoading(false); toast.error('Failed to load ingredients') })
  const loadIngredientCategories = () => api.ingredientCategories.list().then((data) => setIngredientCategories(data))

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
    loadSalesCounts()
    loadIngredients()
    loadIngredientCategories()
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
    setMenuForm(item ? { ...item, emoji: item.emoji ?? null, image: item.image ?? null, recipe: item.recipe || [] } : { name: '', category: 'burger', price: 0, is_available: true, emoji: null, image: null, recipe: [] })
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

  const handleMenuDelete = (item) => {
    setDeleteConfirm({
      type: 'menu',
      title: 'Delete Menu Item',
      message: <>Remove <strong>{item.name}</strong> from the menu?</>,
      onConfirm: async () => {
        await api.menuItems.delete(item.id)
        toast.success('Deleted!')
        setDeleteConfirm(null)
        loadMenu()
      },
    })
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

  const handleIngredientDelete = (item) => {
    setDeleteConfirm({
      type: 'ingredient',
      title: 'Delete Ingredient',
      message: <>Remove <strong>{item.name}</strong> from inventory? All batch history for this ingredient will also be lost.</>,
      onConfirm: async () => {
        await api.ingredients.delete(item.id)
        toast.success('Deleted!')
        setDeleteConfirm(null)
        loadIngredients()
      },
    })
  }

  const openCategoryManager = () => {
    setCategoryEditing(null)
    setCategoryForm({ name: '', emoji: '📦' })
    setCategoryManagerOpen(true)
  }

  const startEditCategory = (category) => {
    setCategoryEditing(category)
    setCategoryForm({ name: category.name, emoji: category.emoji || '📦' })
  }

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      if (categoryEditing) {
        await api.ingredientCategories.update(categoryEditing.id, {
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji,
        })
        toast.success('Category updated')
      } else {
        await api.ingredientCategories.create({
          name: categoryForm.name.trim(),
          emoji: categoryForm.emoji,
        })
        toast.success('Category added')
      }
      setCategoryEditing(null)
      setCategoryForm({ name: '', emoji: '📦' })
      await loadIngredientCategories()
    } catch (err) {
      toast.error(err?.message || 'Failed to save category')
    }
  }

  const deleteCategory = (category) => {
    setDeleteConfirm({
      type: 'category',
      title: 'Delete Category',
      message: <>Remove the <strong>{category.name}</strong> category?</>,
      onConfirm: async () => {
        try {
          await api.ingredientCategories.delete(category.id)
          toast.success('Category deleted')
          setDeleteConfirm(null)
          if (ingredientCategoryFilter === String(category.id)) {
            setIngredientCategoryFilter('all')
          }
          await loadIngredientCategories()
        } catch (err) {
          toast.error(err?.message || 'Failed to delete category')
          setDeleteConfirm(null)
        }
      },
    })
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

  const toggleBatchView = async (ingredientId) => {
    if (expandedBatchId === ingredientId) {
      setExpandedBatchId(null)
      setBatchData([])
      setShowExhausted(false)
      return
    }
    const batches = await api.stockBatches.getByIngredient(ingredientId)
    setBatchData(batches)
    setExpandedBatchId(ingredientId)
    setShowExhausted(false)
  }

  const getBatchExpiryTint = (expiryDate) => {
    if (!expiryDate) return ''
    const status = api.ingredients.getExpiryStatus(expiryDate)
    if (!status) return ''
    if (status.severity === 'critical') return 'bg-red-50'
    if (status.severity === 'warning') {
      if (status.days <= 3) return 'bg-orange-50'
      return 'bg-yellow-50'
    }
    return ''
  }

  const renderBatchRow = (ingredientId) => {
    if (expandedBatchId !== ingredientId) return null
    const visibleBatches = showExhausted ? batchData : batchData.filter((b) => !b.isExhausted)
    const exhaustedCount = batchData.filter((b) => b.isExhausted).length
    return (
      <tr key={`batches-${ingredientId}`}>
        <td colSpan={10} className="px-0 py-0">
          <div className="bg-slate-50/50 border-t border-b px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Package className="w-3.5 h-3.5" />
                Stock Restocks — oldest is used first to avoid waste
              </div>
              {exhaustedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExhausted(!showExhausted)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  {showExhausted ? 'Hide' : 'Show'} {exhaustedCount} exhausted
                </button>
              )}
            </div>
            {visibleBatches.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No active restocks.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-1.5 pr-4 font-medium">Restock</th>
                    <th className="text-left py-1.5 pr-4 font-medium">Received</th>
                    <th className="text-left py-1.5 pr-4 font-medium">Expires</th>
                    <th className="text-right py-1.5 pr-4 font-medium">Left</th>
                    <th className="text-right py-1.5 pr-4 font-medium">Started With</th>
                    <th className="text-left py-1.5 pr-4 font-medium">Supplier</th>
                    <th className="text-left py-1.5 font-medium">PO</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBatches.map((batch, idx) => {
                    const expiryStatus = batch.expiryDate ? api.ingredients.getExpiryStatus(batch.expiryDate) : null
                    return (
                      <tr key={batch.id} className={`${batch.isExhausted ? 'opacity-40 line-through' : getBatchExpiryTint(batch.expiryDate)} ${idx === 0 && !batch.isExhausted ? 'font-medium' : ''}`}>
                        <td className="py-1.5 pr-4">
                          {idx === 0 ? 'Current restock' : 'Older restock'}
                          {idx === 0 && !batch.isExhausted && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">USING NOW</span>}
                        </td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{format(new Date(batch.receivedAt), 'MMM d, yyyy')}</td>
                        <td className="py-1.5 pr-4">
                          {batch.expiryDate ? (
                            <span className={expiryStatus?.severity === 'critical' ? 'text-red-600 font-medium' : expiryStatus?.severity === 'warning' ? 'text-orange-600' : 'text-muted-foreground'}>
                              {format(new Date(batch.expiryDate), 'MMM d, yyyy')}
                              {expiryStatus?.severity === 'critical' && ' (expired)'}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 pr-4 text-right">{batch.quantity}</td>
                        <td className="py-1.5 pr-4 text-right text-muted-foreground">{batch.originalQuantity}</td>
                        <td className="py-1.5 pr-4 text-muted-foreground">{batch.supplier || '—'}</td>
                        <td className="py-1.5 text-muted-foreground">{batch.poNumber || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </td>
      </tr>
    )
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

      if ((item.current_stock || 0) === 0) {
        issues.push({
          key: `${item.id}:critical_stock`,
          ingredientId: item.id,
          severity: 'critical',
          priority: 1,
          icon: '🔴',
          label: 'Out of Stock',
          secondary: `Stock: 0 remaining`,
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

  const getStockSortPriority = (item) => {
    const stock = Number(item.current_stock || 0)
    const warn = Number(item.warning_level || 0)
    if (stock <= 0) return 0
    if (stock <= warn) return 1
    return 2
  }

  const filteredIngredients = useMemo(() => {
    const query = ingredientSearch.toLowerCase()
    const list = ingredients.filter((i) => {
      const matchesSearch = i.name?.toLowerCase().includes(query)
      const itemCategoryId = Number(i.categoryId ?? DEFAULT_UNCATEGORIZED_ID)
      const matchesCategory = ingredientCategoryFilter === 'all' || itemCategoryId === Number(ingredientCategoryFilter)
      return matchesSearch && matchesCategory
    })

    return list.sort((a, b) => {
      const pA = getStockSortPriority(a)
      const pB = getStockSortPriority(b)
      if (pA !== pB) return pA - pB
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [ingredients, ingredientSearch, ingredientCategoryFilter])

  const categoriesWithItems = useMemo(() => {
    const counts = {}
    ingredients.forEach((item) => {
      const id = Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID)
      counts[id] = (counts[id] || 0) + 1
    })

    return ingredientCategories
      .filter((category) => counts[Number(category.id)] > 0)
      .sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      .map((category) => ({ ...category, count: counts[Number(category.id)] || 0 }))
  }, [ingredientCategories, ingredients])

  const groupedIngredientSections = useMemo(() => {
    const grouped = {}
    filteredIngredients.forEach((item) => {
      const id = Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID)
      grouped[id] = grouped[id] || []
      grouped[id].push(item)
    })

    if (ingredientCategoryFilter !== 'all') {
      return []
    }

    const sections = [...ingredientCategories]
      .sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      .filter((category) => (grouped[Number(category.id)] || []).length > 0 || Number(category.id) === DEFAULT_UNCATEGORIZED_ID)
      .map((category) => ({
        category,
        items: (grouped[Number(category.id)] || []).sort((a, b) => {
          const pA = getStockSortPriority(a)
          const pB = getStockSortPriority(b)
          if (pA !== pB) return pA - pB
          return (a.name || '').localeCompare(b.name || '')
        }),
      }))

    return sections
  }, [filteredIngredients, ingredientCategories, ingredientCategoryFilter])

  const groupedMenu = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = menuItems.filter((i) => i.category === cat)
    return acc
  }, {})

  // Determine header action button based on active tab
  const headerAction = (() => {
    if (activeTab === 'menu') {
      return <Button onClick={() => openMenuForm()}> <Plus className="w-4 h-4 mr-2" /> Add Item</Button>
    }
    if (activeTab === 'inventory') {
      return (
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={openCategoryManager}>
              <Settings className="w-4 h-4 mr-2" /> Categories
            </Button>
          )}
          <Button onClick={() => { setIngredientEditing(null); setIngredientFormOpen(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Add Stock Item
          </Button>
        </div>
      )
    }
    return null
  })()

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader 
        title="Menu & Stock"
        subtitle="Your menu prices and ingredient stock levels"
        compact
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
            Menu
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
          >
            Stock
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger 
              value="activity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2"
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              History
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
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-3" onError={(e) => { e.target.style.display = 'none' }} />
                        )}
                        <div className="flex justify-between items-start">
                          <p className="font-semibold">{item.name}</p>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => openMenuForm(item)} className="text-muted-foreground hover:text-primary p-1"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleMenuDelete(item)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-primary font-bold text-lg mt-1">₱{(item.price || 0).toFixed(2)}</p>
                        <div className="flex items-center justify-between mt-2">
                          <button type="button" onClick={() => toggleAvailability(item)} className={`flex items-center gap-1 text-xs ${item.is_available ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {item.is_available ? <><ToggleRight className="w-4 h-4" /> Available</> : <><ToggleLeft className="w-4 h-4" /> Unavailable</>}
                          </button>
                          {(salesCounts[item.id] || 0) > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">
                              {salesCounts[item.id]} sold
                            </span>
                          )}
                        </div>
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
          <div className="mb-3">
            <Input 
              placeholder="Search inventory..." 
              value={ingredientSearch} 
              onChange={(e) => setIngredientSearch(e.target.value)} 
              className="max-w-sm"
            />
          </div>
          <div className="mb-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pr-2">
              <button
                type="button"
                onClick={() => setIngredientCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${ingredientCategoryFilter === 'all' ? 'bg-[#B01010] text-white border-[#B01010]' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
              >
                All ({ingredients.length})
              </button>
              {categoriesWithItems.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setIngredientCategoryFilter(String(category.id))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${ingredientCategoryFilter === String(category.id) ? 'bg-[#B01010] text-white border-[#B01010]' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
                >
                  {category.emoji} {category.name} ({category.count})
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Inventory Item</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Unit</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Packs</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Pieces</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Warning Level</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Cost/Unit</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Supplier</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Expiry</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {ingredientLoading && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Loading...</td></tr>}
                {!ingredientLoading && filteredIngredients.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">No inventory items found.</td></tr>}
                {ingredientCategoryFilter !== 'all' && filteredIngredients.map((item) => {
                  const expiryStatus = api.ingredients.getExpiryStatus(item.expiry_date)
                  const isExpired = expiryStatus?.severity === 'critical'
                  const isExpiringSoon = expiryStatus?.severity === 'warning'
                  const isCriticalStock = (item.current_stock || 0) === 0
                  const isLow = item.current_stock <= item.warning_level
                  const isExpanded = expandedBatchId === item.id
                  return (
                    <Fragment key={item.id}>
                      <tr
                        id={`ingredient-row-${item.id}`}
                        ref={(el) => { ingredientRowRefs.current[item.id] = el }}
                        className={`border-b hover:bg-muted/10 cursor-pointer ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : isCriticalStock ? 'bg-red-50/70' : isLow ? 'bg-yellow-50/70' : ''}`}
                        onClick={() => toggleBatchView(item.id)}
                      >
                        <td className="px-5 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                            {item.name}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{item.unit}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.current_stock}</td>
                        <td className="px-5 py-3 text-right">
                          {item.pieces_per_pack && item.pieces_per_pack > 1 ? (
                            <div className="leading-tight">
                              <div className="font-semibold">
                                {(item.current_stock || 0) * item.pieces_per_pack + (item.open_pieces || 0)} pcs
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.open_pieces || 0} ready
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
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
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setIngredientEditing(item); setIngredientFormOpen(true) }} className="text-muted-foreground hover:text-primary">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleIngredientDelete(item)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {renderBatchRow(item.id)}
                    </Fragment>
                  )
                })}
                {ingredientCategoryFilter === 'all' && groupedIngredientSections.map((section) => (
                  <Fragment key={`section-${section.category.id}`}>
                    <tr key={`header-${section.category.id}`} className="bg-slate-50/80 border-b">
                      <td colSpan={10} className="px-5 py-2.5 text-sm font-semibold text-slate-700">
                        {section.category.emoji} {section.category.name}
                      </td>
                    </tr>
                    {section.items.length === 0 && Number(section.category.id) === DEFAULT_UNCATEGORIZED_ID && (
                      <tr key={`empty-${section.category.id}`} className="border-b">
                        <td colSpan={10} className="px-5 py-3 text-sm text-muted-foreground">No uncategorized ingredients</td>
                      </tr>
                    )}
                    {section.items.map((item) => {
                      const expiryStatus = api.ingredients.getExpiryStatus(item.expiry_date)
                      const isExpired = expiryStatus?.severity === 'critical'
                      const isExpiringSoon = expiryStatus?.severity === 'warning'
                      const isCriticalStock = (item.current_stock || 0) === 0
                      const isLow = item.current_stock <= item.warning_level
                      const isExpanded = expandedBatchId === item.id
                      return (
                        <Fragment key={`item-${item.id}`}>
                          <tr
                            id={`ingredient-row-${item.id}`}
                            ref={(el) => { ingredientRowRefs.current[item.id] = el }}
                            className={`border-b hover:bg-muted/10 cursor-pointer ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : isCriticalStock ? 'bg-red-50/70' : isLow ? 'bg-yellow-50/70' : ''}`}
                            onClick={() => toggleBatchView(item.id)}
                          >
                            <td className="px-5 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                {item.name}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-muted-foreground">{item.unit}</td>
                            <td className={`px-5 py-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.current_stock}</td>
                            <td className="px-5 py-3 text-right">
                              {item.pieces_per_pack && item.pieces_per_pack > 1 ? (
                                <div className="leading-tight">
                                  <div className="font-semibold">
                                    {(item.current_stock || 0) * item.pieces_per_pack + (item.open_pieces || 0)} pcs
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {item.open_pieces || 0} ready
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
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
                            <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { setIngredientEditing(item); setIngredientFormOpen(true) }} className="text-muted-foreground hover:text-primary">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => handleIngredientDelete(item)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {renderBatchRow(item.id)}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ACTIVITY LOG TAB  (Admin only)                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <TabsContent value="activity" className="m-0 flex-1 flex flex-col outline-none">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Filters</span>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {logActionFilter === 'all' ? 'All Actions' : logActionFilter.replace('_', ' ')}
                </span>
                {(logDateFrom || logDateTo) && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {logDateFrom || '...'} to {logDateTo || '...'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivityCompactMode((v) => !v)}
                  className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted/50"
                >
                  {activityCompactMode ? 'Comfort' : 'Dense'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowActivityFilters((v) => !v)}
                  className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted/50"
                >
                  {showActivityFilters ? 'Hide filters' : 'More filters'}
                </button>
              </div>
            </div>

            {/* ── Filters Row ─────────────────────────────────────────── */}
            {showActivityFilters && (
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
              {/* Today quick filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground invisible">Quick</label>
                <button
                  type="button"
                  onClick={() => { setLogDateFrom(todayStr()); setLogDateTo(todayStr()) }}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors"
                >
                  Today
                </button>
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
                  <option value="delivery_issues">Delivery Issues</option>
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
            )}

            {/* ── Summary Chips ───────────────────────────────────────── */}
            <div className={`flex gap-3 ${activityCompactMode ? 'mb-3' : 'mb-4'}`}>
              <div className={`flex items-center gap-2 rounded-lg bg-card border shadow-sm ${activityCompactMode ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
                <span className="text-xs font-medium text-muted-foreground">Total today</span>
                <span className="text-sm font-bold">{todaySummary.total}</span>
              </div>
              <div className={`flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 shadow-sm ${activityCompactMode ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs font-medium text-yellow-700">Warnings</span>
                <span className="text-sm font-bold text-yellow-700">{todaySummary.warnings}</span>
              </div>
              <div className={`flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 shadow-sm ${activityCompactMode ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
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
                <div className="flex-1 flex items-center justify-center py-10 text-sm text-muted-foreground">
                  No activity yet — stock changes and deliveries will appear here.
                </div>
              ) : (
                <>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b bg-muted/20">
                          <th className={`text-left px-4 font-semibold text-muted-foreground whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>Time</th>
                          <th className={`text-center px-3 font-semibold text-muted-foreground w-10 ${activityCompactMode ? 'py-2' : 'py-3'}`}></th>
                          <th className={`text-left px-4 font-semibold text-muted-foreground whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>Action</th>
                          <th className={`text-left px-4 font-semibold text-muted-foreground whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>Ingredient</th>
                          <th className={`text-left px-4 font-semibold text-muted-foreground ${activityCompactMode ? 'py-2' : 'py-3'}`}>Details</th>
                          <th className={`text-left px-4 font-semibold text-muted-foreground whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>Before → After</th>
                          <th className={`text-left px-4 font-semibold text-muted-foreground whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.map((log) => (
                          <tr key={log.id} className={`border-b last:border-0 hover:bg-muted/10 transition-colors ${SEVERITY_ROW_BG[log.severity] || ''}`}>
                            {/* Time */}
                            <td className={`px-4 whitespace-nowrap text-muted-foreground text-xs ${activityCompactMode ? 'py-2' : 'py-3'}`}>
                              {formatLogTime(log.createdAt)}
                            </td>
                            {/* Severity dot */}
                            <td className={`px-3 text-center ${activityCompactMode ? 'py-2' : 'py-3'}`}>
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${SEVERITY_DOTS[log.severity] || 'bg-gray-400'}`} title={log.severity} />
                            </td>
                            {/* Action badge */}
                            <td className={`px-4 ${activityCompactMode ? 'py-2' : 'py-3'}`}>
                              <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${ACTION_BADGE_STYLES[log.action] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </td>
                            {/* Ingredient */}
                            <td className={`px-4 font-medium whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>
                              {log.ingredientName || '—'}
                            </td>
                            {/* Details */}
                            <td className={`px-4 text-muted-foreground max-w-[420px] whitespace-normal break-words ${activityCompactMode ? 'py-2' : 'py-3'}`}>
                              {log.details?.includes('⚠️') ? (
                                <div className="flex flex-col gap-1">
                                  <span>{log.details.split('⚠️')[0].trim()}</span>
                                  <span className="inline-flex items-start gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium max-w-full">
                                    <span className="shrink-0">⚠️</span>
                                    <span className="break-words min-w-0">{log.details.split('⚠️')[1].trim()}</span>
                                  </span>
                                </div>
                              ) : log.details}
                            </td>
                            {/* Before → After */}
                            <td className={`px-4 whitespace-nowrap text-xs ${activityCompactMode ? 'py-2' : 'py-3'}`}>
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
                            <td className={`px-4 whitespace-nowrap ${activityCompactMode ? 'py-2' : 'py-3'}`}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Input type="number" value={menuForm.price} onFocus={(e) => e.target.select()} onChange={(e) => setMenuForm((f) => ({ ...f, price: +e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Icon (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMenuForm((f) => ({ ...f, emoji: null }))}
                  className="h-8 px-2 text-xs"
                >
                  Use Category Default
                </Button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-12 w-12 rounded-full border flex items-center justify-center text-2xl ${menuForm.emoji ? 'bg-red-50 border-red-200' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {getMenuItemIcon(menuForm)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {menuForm.emoji ? 'Custom icon selected' : 'Using category default icon'}
                </div>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {MENU_EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setMenuForm((f) => ({ ...f, emoji }))}
                    className={`h-11 rounded-md border text-2xl transition-all ${menuForm.emoji === emoji ? 'border-[#B01010] ring-2 ring-[#B01010]/30 bg-red-50' : 'border-input hover:bg-muted/30'}`}
                    aria-label={`Set menu icon to ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="url"
                  value={menuForm.image || ''}
                  onChange={(e) => setMenuForm((f) => ({ ...f, image: e.target.value || null }))}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
                {menuForm.image && (
                  <Button type="button" variant="outline" className="px-3" onClick={() => setMenuForm((f) => ({ ...f, image: null }))}>
                    Clear
                  </Button>
                )}
              </div>
              {menuForm.image && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={menuForm.image}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border"
                    onError={(e) => { e.target.style.opacity = '0.3' }}
                  />
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Image will replace the emoji icon on the POS screen.</p>
            </div>

            {/* ── Recipe — tap-to-add ingredient grid ─────────────── */}
            <div>
              <Label>Recipe / Ingredients Used</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">Tap an ingredient to add it. Adjust quantity with +/- buttons.</p>

              {/* Selected ingredients summary */}
              {(menuForm.recipe || []).length > 0 && (
                <div className="mb-3 rounded-lg border border-[#B01010]/20 bg-red-50/40 p-3">
                  <p className="text-[11px] font-semibold text-[#B01010] uppercase tracking-wide mb-2">Per order this item needs:</p>
                  <div className="space-y-1.5">
                    {(menuForm.recipe || []).map((r) => {
                      const ing = ingredients.find((i) => i.id === r.ingredientId)
                      if (!ing) return null
                      return (
                        <div key={r.ingredientId} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{ing.name}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMenuForm((f) => {
                                const qty = r.qty - 1
                                if (qty <= 0) return { ...f, recipe: (f.recipe || []).filter((x) => x.ingredientId !== r.ingredientId) }
                                return { ...f, recipe: (f.recipe || []).map((x) => x.ingredientId === r.ingredientId ? { ...x, qty } : x) }
                              })}
                              className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-900">{r.qty}</span>
                            <button
                              type="button"
                              onClick={() => setMenuForm((f) => ({
                                ...f,
                                recipe: (f.recipe || []).map((x) => x.ingredientId === r.ingredientId ? { ...x, qty: x.qty + 1 } : x)
                              }))}
                              className="w-6 h-6 rounded-md bg-white border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm font-bold"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => setMenuForm((f) => ({ ...f, recipe: (f.recipe || []).filter((x) => x.ingredientId !== r.ingredientId) }))}
                              className="ml-1 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <span className="text-xs text-gray-400 w-16 text-right">{ing.unit}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Ingredient grid — grouped by category */}
              <div className="rounded-lg border bg-slate-50/50 p-2 max-h-52 overflow-y-auto space-y-2">
                {ingredientCategories.map((cat) => {
                  const catIngredients = ingredients.filter((i) => (i.categoryId || 7) === Number(cat.id))
                  if (catIngredients.length === 0) return null
                  return (
                    <div key={cat.id}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">{cat.emoji} {cat.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {catIngredients.map((ing) => {
                          const inRecipe = (menuForm.recipe || []).find((r) => r.ingredientId === ing.id)
                          return (
                            <button
                              key={ing.id}
                              type="button"
                              onClick={() => {
                                if (inRecipe) {
                                  // Already added — remove it
                                  setMenuForm((f) => ({ ...f, recipe: (f.recipe || []).filter((r) => r.ingredientId !== ing.id) }))
                                } else {
                                  // Add with qty 1
                                  setMenuForm((f) => ({ ...f, recipe: [...(f.recipe || []), { ingredientId: ing.id, qty: 1 }] }))
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                inRecipe
                                  ? 'bg-[#B01010] text-white border-[#B01010] shadow-sm'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                              }`}
                            >
                              {ing.name}
                              {inRecipe && <span className="ml-1 bg-white/25 px-1 rounded text-[10px]">x{inRecipe.qty}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {ingredients.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-4">No ingredients yet — add some in the Inventory tab first.</p>
                )}
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
      <Dialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ingredient Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              {(ingredientCategories || []).map((category) => {
                const isUncategorized = Number(category.id) === DEFAULT_UNCATEGORIZED_ID || String(category.name).toLowerCase() === 'uncategorized'
                return (
                  <div key={category.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0">
                    <div className="text-sm font-medium">
                      {category.emoji} {category.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => startEditCategory(category)} className="text-muted-foreground hover:text-primary">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isUncategorized ? (
                        <span className="text-xs text-muted-foreground px-1.5">-</span>
                      ) : (
                        <button type="button" onClick={() => deleteCategory(category)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">{categoryEditing ? 'Edit Category' : 'Add New Category'}</p>
              <div>
                <Label>Name</Label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Category name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Emoji</Label>
                <div className="mt-2 grid grid-cols-8 gap-2">
                  {CATEGORY_EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCategoryForm((f) => ({ ...f, emoji }))}
                      className={`h-9 rounded-md border text-lg ${categoryForm.emoji === emoji ? 'border-[#B01010] bg-red-50' : 'border-input hover:bg-muted/30'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {categoryEditing && (
                  <Button variant="outline" onClick={() => { setCategoryEditing(null); setCategoryForm({ name: '', emoji: '📦' }) }}>
                    Cancel Edit
                  </Button>
                )}
                <Button onClick={saveCategory}>{categoryEditing ? 'Update Category' : '+ Add New Category'}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ingredient Dialog */}
      <IngredientForm
        open={ingredientFormOpen}
        onClose={() => { setIngredientFormOpen(false); setIngredientEditing(null) }}
        onSave={handleIngredientSave}
        initial={ingredientEditing}
        categories={ingredientCategories}
      />

      {/* Stock Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
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
                  onFocus={(e) => e.target.select()}
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

      {deleteConfirm && (
        <DeleteConfirmModal
          title={deleteConfirm.title}
          message={deleteConfirm.message}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

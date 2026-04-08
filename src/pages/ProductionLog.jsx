import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import { Package, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

// ─── Stock status helpers ────────────────────────────────────────────
function getStatus(item) {
  const stock = item.current_stock ?? 0
  const warn = item.warning_level ?? 3
  if (stock === 0)       return 'critical'
  if (stock <= warn)     return 'low'
  return 'normal'
}

const STATUS_CONFIG = {
  normal:   { badge: '🟢 Normal',   cardCls: 'border-border',              badgeCls: 'bg-green-100 text-green-700' },
  low:      { badge: '🟡 Low',      cardCls: 'border-amber-400 bg-amber-50/40', badgeCls: 'bg-amber-100 text-amber-700' },
  critical: { badge: '🔴 Critical', cardCls: 'border-red-400 bg-red-50/50',     badgeCls: 'bg-red-100 text-red-700' },
}
const DEFAULT_UNCATEGORIZED_ID = 7

// ─── Item Card ───────────────────────────────────────────────────────
function ItemCard({ item, onOpenPack }) {
  const status = getStatus(item)
  const { badge, cardCls, badgeCls } = STATUS_CONFIG[status]

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 shadow-sm bg-white transition-all ${cardCls}`}
      style={{ minHeight: '160px' }}
    >
      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-1">
        <p className="text-base font-bold text-gray-900 leading-tight">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.unit}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-gray-800">
            {item.current_stock ?? 0} packs left
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeCls}`}>
            {badge}
          </span>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => onOpenPack(item)}
        disabled={item.current_stock === 0}
        className={`w-full py-3 rounded-b-2xl text-sm font-bold transition-colors
          ${item.current_stock === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : status === 'critical'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-[#B01010] hover:bg-[#8c0d0d] text-white'
          }`}
      >
        {item.current_stock === 0 ? 'Out of Stock' : 'Open Pack'}
      </button>
    </div>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────
function ConfirmModal({ item, onCancel, onConfirm, loading }) {
  const [note, setNote] = useState('')
  if (!item) return null

  const nextStock = Math.max(0, (item.current_stock ?? 1) - 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#2c1810] px-5 py-4">
          <p className="text-white font-bold text-base">Open 1 pack of {item.name}?</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            This will deduct 1 pack from stock&nbsp;
            <span className="font-semibold">
              ({item.current_stock} → {nextStock} remaining)
            </span>
          </p>

          {/* Optional note */}
          <textarea
            className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={2}
            maxLength={100}
            placeholder="Add a note... (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground text-right">{note.length}/100</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note.trim())}
            disabled={loading}
            className="flex-1 bg-[#B01010] hover:bg-[#8c0d0d] text-white rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
          >
            {loading ? 'Logging…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function ProductionLog() {
  const { user } = useAuth()
  const { cashierName } = useCashierStore()
  const activeName = user ? user.full_name : (cashierName ?? 'Cashier')

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)   // item being confirmed
  const [confirming, setConfirming] = useState(false)

  const loadItems = useCallback(() => {
    Promise.all([api.ingredients.list(), api.ingredientCategories.list()])
      .then(([ingredients, categoryRows]) => {
        setItems(ingredients)
        setCategories(categoryRows)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        toast.error('Failed to load data')
      })
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const handleOpenPack = (item) => setSelected(item)
  const handleCancel   = () => setSelected(null)

  const handleConfirm = async (note) => {
    if (!selected) return
    setConfirming(true)
    try {
      const { item: updated } = await api.ingredients.consume(selected.id, {
        loggedBy: activeName,
        note,
      })

      // Refresh local state immediately
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it))
      )
      setSelected(null)

      // Success toast
      toast.success(`✅ ${updated.name} — 1 pack opened`)

      // Low stock warning toast
      const status = getStatus(updated)
      if (status === 'low' || status === 'critical') {
        toast.warning(
          `⚠️ ${updated.name} is running low — only ${updated.current_stock} packs left. Please notify admin.`,
          { duration: 6000 }
        )
      }
    } catch (_err) {
      toast.error('Failed to log pack. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const categoryCounts = useMemo(() => {
    const counts = {}
    items.forEach((item) => {
      const id = Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID)
      counts[id] = (counts[id] || 0) + 1
    })
    return counts
  }, [items])

  const visibleCategoryTabs = useMemo(() => {
    return categories
      .filter((category) => (categoryCounts[Number(category.id)] || 0) > 0)
      .sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      .map((category) => ({ ...category, count: categoryCounts[Number(category.id)] || 0 }))
  }, [categories, categoryCounts])

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return [...items]
    return items.filter((item) => Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID) === Number(categoryFilter))
  }, [items, categoryFilter])

  const groupedSections = useMemo(() => {
    const grouped = {}
    filteredItems.forEach((item) => {
      const id = Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID)
      grouped[id] = grouped[id] || []
      grouped[id].push(item)
    })

    if (categoryFilter !== 'all') {
      const selected = categories.find((c) => Number(c.id) === Number(categoryFilter))
      if (!selected) return []
      return [{ category: selected, items: grouped[Number(selected.id)] || [] }]
    }

    return [...categories]
      .sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      .filter((category) => (grouped[Number(category.id)] || []).length > 0)
      .map((category) => ({ category, items: grouped[Number(category.id)] || [] }))
  }, [categories, filteredItems, categoryFilter])

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tap an item when you open a new pack</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">{activeName}</p>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Normal stock</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Low stock</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical</span>
        <span className="flex items-center gap-1 ml-auto">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          Always log before opening a pack
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max pr-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${categoryFilter === 'all' ? 'bg-[#B01010] text-white border-[#B01010]' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
          >
            All ({items.length})
          </button>
          {visibleCategoryTabs.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryFilter(String(category.id))}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${categoryFilter === String(category.id) ? 'bg-[#B01010] text-white border-[#B01010]' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}`}
            >
              {category.emoji} {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* ── Item Grid ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#B01010] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm">No production items found. Ask your admin to add items.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSections.map((section) => (
            <div key={section.category.id}>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                {section.category.emoji} {section.category.name}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <ItemCard key={item.id} item={item} onOpenPack={handleOpenPack} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        item={selected}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        loading={confirming}
      />
    </div>
  )
}

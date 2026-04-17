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
  critical: { badge: '🔴 Out of Stock', cardCls: 'border-red-400 bg-red-50/50',     badgeCls: 'bg-red-100 text-red-700' },
}
const DEFAULT_UNCATEGORIZED_ID = 7

const CATEGORY_BADGE_STYLES = {
  proteins: 'bg-rose-100 text-rose-700',
  'bread & buns': 'bg-amber-100 text-amber-700',
  dairy: 'bg-yellow-100 text-yellow-700',
  'sauces & condiments': 'bg-orange-100 text-orange-700',
  'sides & extras': 'bg-lime-100 text-lime-700',
  packaging: 'bg-sky-100 text-sky-700',
  uncategorized: 'bg-slate-100 text-slate-700',
}

const CATEGORY_ACCENT_STYLES = {
  proteins: 'bg-rose-300/80',
  'bread & buns': 'bg-amber-300/80',
  dairy: 'bg-yellow-300/80',
  'sauces & condiments': 'bg-orange-300/80',
  'sides & extras': 'bg-lime-300/80',
  packaging: 'bg-sky-300/80',
  uncategorized: 'bg-slate-300/80',
}

// ─── Batch helpers ────────────────────────────────────────────────────
function getActiveBatches(ingredientId, allBatches) {
  return (allBatches || [])
    .filter((b) => b.ingredientId === ingredientId && !b.isExhausted)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt))
}

function getFIFOBatch(ingredientId, allBatches) {
  const active = getActiveBatches(ingredientId, allBatches)
  return active.length > 0 ? active[0] : null
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Item Card ───────────────────────────────────────────────────────
function ItemCard({ item, batches, onOpenPack, categoryLabel, categoryEmoji, showCategoryTag }) {
  const status = getStatus(item)
  const { badge, cardCls, badgeCls } = STATUS_CONFIG[status]
  const [showBatches, setShowBatches] = useState(false)
  const activeBatches = getActiveBatches(item.id, batches)
  const outOfStock = (item.current_stock ?? 0) === 0
  const categoryKey = String(categoryLabel || 'uncategorized').toLowerCase()
  const categoryBadgeClass = CATEGORY_BADGE_STYLES[categoryKey] || CATEGORY_BADGE_STYLES.uncategorized
  const categoryAccentClass = CATEGORY_ACCENT_STYLES[categoryKey] || CATEGORY_ACCENT_STYLES.uncategorized

  return (
    <button
      type="button"
      onClick={() => onOpenPack(item)}
      disabled={outOfStock}
      className={`w-full text-left flex flex-col rounded-2xl border-2 shadow-sm bg-white transition-all duration-150 p-3 min-h-[128px] ${cardCls} ${outOfStock ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md active:scale-[0.98]'}`}
    >
      <div className="flex-1 flex flex-col gap-1.5">
        {showCategoryTag && (
          <span
            aria-hidden="true"
            className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${categoryAccentClass}`}
          />
        )}
        {showCategoryTag && (
          <div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass}`}>
              <span>{categoryEmoji || '📦'}</span>
              <span>{categoryLabel || 'Uncategorized'}</span>
            </span>
          </div>
        )}
        <p className="text-[15px] font-bold text-gray-900 leading-tight">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.unit}</p>

        <div className="mt-auto flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-gray-800 leading-tight">
            <div>{(item.current_stock ?? 0)} unopened packs</div>
            {item.pieces_per_pack && (item.open_pieces || 0) > 0 && (
              <div className="text-xs mt-0.5 text-blue-600 font-medium">
                {item.open_pieces} open pieces
              </div>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${badgeCls}`}>
            {badge}
          </span>
        </div>

        {/* Batch summary toggle */}
        {activeBatches.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowBatches(!showBatches)
            }}
            className="mt-1 text-left text-[11px] text-blue-600 hover:underline font-medium"
          >
            {showBatches ? '▼' : '▶'} {activeBatches.length} shipment{activeBatches.length > 1 ? 's' : ''}
          </button>
        )}

        {/* Batch details (expanded) */}
        {showBatches && activeBatches.length > 0 && (
          <div className="mt-1 pt-2 border-t border-gray-200 space-y-1">
            {activeBatches.map((batch, idx) => (
              <div
                key={batch.id}
                className={`text-[10px] px-1.5 py-1 rounded flex items-center justify-between gap-2 ${
                  idx === 0 ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-gray-600'
                }`}
              >
                <span className="font-semibold shrink-0">
                  {idx === 0 ? 'NOW' : `#${idx + 1}`}
                </span>
                <span className="text-[9px] text-gray-500 truncate flex-1 text-center">
                  {formatDate(batch.receivedAt)}
                  {batch.expiryDate && ` → ${formatDate(batch.expiryDate)}`}
                </span>
                <span className="font-medium shrink-0">
                  {batch.quantity}/{batch.originalQuantity}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={`pt-1 text-xs font-semibold ${outOfStock ? 'text-gray-400' : 'text-[#B01010]'}`}>
          {outOfStock ? 'Out of Stock' : 'Tap to Open Pack'}
        </div>
      </div>
    </button>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────
function ConfirmModal({ item, batches, onCancel, onConfirm, loading }) {
  const [note, setNote] = useState('')
  const [qty, setQty] = useState(1)
  if (!item) return null

  const safeQty = Math.max(1, Math.min(qty || 1, item.current_stock ?? 1))
  const nextStock = Math.max(0, (item.current_stock ?? 0) - safeQty)
  const fifoBatch = getFIFOBatch(item.id, batches)
  const piecesPerPack = item.pieces_per_pack || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#2c1810] px-5 py-4">
          <p className="text-white font-bold text-base">Open New Pack — {item.name}</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Shows which shipment the pack will come from (oldest/soonest-to-expire first) */}
          {fifoBatch && (
            <div className="text-xs p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
              <strong>Using stock from:</strong> Shipment #{fifoBatch.id?.slice(-4) || '?'}
              {fifoBatch.expiryDate && ` • Expires: ${formatDate(fifoBatch.expiryDate)}`}
            </div>
          )}

          {/* Quantity selector */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">How many packs?</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-lg font-bold hover:bg-gray-50 disabled:opacity-30"
                disabled={qty <= 1}
              >−</button>
              <input
                type="number"
                min={1}
                max={item.current_stock ?? 1}
                value={qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= 1) setQty(Math.min(v, item.current_stock ?? 1))
                }}
                className="w-16 text-center text-lg font-bold border border-input rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(q + 1, item.current_stock ?? 1))}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-lg font-bold hover:bg-gray-50 disabled:opacity-30"
                disabled={qty >= (item.current_stock ?? 1)}
              >+</button>
            </div>
          </div>

          {/* Stock preview */}
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span>
              <span className="font-semibold">{item.current_stock} → {nextStock}</span>
              <span className="text-xs text-gray-500 ml-1">packs</span>
            </span>
            {piecesPerPack && (
              <span className="text-xs text-blue-700">
                +{safeQty * piecesPerPack} pieces ({piecesPerPack}/pack)
              </span>
            )}
          </div>

          {/* Stock issue note */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Any stock problem? <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={2}
              maxLength={150}
              placeholder="e.g. 2 buns damaged, sauce spilled..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground text-right mt-0.5">{note.length}/150</p>
          </div>
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
            onClick={() => onConfirm(note.trim(), safeQty)}
            disabled={loading}
            className="flex-1 bg-[#B01010] hover:bg-[#8c0d0d] text-white rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
          >
            {loading ? 'Logging…' : `Open ${safeQty} Pack${safeQty > 1 ? 's' : ''}`}
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
  const [batches, setBatches] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [todayConsumed, setTodayConsumed] = useState({})

  const loadItems = useCallback(() => {
    Promise.all([api.ingredients.list(), api.ingredientCategories.list(), api.stockBatches.list()])
      .then(([ingredients, categoryRows, batchRows]) => {
        setItems(ingredients)
        setCategories(categoryRows)
        setBatches(batchRows)
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

  const handleConfirm = async (note, qty = 1) => {
    if (!selected) return
    setConfirming(true)
    try {
      const { item: updated } = await api.ingredients.consume(selected.id, {
        loggedBy: activeName,
        note,
        qty,
      })

      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
      setSelected(null)
      api.stockLogs.todayConsumed().then(setTodayConsumed)

      const piecesPerPack = updated.pieces_per_pack || null
      if (piecesPerPack) {
        toast.success(`✅ ${updated.name} — ${qty} pack${qty > 1 ? 's' : ''} opened → ${updated.current_stock} unopened, ${updated.open_pieces} open pieces`)
      } else {
        toast.success(`✅ ${updated.name} — ${qty} pack${qty > 1 ? 's' : ''} opened`)
      }

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

  const categoryById = useMemo(() => {
    const map = new Map()
    categories.forEach((c) => {
      map.set(Number(c.id), c)
    })
    return map
  }, [categories])

  const arrangedItems = useMemo(() => {
    const list = [...filteredItems]
    const rankById = new Map()
    ;[...categories]
      .sort((a, b) => {
        if (Number(a.id) === DEFAULT_UNCATEGORIZED_ID) return 1
        if (Number(b.id) === DEFAULT_UNCATEGORIZED_ID) return -1
        return Number(a.order || 999) - Number(b.order || 999)
      })
      .forEach((c, index) => rankById.set(Number(c.id), index))

    return list.sort((a, b) => {
      if (categoryFilter === 'all') {
        const aRank = rankById.get(Number(a.categoryId ?? DEFAULT_UNCATEGORIZED_ID)) ?? 999
        const bRank = rankById.get(Number(b.categoryId ?? DEFAULT_UNCATEGORIZED_ID)) ?? 999
        if (aRank !== bRank) return aRank - bRank
      }
      return a.name.localeCompare(b.name)
    })
  }, [filteredItems, categories, categoryFilter])

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tap an item to log a new pack</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">{activeName}</p>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
      </div>

      {/* ── Today's Summary ── */}
      {Object.keys(todayConsumed).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-2">Opened today</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(todayConsumed).map(([name, count]) => {
              const ing = items.find((i) => i.name === name)
              const piecesPerPack = ing?.pieces_per_pack || null
              const pieces = piecesPerPack ? count * piecesPerPack : null
              return (
                <span key={name} className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full">
                  {name} × {count} packs{pieces ? ` (${pieces} pieces)` : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Reminder ── */}
      <div className="flex items-center gap-1 text-xs text-amber-700">
        <AlertTriangle className="w-3 h-3" />
        Always log before opening a pack
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
        <div>
          {arrangedItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No items in this category.</div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {arrangedItems.map((item) => {
                const category = categoryById.get(Number(item.categoryId ?? DEFAULT_UNCATEGORIZED_ID))
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    batches={batches}
                    onOpenPack={handleOpenPack}
                    showCategoryTag={categoryFilter === 'all'}
                    categoryLabel={category?.name || 'Uncategorized'}
                    categoryEmoji={category?.emoji || '📦'}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        item={selected}
        batches={batches}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        loading={confirming}
      />
    </div>
  )
}

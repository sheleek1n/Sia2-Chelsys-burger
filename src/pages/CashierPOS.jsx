import { useState, useEffect, useCallback } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import OrderForm from '@/components/orders/OrderForm'
import ReceiptModal from '@/components/orders/ReceiptModal'
import StockShortageModal from '@/components/orders/StockShortageModal'
import PageHeader from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, FilePenLine, AlertTriangle, X, ShoppingBag } from 'lucide-react'

const MAX_NOTE_LENGTH = 200

export default function CashierPOS() {
  const { user } = useAuth()
  const { displayName } = useCashierStore()

  const activeName = user ? user.full_name : displayName

  // ── Core state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('new-order')
  const [menuItems, setMenuItems] = useState([])
  const [orders, setOrders] = useState([])
  const [receiptOrder, setReceiptOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [stockShortage, setStockShortage] = useState(null)
  const [pendingOrder, setPendingOrder] = useState(null)

  // ── My Orders tab state ──────────────────────────────────────────────────────
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.menuItems.list(),
      api.orders.list(200),
    ]).then(([m, o]) => {
      setMenuItems(m)
      setOrders(o)
    }).catch(() => {
      toast.error('Failed to load data')
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!noteTarget) return
    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        setNoteTarget(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [noteTarget])

  // ── Order placement ──────────────────────────────────────────────────────────
  const placeOrder = async (orderData) => {
    setSubmitting(true)
    try {
      const { order: createdOrder, deductions } = await api.orders.placeOrderAtomic({
        ...orderData,
        cashier_name: activeName || 'Unknown',
      })

      setReceiptOrder(createdOrder)

      const autoOpened = deductions.filter((d) => d.packsAutoOpened > 0)
      if (autoOpened.length > 0) {
        const summary = autoOpened
          .map((d) => `${d.ingredientName} (${d.packsAutoOpened} new pack${d.packsAutoOpened > 1 ? 's' : ''})`)
          .join(', ')
        toast.success(`Order placed — opened: ${summary}`)
      } else {
        toast.success('Order placed successfully!')
      }

      setStockShortage(null)
      setPendingOrder(null)
      loadData()
    } catch (err) {
      if (err?.code === 'INSUFFICIENT_STOCK' && Array.isArray(err.shortages)) {
        setStockShortage(err.shortages)
        setPendingOrder(orderData)
        toast.error('Stock changed — please review shortages')
      } else {
        console.error('Order placement failed:', err)
        toast.error(err?.message || 'Failed to place order — no changes saved')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (orderData) => {
    try {
      const shortages = await api.orders.checkStock(orderData.items)
      if (shortages.length > 0) {
        setStockShortage(shortages)
        setPendingOrder(orderData)
        return
      }
    } catch {
      // If check fails, proceed anyway (don't block sales)
    }
    placeOrder(orderData)
  }

  const handleShortageRetry = async () => {
    if (!pendingOrder) return
    try {
      const shortages = await api.orders.checkStock(pendingOrder.items)
      if (shortages.length > 0) {
        setStockShortage(shortages)
        return
      }
    } catch {
      // proceed
    }
    placeOrder(pendingOrder)
  }

  const handleShortageCancel = () => {
    setStockShortage(null)
    setPendingOrder(null)
  }

  // ── My Orders helpers ────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd')
  const myOrders = orders
    .filter((o) => o.order_date === today && o.cashier_name === activeName)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const myTodayRevenue = myOrders
    .filter((o) => o.status === 'completed')
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  const handleSaveNote = async () => {
    if (!noteTarget) return
    setSavingNote(true)
    try {
      await api.orders.update(noteTarget.id, { incidentNote: noteText.trim() || null })
      toast.success('Note saved')
      setNoteTarget(null)
      loadData()
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header + tab bar ─────────────────────────────────────────── */}
      <div className="mb-4">
        <PageHeader
          title={activeTab === 'new-order' ? 'New Order' : 'My Orders'}
          subtitle={`Cashier: ${activeName || 'Cashier'}`}
          compact
        />
        <div className="flex gap-1 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab('new-order')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'new-order'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            New Order
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-orders')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'my-orders'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            My Orders
            {myOrders.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'my-orders' ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'
              }`}>
                {myOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab: New Order ────────────────────────────────────────────────── */}
      {activeTab === 'new-order' && (
        <div className="flex-1 min-h-0">
          <OrderForm menuItems={menuItems} onSubmit={handleSubmit} loading={submitting || loading} />
        </div>
      )}

      {/* ── Tab: My Orders ────────────────────────────────────────────────── */}
      {activeTab === 'my-orders' && (
        <div className="flex-1 overflow-y-auto">
          {/* Summary bar */}
          <div className="flex items-center gap-4 mb-3 px-1">
            <span className="text-sm text-muted-foreground">
              {myOrders.length === 0
                ? 'No orders placed today.'
                : `${myOrders.length} order${myOrders.length > 1 ? 's' : ''} today`}
            </span>
            {myOrders.length > 0 && (
              <span className="text-sm font-semibold text-foreground">
                Total: ₱{myTodayRevenue.toLocaleString()}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
          )}

          {!loading && myOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No orders yet today.</p>
              <p className="text-xs mt-1 opacity-70">Orders you place will appear here.</p>
            </div>
          )}

          {!loading && myOrders.length > 0 && (
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              {myOrders.map((o, idx) => (
                <div key={o.id} className={idx < myOrders.length - 1 ? 'border-b' : ''}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 text-left transition-colors ${
                      o.incidentNote ? 'bg-amber-50/40' : ''
                    } ${o.status === 'voided' ? 'opacity-60' : ''}`}
                  >
                    {expandedOrderId === o.id
                      ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
                    <span className="font-mono font-semibold text-sm w-28 flex-shrink-0">{o.order_number}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {o.created_at ? format(new Date(o.created_at), 'h:mm a') : ''}
                    </span>
                    <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">
                      {(o.items || []).slice(0, 2).map((i, j) => (
                        <span key={j}>{j > 0 && ', '}{i.emoji} {i.menu_item_name}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</span>
                      ))}
                      {(o.items || []).length > 2 && <span className="opacity-60"> +{(o.items || []).length - 2}</span>}
                    </span>
                    {o.incidentNote && (
                      <span className="text-amber-500 flex-shrink-0 text-xs" title="Has incident note">⚠️</span>
                    )}
                    <span className="text-sm font-semibold flex-shrink-0 ml-auto">₱{(o.total_amount || 0).toFixed(2)}</span>
                    <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.status === 'voided' ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'
                    }`}>
                      {o.status === 'voided' ? 'Cancelled' : 'Completed'}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {expandedOrderId === o.id && (
                    <div className="px-11 pb-4 bg-muted/10 border-t border-muted/30">
                      <table className="w-full max-w-sm text-sm mt-3 mb-3">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-muted/40">
                            <th className="text-left pb-1.5 pr-4 font-medium">Item</th>
                            <th className="text-center pb-1.5 pr-4 font-medium">Qty</th>
                            <th className="text-right pb-1.5 font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(o.items || []).map((item, idx2) => (
                            <tr key={idx2} className="border-t border-muted/20">
                              <td className="py-1.5 pr-4">{item.emoji} {item.menu_item_name}</td>
                              <td className="py-1.5 pr-4 text-center text-muted-foreground">×{item.quantity}</td>
                              <td className="py-1.5 text-right font-medium">₱{(item.subtotal || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Payment info */}
                      <div className="text-xs text-muted-foreground mb-3">
                        {o.payment_method === 'gcash'
                          ? `GCash · Ref: ${o.gcash_reference || '—'}`
                          : `Cash · Paid ₱${(o.amount_paid || o.total_amount || 0).toFixed(2)}`}
                      </div>

                      {/* Existing incident note display */}
                      {o.incidentNote && (
                        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>{o.incidentNote}</span>
                        </div>
                      )}

                      {/* Add / Edit incident note button */}
                      <button
                        type="button"
                        onClick={() => { setNoteTarget(o); setNoteText(o.incidentNote || '') }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <FilePenLine className="w-3.5 h-3.5" />
                        {o.incidentNote ? 'Edit Incident Note' : 'Add Incident Note'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shared modals ────────────────────────────────────────────────── */}
      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />

      {stockShortage && (
        <StockShortageModal
          shortages={stockShortage}
          cashierName={activeName || 'Cashier'}
          onRetry={handleShortageRetry}
          onCancel={handleShortageCancel}
        />
      )}

      {/* ── Incident Note Modal ───────────────────────────────────────────── */}
      {noteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden mx-4">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-amber-500 text-white">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Incident Note — {noteTarget.order_number}
              </div>
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="hover:bg-amber-600 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground mb-3">
                Describe what happened. Leave blank to remove the note.
              </p>
              <textarea
                value={noteText}
                onChange={(e) => { if (e.target.value.length <= MAX_NOTE_LENGTH) setNoteText(e.target.value) }}
                placeholder="e.g. Wrong order, customer complaint, item returned..."
                rows={3}
                autoFocus
                className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
              <div className="text-xs text-muted-foreground text-right mt-0.5">
                {noteText.length}/{MAX_NOTE_LENGTH}
              </div>
            </div>
            <div className="px-5 py-4 border-t bg-muted/20 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

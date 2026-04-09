import { useState, useEffect } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ReceiptText, X, AlertTriangle, FilePenLine, Ban } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import ReceiptModal from '@/components/orders/ReceiptModal'

const ORDERS_PER_PAGE = 25

const ORDERS_PER_PAGE = 25

const statusColors = {
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-yellow-100 text-yellow-700',
  voided:    'bg-gray-200 text-gray-500',
}

const paymentBadgeColors = {
  cash: 'bg-green-100 text-green-700',
  gcash: 'bg-blue-100 text-blue-700',
}

function getPaymentLabel(method) {
  return method === 'gcash' ? 'GCash' : 'Cash'
}

const PRESET_NOTES = [
  'Wrong Order',
  'Item Spilled',
  'Customer Complaint',
  'Other',
]

const MAX_NOTE_LENGTH = 200

function VoidOrderModal({ order, onClose, onConfirm }) {
  const [voidNote, setVoidNote] = useState('')
  const [loading, setLoading] = useState(false)

  if (!order) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(order.id, voidNote.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden mx-4">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-base">Void Order {order.order_number}?</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            This will mark the order as voided and exclude it from all sales reports.
          </p>
          <div>
            <label className="text-sm font-medium block mb-1.5">Note (optional)</label>
            <textarea
              value={voidNote}
              onChange={(e) => setVoidNote(e.target.value)}
              placeholder="Add a reason or note..."
              rows={3}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t bg-muted/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Voiding...' : 'Void Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IncidentNoteModal({ order, onClose, onSave }) {
  const [noteText, setNoteText] = useState(order?.incidentNote || '')
  const [saving, setSaving] = useState(false)

  if (!order) return null

  const handleSave = async () => {
    const trimmed = noteText.trim()
    setSaving(true)
    try {
      await onSave(order.id, trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-xl overflow-hidden mx-4">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-amber-500 text-white">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            <span>Incident Note - {order.order_number}</span>
          </div>
          <button onClick={onClose} className="hover:bg-amber-600 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="text-sm text-muted-foreground mb-4">
            Add or edit an incident note for this order. Examples include remade items, wrong payment, or customer complaints. Saving an empty note will remove the flag.
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_NOTES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setNoteText((prev) => (prev ? `${prev} — ${preset}` : preset))}
                className="text-sm px-3 py-1.5 rounded-full border bg-background hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={noteText}
            onChange={(e) => {
              if (e.target.value.length <= MAX_NOTE_LENGTH) setNoteText(e.target.value)
            }}
            placeholder="Describe what happened..."
            rows={4}
            className="w-full text-sm border rounded-lg px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none mb-2"
          />
          <div className="text-xs text-muted-foreground text-right pr-1">
            {noteText.length}/{MAX_NOTE_LENGTH} characters
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-muted/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Modals state
  const [receiptOrder, setReceiptOrder] = useState(null)
  const [noteOrder, setNoteOrder] = useState(null)
  const [voidingOrder, setVoidingOrder] = useState(null)

  const loadData = () => {
    setLoading(true)
    api.orders.list(200)
      .then((o) => { setOrders(o); setLoading(false) })
      .catch(() => {
        setLoading(false)
        toast.error('Failed to load data')
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const exportCSV = () => {
    if (filtered.length === 0) { toast.error('No orders to export'); return }

    const rows = [
      ['Order #', 'Date', 'Time', 'Cashier', 'Items', 'Total (₱)', 'Payment', 'GCash Ref', 'Status'],
      ...filtered.map((o) => [
        o.order_number || '',
        o.order_date || '',
        o.created_at ? format(new Date(o.created_at), 'h:mm a') : '',
        o.cashier_name || '',
        (o.items || []).map((i) => `${i.menu_item_name} x${i.quantity}`).join(' | '),
        (o.total_amount || 0).toFixed(2),
        o.payment_method === 'gcash' ? 'GCash' : 'Cash',
        o.gcash_reference || '',
        o.status || '',
      ]),
    ]

    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} orders`)
  }

  const handleSaveNote = async (orderId, noteText) => {
    await api.orders.update(orderId, { incidentNote: noteText || null })
    toast.success('Incident note updated')
    setNoteOrder(null)
    loadData()
  }

  const handleVoid = async (orderId, note) => {
    const order = orders.find((o) => o.id === orderId)
    await api.orders.update(orderId, {
      status: 'voided',
      voidNote: note || null,
      voidedAt: new Date().toISOString(),
      voidedBy: user?.full_name || 'Admin',
    })
    toast.success(`Order ${order?.order_number} has been voided.`)
    setVoidingOrder(null)
    loadData()
  }

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.cashier_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchPayment = paymentFilter === 'all' || (o.payment_method || 'cash') === paymentFilter
    const matchFlagged = !flaggedOnly || !!o.incidentNote
    const matchFrom = !dateFrom || (o.order_date && o.order_date >= dateFrom)
    const matchTo = !dateTo || (o.order_date && o.order_date <= dateTo)
    return matchSearch && matchStatus && matchPayment && matchFlagged && matchFrom && matchTo
  })

  const totalRevenue = filtered.filter((o) => o.status === 'completed').reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalFlagged = orders.filter((o) => !!o.incidentNote).length
  const today = new Date().toISOString().split('T')[0]

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedOrders = filtered.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE)

  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, paymentFilter, flaggedOnly, dateFrom, dateTo])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedOrders = filtered.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE)

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, paymentFilter, flaggedOnly, dateFrom, dateTo])

  return (
    <div>
      <PageHeader title="Orders" subtitle="All sales transactions" />
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search order # or cashier..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-36"
          title="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36"
          title="To date"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="gcash">GCash</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setDateFrom(today)
            setDateTo(today)
          }}
          className="h-10 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50"
        >
          Today
        </button>
        {/* Flagged Only Toggle */}
        <button
          onClick={() => setFlaggedOnly(!flaggedOnly)}
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${flaggedOnly
            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
            : 'bg-background border-input text-muted-foreground hover:bg-muted/50'
            }`}
          title="Show only orders with incident notes"
        >
          <AlertTriangle className="w-4 h-4" />
          Flagged{totalFlagged > 0 ? ` (${totalFlagged})` : ''}
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b bg-muted/40 flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">{filtered.length} orders</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Total: ₱{totalRevenue.toLocaleString()}</span>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title="Export filtered orders as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Order #</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Cashier</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Items</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Payment</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={8} className="text-center py-12 text-red-600">Error: {error}</td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No orders found.</td></tr>
              )}
              {!loading && paginatedOrders.map((o) => (
                <>
                  <tr key={o.id} className={`border-b last:border-0 hover:bg-muted/20 ${o.incidentNote ? 'bg-amber-50/30' : ''} ${o.status === 'voided' ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4 font-mono font-semibold">
                      <span className="flex items-center gap-1.5">
                        {o.order_number}
                        {o.incidentNote && (
                          <span className="text-amber-600" title="Has incident note">⚠️</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                      {o.order_date ? format(new Date(o.order_date), 'MMM d, yyyy') : '-'}
                      {o.created_at && (
                        <div className="text-xs">
                          {format(new Date(o.created_at), 'h:mm a')}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">{o.cashier_name || '-'}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {(o.items || []).length} items
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentBadgeColors[o.payment_method] || paymentBadgeColors.cash}`}>
                          {getPaymentLabel(o.payment_method)}
                        </span>
                        {o.payment_method === 'gcash' && o.gcash_reference && (
                          <span className="text-[11px] text-muted-foreground">Ref: {o.gcash_reference}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">₱{(o.total_amount || 0).toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[o.status]}`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {/* Note Button */}
                        <button
                          onClick={() => setNoteOrder(o)}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${o.incidentNote
                            ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                            : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80'
                            }`}
                          title={o.incidentNote ? "Edit Note" : "Add Note"}
                        >
                          <FilePenLine className="w-3.5 h-3.5" />
                          {o.incidentNote ? "Edit Note" : "Note"}
                        </button>

                        {/* Receipt Button */}
                        {o.status === 'completed' && (
                          <button
                            onClick={() => setReceiptOrder(o)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors"
                            title="View Receipt"
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        )}

                        {/* Void Button — admin only, completed orders only */}
                        {user?.role === 'admin' && o.status === 'completed' && (
                          <button
                            onClick={() => setVoidingOrder(o)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600/70 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors"
                            title="Void this order"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Void
                          </button>
                        )}

                        {/* VOIDED badge — non-interactive, for already-voided rows */}
                        {o.status === 'voided' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full cursor-default">
                            <Ban className="w-3 h-3" />
                            VOIDED
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Incident note sub-row */}
                  {o.incidentNote && (
                    <tr key={`${o.id}-note`} className="bg-amber-50/60 border-b">
                      <td colSpan={8} className="px-5 py-3">
                        <div className="text-sm text-amber-800 flex items-start gap-2 max-w-4xl">
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-semibold block mb-0.5">Incident:</span>
                            <span className="text-amber-700">{o.incidentNote}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Void note sub-row */}
                  {o.status === 'voided' && (
                    <tr key={`${o.id}-void`} className="bg-gray-50 border-b">
                      <td colSpan={8} className="px-5 py-3">
                        <div className="text-sm text-gray-600 flex items-start gap-2 max-w-4xl">
                          <Ban className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                          <div>
                            <span className="font-semibold block mb-0.5">
                              Voided by {o.voidedBy || 'Admin'}
                              {o.voidedAt ? ` · ${format(new Date(o.voidedAt), 'MMM d, h:mm a')}` : ''}
                            </span>
                            {o.voidNote && <span className="text-gray-500">{o.voidNote}</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(safePage * ORDERS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded border border-input bg-background text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50"
              >
                Prev
              </button>
              <span className="text-sm font-medium">Page {safePage} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded border border-input bg-background text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      <IncidentNoteModal order={noteOrder} onClose={() => setNoteOrder(null)} onSave={handleSaveNote} />
      <VoidOrderModal order={voidingOrder} onClose={() => setVoidingOrder(null)} onConfirm={handleVoid} />
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import OrderForm from '@/components/orders/OrderForm'
import PageHeader from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { CheckCircle2, RefreshCcw, X, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { getMenuItemIcon } from '@/utils/menuItemIcons'

function getPaymentLabel(method) {
  return method === 'gcash' ? 'GCash' : 'Cash'
}

function ReceiptModal({ order, onClose }) {
  if (!order) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-md mx-4 max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          <div className="flex justify-end mb-2">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div id="receipt" className="text-center font-mono text-sm">
            <h2 className="text-lg font-bold mb-2">Chelsy's Burger</h2>
            <p className="mb-2">Order Receipt</p>
            <p className="mb-1">Order: {order.order_number}</p>
            <p className="mb-1">{order.created_at ? format(new Date(order.created_at), 'MMMM d, yyyy — h:mm a') : order.order_date}</p>
            <p className="mb-4">Served by: {order.cashier_name}</p>

            <div className="border-t border-b py-2 mb-2">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex justify-between mb-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-sm">{getMenuItemIcon(item)}</span>
                    <span>{item.menu_item_name} x{item.quantity}</span>
                  </span>
                  <span>₱{(item.subtotal || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 mb-4">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>₱{(order.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{getPaymentLabel(order.payment_method)}</span>
              </div>
              {order.payment_method === 'gcash' && (
                <div className="flex justify-between">
                  <span>Reference #:</span>
                  <span>{order.gcash_reference || '-'}</span>
                </div>
              )}
              {order.payment_method === 'cash' && order.amount_tendered != null && (
                <>
                  <div className="flex justify-between">
                    <span>Tendered:</span>
                    <span>₱{Number(order.amount_tendered).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Change:</span>
                    <span>₱{(order.change_amount != null ? Number(order.change_amount) : 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashierPOS() {
  const { user } = useAuth()
  const { displayName } = useCashierStore()

  const activeName = user ? user.full_name : displayName
  const [menuItems, setMenuItems] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [receiptOrder, setReceiptOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      api.menuItems.list(),
      api.orders.list()
    ]).then(([m, o]) => {
      setMenuItems(m)

      // Filter for today's orders by this cashier
      const myRecentOrders = o.filter(
        order => order.order_date === today &&
          order.cashier_name === activeName &&
          order.status === 'completed'
      )
      setRecentOrders(myRecentOrders)
    }).catch(() => {
      toast.error('Failed to load data')
    }).finally(() => {
      setLoading(false)
    })
  }, [activeName])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (orderData) => {
    setSubmitting(true)
    try {
      const createdOrder = await api.orders.create({
        ...orderData,
        cashier_name: activeName || 'Unknown',
      })
      setReceiptOrder(createdOrder)
      toast.success('Order placed successfully!')
      setLastOrder(createdOrder || orderData)
      loadData()
    } catch (_err) {
      toast.error('Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  const shiftTotal = recentOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

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
      <div className="flex justify-between items-end mb-6">
        <PageHeader title="Point of Sale" subtitle={`Welcome, ${activeName || 'Cashier'}`} />

        {/* Shift Summary Mini-Widget */}
        <div className="flex gap-4">
          <div className="bg-card border rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Shift Orders</p>
              <p className="font-bold text-lg leading-none">{recentOrders.length}</p>
            </div>
          </div>
          <div className="bg-card border rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="bg-green-100 text-green-700 p-2 rounded flex-shrink-0">
              <RefreshCcw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Shift Revenue</p>
              <p className="font-bold text-lg leading-none">₱{shiftTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <OrderForm menuItems={menuItems} onSubmit={handleSubmit} loading={submitting || loading} />
      </div>

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
    </div>
  )
}

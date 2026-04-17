import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import OrderForm from '@/components/orders/OrderForm'
import ReceiptModal from '@/components/orders/ReceiptModal'
import StockShortageModal from '@/components/orders/StockShortageModal'
import PageHeader from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { getMenuItemIcon } from '@/utils/menuItemIcons'

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
  const [stockShortage, setStockShortage] = useState(null) // null or [{ ingredientId, ... }]
  const [pendingOrder, setPendingOrder] = useState(null)    // order data waiting for restock

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    const today = format(new Date(), 'yyyy-MM-dd')
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

  const placeOrder = async (orderData) => {
    setSubmitting(true)
    try {
      // Atomic: order creation + all recipe stock deductions commit together,
      // or nothing commits. No more partial-deduction drift.
      const { order: createdOrder, deductions } = await api.orders.placeOrderAtomic({
        ...orderData,
        cashier_name: activeName || 'Unknown',
      })

      setReceiptOrder(createdOrder)

      // Tell the cashier if any new packs were opened to fill this order
      const autoOpened = deductions.filter((d) => d.packsAutoOpened > 0)
      if (autoOpened.length > 0) {
        const summary = autoOpened
          .map((d) => `${d.ingredientName} (${d.packsAutoOpened} new pack${d.packsAutoOpened > 1 ? 's' : ''})`)
          .join(', ')
        toast.success(`Order placed — opened: ${summary}`)
      } else {
        toast.success('Order placed successfully!')
      }

      setLastOrder(createdOrder || orderData)
      setStockShortage(null)
      setPendingOrder(null)
      loadData()
    } catch (err) {
      // Surface real failures — no more silent console.warn swallowing
      if (err?.code === 'INSUFFICIENT_STOCK' && Array.isArray(err.shortages)) {
        // Stock changed between checkStock() and placement (race condition)
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
    // Check stock before placing
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
      <div className="mb-6">
        <PageHeader title="New Order" subtitle={`Cashier: ${activeName || 'Cashier'}`} />
      </div>

      <div className="flex-1 min-h-0">
        <OrderForm menuItems={menuItems} onSubmit={handleSubmit} loading={submitting || loading} />
      </div>

      <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />

      {stockShortage && (
        <StockShortageModal
          shortages={stockShortage}
          cashierName={activeName || 'Cashier'}
          onRetry={handleShortageRetry}
          onCancel={handleShortageCancel}
        />
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import OrderForm from '@/components/orders/OrderForm'
import ReceiptModal from '@/components/orders/ReceiptModal'
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
    </div>
  )
}

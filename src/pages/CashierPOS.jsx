import { useState, useEffect, useCallback } from 'react'
import { api } from '@/api'
import { useAuth } from '@/lib/AuthContext'
import { useCashierStore } from '@/lib/useCashierStore'
import OrderForm from '@/components/orders/OrderForm'
import PageHeader from '@/components/shared/PageHeader'
import { toast } from 'sonner'
import { CheckCircle2, RefreshCcw } from 'lucide-react'

export default function CashierPOS() {
  const { user } = useAuth()
  const { displayName } = useCashierStore()

  const activeName = user ? user.full_name : displayName
  const [menuItems, setMenuItems] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.menuItems.list(),
      api.orders.list(50)
    ]).then(([m, o]) => {
      setMenuItems(m)

      // Filter for today's orders by this cashier
      const today = new Date().toISOString().split('T')[0]
      const myRecentOrders = o.filter(
        order => order.order_date === today &&
          order.cashier_name === activeName &&
          order.status === 'completed'
      )
      setRecentOrders(myRecentOrders)
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
      await api.orders.create({
        ...orderData,
        cashier_name: activeName || 'Unknown',
      })
      toast.success('Order placed successfully!')
      loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const shiftTotal = recentOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

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
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { api } from '@/api'
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import StatCard from '@/components/dashboard/StatCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import TopItems from '@/components/dashboard/TopItems'
import PageHeader from '@/components/shared/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [chartView, setChartView] = useState('today') // 'today' or 'week'
  const [paymentFilter, setPaymentFilter] = useState('all')

  useEffect(() => {
    Promise.all([api.orders.list(500), api.ingredients.list()])
      .then(([o, i]) => {
        setOrders(o)
        setIngredients(i)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        toast.error('Failed to load data')
      })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const completedOrders = orders.filter((o) => o.status === 'completed')
  const todayCompletedOrders = completedOrders.filter((o) => o.order_date === today)
  const todayOrders = todayCompletedOrders.filter((o) => paymentFilter === 'all' || (o.payment_method || 'cash') === paymentFilter)
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const todayOrderCount = todayOrders.length
  const avgOrderValue = todayOrderCount > 0 ? Math.round(todayRevenue / todayOrderCount) : 0
  const todayCashSales = todayCompletedOrders.filter((o) => (o.payment_method || 'cash') === 'cash').reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const todayGcashSales = todayCompletedOrders.filter((o) => (o.payment_method || 'cash') === 'gcash').reduce((sum, o) => sum + (o.total_amount || 0), 0)

  // Chart Data
  let chartData = []
  if (chartView === 'today') {
    // Hours 8AM to 9PM
    chartData = Array.from({ length: 14 }, (_, i) => {
      const hour = 8 + i
      const hourStart = new Date()
      hourStart.setHours(hour, 0, 0, 0)
      const hourEnd = new Date()
      hourEnd.setHours(hour + 1, 0, 0, 0)
      const rev = todayOrders
        .filter((o) => {
          const createdAt = o.createdAt || o.created_at
          if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) return false
          const orderTime = new Date(createdAt)
          return orderTime >= hourStart && orderTime < hourEnd
        })
        .reduce((s, o) => s + (o.total_amount || 0), 0)
      return { label: `${hour % 12 || 12}${hour < 12 ? 'AM' : 'PM'}`, revenue: rev }
    })
  } else {
    // This Week
    chartData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dateStr = date.toISOString().split('T')[0]
      const rev = orders
        .filter((o) => o.order_date === dateStr && o.status === 'completed' && (paymentFilter === 'all' || (o.payment_method || 'cash') === paymentFilter))
        .reduce((s, o) => s + (o.total_amount || 0), 0)
      return { label: format(date, 'MMM d'), revenue: rev }
    })
  }

  const inventoryAlerts = useMemo(() => {
    const expired = ingredients.filter((i) => api.ingredients.getExpiryStatus(i.expiry_date)?.severity === 'critical')
    const expiringSoon = ingredients.filter((i) => api.ingredients.getExpiryStatus(i.expiry_date)?.severity === 'warning')
    const outOfStock = ingredients.filter((i) => (i.current_stock || 0) === 0)
    const lowStock = ingredients.filter((i) => (i.current_stock || 0) > 0 && (i.current_stock || 0) <= (i.warning_level || 0))

    const totalAlerts = new Set([
      ...expired.map((i) => i.id),
      ...expiringSoon.map((i) => i.id),
      ...outOfStock.map((i) => i.id),
      ...lowStock.map((i) => i.id),
    ]).size

    return { expired, expiringSoon, outOfStock, lowStock, totalAlerts }
  }, [ingredients])

  const hasCritical = inventoryAlerts.expired.length > 0 || inventoryAlerts.outOfStock.length > 0
  const hasAnyIssues = inventoryAlerts.totalAlerts > 0
  const hasExpiryIssues = inventoryAlerts.expired.length > 0 || inventoryAlerts.expiringSoon.length > 0

  const summarizeItems = (items, formatItem) => {
    if (items.length === 0) return ''
    const shown = items.slice(0, 3).map(formatItem)
    const remaining = items.length - shown.length
    return `${shown.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}`
  }

  const handleViewInventory = () => {
    navigate('/Products', { state: { defaultTab: hasExpiryIssues ? 'activity' : 'ingredients' } })
  }

  const alertGroups = useMemo(() => {
    const groups = []

    if (inventoryAlerts.expired.length > 0 && inventoryAlerts.outOfStock.length > 0) {
      const urgentCount = new Set([
        ...inventoryAlerts.expired.map((i) => i.id),
        ...inventoryAlerts.outOfStock.map((i) => i.id),
      ]).size
      groups.push({
        key: 'urgent',
        icon: '🔴',
        title: `${urgentCount} urgent items - ${inventoryAlerts.expired.length} expired, ${inventoryAlerts.outOfStock.length} out of stock`,
        detail: summarizeItems(
          [...new Map([...inventoryAlerts.expired, ...inventoryAlerts.outOfStock].map((i) => [i.id, i])).values()],
          (i) => i.name,
        ),
        tone: 'red',
      })
    } else {
      if (inventoryAlerts.expired.length > 0) {
        groups.push({
          key: 'expired',
          icon: '🔴',
          title: `${inventoryAlerts.expired.length} expired items`,
          detail: summarizeItems(inventoryAlerts.expired, (i) => i.name),
          tone: 'red',
        })
      }
      if (inventoryAlerts.outOfStock.length > 0) {
        groups.push({
          key: 'out_of_stock',
          icon: '🔴',
          title: `${inventoryAlerts.outOfStock.length} out of stock items`,
          detail: summarizeItems(inventoryAlerts.outOfStock, (i) => i.name),
          tone: 'red',
        })
      }
    }

    if (inventoryAlerts.expiringSoon.length > 0) {
      groups.push({
        key: 'expiring_soon',
        icon: '🟠',
        title: `${inventoryAlerts.expiringSoon.length} item${inventoryAlerts.expiringSoon.length > 1 ? 's' : ''} expiring soon`,
        detail: summarizeItems(inventoryAlerts.expiringSoon, (i) => `${i.name} (${format(new Date(i.expiry_date), 'MMM d')})`),
        tone: 'orange',
      })
    }

    if (inventoryAlerts.lowStock.length > 0) {
      groups.push({
        key: 'low_stock',
        icon: '🟡',
        title: `${inventoryAlerts.lowStock.length} low stock item${inventoryAlerts.lowStock.length > 1 ? 's' : ''}`,
        detail: summarizeItems(inventoryAlerts.lowStock, (i) => `${i.name} (${i.current_stock} remaining)`),
        tone: 'yellow',
      })
    }

    return groups.slice(0, 4)
  }, [inventoryAlerts])

  return (
    <div>
      {loading && (
        <div className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading...
        </div>
      )}
      <PageHeader title="Sales Dashboard" subtitle={`Today, ${format(new Date(), 'MMMM d, yyyy')}`} />
      <div className="mb-4 flex items-center justify-between rounded-xl border bg-card px-4 py-3">
        <div className="text-sm text-muted-foreground">Report Filter</div>
        <div className="w-44">
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="gcash">GCash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue Today" value={`₱${todayRevenue.toLocaleString()}`} subtitle={`${todayOrderCount} orders`} icon={DollarSign} color="primary" />
        <StatCard title="Total Orders Today" value={todayOrderCount} subtitle="Completed orders" icon={ShoppingCart} color="orange" />
        <StatCard title="Average Order Value" value={`₱${avgOrderValue.toLocaleString()}`} subtitle="Per order" icon={TrendingUp} color="green" />
      </div>
      <div className="mb-6 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-semibold">Payment Breakdown:</span>{' '}
        <span className="text-green-700 font-medium">Cash: ₱{todayCashSales.toLocaleString()}</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-blue-700 font-medium">GCash: ₱{todayGcashSales.toLocaleString()}</span>
      </div>
      <div className="mb-6">
        <RevenueChart data={chartData} view={chartView} onViewChange={setChartView} />
      </div>

      {isAdmin && (
        <div className={`mb-6 bg-card rounded-xl border p-5 shadow-sm ${hasAnyIssues ? (hasCritical ? 'border-red-300' : 'border-yellow-300') : 'border-green-300 bg-green-50'}`}>
          {!hasAnyIssues ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-700">Inventory looks good</p>
                <p className="text-sm text-green-700/80">No low stock or expiry issues</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${hasCritical ? 'text-red-600' : 'text-yellow-700'}`} />
                  <h3 className="font-semibold text-sm">Inventory Alerts ({inventoryAlerts.totalAlerts})</h3>
                </div>
                <button
                  type="button"
                  onClick={handleViewInventory}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  → View Inventory
                </button>
              </div>

              <div className="mt-4 divide-y">
                {alertGroups.map((group) => (
                  <div key={group.key} className="py-3 first:pt-0 last:pb-0">
                    <p className={`text-sm font-medium ${group.tone === 'red' ? 'text-red-700' : group.tone === 'orange' ? 'text-orange-700' : 'text-yellow-700'}`}>
                      {group.icon} {group.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{group.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <TopItems orders={todayOrders} />
    </div>
  )
}

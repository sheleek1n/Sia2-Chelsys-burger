import { useState, useEffect, useMemo } from 'react'
import { api } from '@/api'
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, CheckCircle2, FileText, X, Printer, Clock } from 'lucide-react'
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
  const [error, setError] = useState(null)
  const [orders, setOrders] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [batches, setBatches] = useState([])
  const [stockLogs, setStockLogs] = useState([])
  const [chartView, setChartView] = useState('today') // 'today' or 'week'
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [showEOD, setShowEOD] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([api.orders.list(500), api.ingredients.list(), api.stockBatches.list(), api.stockLogs.list(2000)])
      .then(([o, i, b, sl]) => {
        setOrders(o)
        setIngredients(i)
        setBatches(b)
        setStockLogs(sl)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load dashboard data')
        toast.error('Failed to load data')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const today = format(new Date(), 'yyyy-MM-dd')
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
      const dateStr = format(date, 'yyyy-MM-dd')
      const rev = orders
        .filter((o) => o.order_date === dateStr && o.status === 'completed' && (paymentFilter === 'all' || (o.payment_method || 'cash') === paymentFilter))
        .reduce((s, o) => s + (o.total_amount || 0), 0)
      return { label: format(date, 'MMM d'), revenue: rev }
    })
  }

  const inventoryAlerts = useMemo(() => {
    const outOfStock = ingredients.filter((i) => (i.current_stock || 0) === 0)
    const lowStock = ingredients.filter((i) => (i.current_stock || 0) > 0 && (i.current_stock || 0) <= (i.warning_level || 0))
    const expiredBatches = batches.filter((b) => !b.isExhausted && b.expiryDate && api.ingredients.getExpiryStatus(b.expiryDate)?.severity === 'critical')
    const expiringBatches = batches.filter((b) => !b.isExhausted && b.expiryDate && api.ingredients.getExpiryStatus(b.expiryDate)?.severity === 'warning')
    const totalAlerts = new Set([
      ...outOfStock.map((i) => i.id),
      ...lowStock.map((i) => i.id),
      ...expiredBatches.map((b) => b.ingredientId),
      ...expiringBatches.map((b) => b.ingredientId),
    ]).size
    return { outOfStock, lowStock, expiredBatches, expiringBatches, totalAlerts }
  }, [ingredients, batches])

  const hasCritical = inventoryAlerts.outOfStock.length > 0 || inventoryAlerts.expiredBatches.length > 0
  const hasAnyIssues = inventoryAlerts.totalAlerts > 0

  const summarizeItems = (items, formatItem) => {
    if (items.length === 0) return ''
    const shown = items.slice(0, 3).map(formatItem)
    const remaining = items.length - shown.length
    return `${shown.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}`
  }

  const handleViewInventory = () => {
    navigate('/Products', { state: { defaultTab: 'ingredients' } })
  }

  const alertGroups = useMemo(() => {
    const groups = []

    if (inventoryAlerts.expiredBatches.length > 0) {
      groups.push({
        key: 'expired',
        icon: '🔴',
        title: `${inventoryAlerts.expiredBatches.length} expired batch${inventoryAlerts.expiredBatches.length > 1 ? 'es' : ''}`,
        detail: summarizeItems(inventoryAlerts.expiredBatches, (b) => `${b.ingredientName} (${b.quantity} left)`),
        tone: 'red',
      })
    }

    if (inventoryAlerts.outOfStock.length > 0) {
      groups.push({
        key: 'out_of_stock',
        icon: '🔴',
        title: `${inventoryAlerts.outOfStock.length} out of stock item${inventoryAlerts.outOfStock.length > 1 ? 's' : ''}`,
        detail: summarizeItems(inventoryAlerts.outOfStock, (i) => i.name),
        tone: 'red',
      })
    }

    if (inventoryAlerts.expiringBatches.length > 0) {
      groups.push({
        key: 'expiring_soon',
        icon: '🟠',
        title: `${inventoryAlerts.expiringBatches.length} batch${inventoryAlerts.expiringBatches.length > 1 ? 'es' : ''} expiring soon`,
        detail: summarizeItems(inventoryAlerts.expiringBatches, (b) => `${b.ingredientName} (${b.quantity} left)`),
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

  // #6 — Projected runout forecast: avg daily consumption over last 7 days
  const projectedRunout = useMemo(() => {
    if (!stockLogs.length || !ingredients.length) return []

    const sevenDaysAgo = subDays(new Date(), 7)
    const recentLogs = stockLogs.filter(
      (l) =>
        (l.action === 'consumed' || l.action === 'pieces_consumed') &&
        new Date(l.createdAt) >= sevenDaysAgo &&
        l.quantity < 0
    )

    // Group total consumption by ingredientId over last 7 days
    const consumptionById = {}
    for (const log of recentLogs) {
      const id = log.itemId
      if (!id) continue
      consumptionById[id] = (consumptionById[id] || 0) + Math.abs(log.quantity)
    }

    return ingredients
      .filter((ing) => consumptionById[ing.id]) // only ingredients actively being consumed
      .map((ing) => {
        const ppp = ing.pieces_per_pack && ing.pieces_per_pack > 1 ? ing.pieces_per_pack : null
        const totalStock = ppp
          ? (ing.current_stock || 0) * ppp + (ing.open_pieces || 0)
          : ing.current_stock || 0
        const consumed7d = consumptionById[ing.id] || 0
        const dailyRate = consumed7d / 7
        const daysLeft = dailyRate > 0 ? Math.round(totalStock / dailyRate) : null
        return {
          id: ing.id,
          name: ing.name,
          daysLeft,
          dailyRate: Math.round(dailyRate * 10) / 10,
          unit: ppp ? 'pcs/day' : `${ing.unit || 'units'}/day`,
        }
      })
      .filter((item) => item.daysLeft !== null && item.daysLeft < 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 6)
  }, [stockLogs, ingredients])

  if (loading) {
    return (
      <div>
        <PageHeader title="Today's Sales" subtitle={`Today, ${format(new Date(), 'MMMM d, yyyy')}`} />
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Today's Sales" subtitle={`Today, ${format(new Date(), 'MMMM d, yyyy')}`} />
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <PageHeader title="Today's Sales" subtitle={`Today, ${format(new Date(), 'MMMM d, yyyy')}`} />
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowEOD(true)}
              className="flex items-center gap-2 px-3 py-2 h-9 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg"
            >
              <FileText className="w-4 h-4" /> End of Day
            </button>
          )}
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="cash">Cash only</SelectItem>
              <SelectItem value="gcash">GCash only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard title="Today's Sales" value={`₱${todayRevenue.toLocaleString()}`} subtitle={`${todayOrderCount} order${todayOrderCount !== 1 ? 's' : ''}`} icon={DollarSign} color="primary" />
        <StatCard title="Orders Today" value={todayOrderCount} subtitle="Completed orders" icon={ShoppingCart} color="orange" />
        <StatCard title="Average Per Order" value={`₱${avgOrderValue.toLocaleString()}`} subtitle="Per completed order" icon={TrendingUp} color="green" />
      </div>
      <div className="mb-6 rounded-xl border bg-card px-5 py-3 flex items-center gap-6">
        <span className="text-sm font-semibold text-muted-foreground">How customers paid</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="text-sm font-medium text-gray-700">Cash</span>
          <span className="text-sm font-bold text-green-700">₱{todayCashSales.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          <span className="text-sm font-medium text-gray-700">GCash</span>
          <span className="text-sm font-bold text-blue-700">₱{todayGcashSales.toLocaleString()}</span>
        </div>
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
                <p className="font-semibold text-green-700">All stock is fine</p>
                <p className="text-sm text-green-700/80">No low stock or expiry issues</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${hasCritical ? 'text-red-600' : 'text-yellow-700'}`} />
                  <h3 className="font-semibold text-sm">Stock Warnings ({inventoryAlerts.totalAlerts})</h3>
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

      {/* #6 — Projected Runout Forecast */}
      {isAdmin && projectedRunout.length > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-orange-600" />
            <h3 className="font-semibold text-sm text-orange-800">Projected Stock Runout (based on last 7 days)</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {projectedRunout.map((item) => {
              const isUrgent = item.daysLeft <= 2
              const isWarning = item.daysLeft <= 5
              const colorCls = isUrgent
                ? 'bg-red-50 border-red-200'
                : isWarning
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-yellow-50 border-yellow-200'
              const textCls = isUrgent ? 'text-red-700' : isWarning ? 'text-orange-700' : 'text-yellow-700'
              return (
                <div key={item.id} className={`rounded-lg border p-3 ${colorCls}`}>
                  <p className="text-xs font-semibold text-gray-700 truncate">{item.name}</p>
                  <p className={`text-lg font-bold ${textCls}`}>
                    {item.daysLeft === 0 ? '< 1 day' : `~${item.daysLeft} day${item.daysLeft !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.dailyRate} {item.unit}</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Only showing ingredients running out within 30 days based on recent usage.</p>
        </div>
      )}

      {/* End-of-Day Summary Modal */}
      {showEOD && (
        <EODModal
          orders={completedOrders}
          todayOrders={todayCompletedOrders}
          today={today}
          inventoryAlerts={inventoryAlerts}
          onClose={() => setShowEOD(false)}
        />
      )}
    </div>
  )
}

function EODModal({ orders, todayOrders, today, inventoryAlerts, onClose }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const totalRevenue = todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const orderCount = todayOrders.length
  const avgOrder = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0

  const cashOrders = todayOrders.filter((o) => (o.payment_method || 'cash') === 'cash')
  const gcashOrders = todayOrders.filter((o) => o.payment_method === 'gcash')
  const cashTotal = cashOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const gcashTotal = gcashOrders.reduce((s, o) => s + (o.total_amount || 0), 0)

  // Top items
  const itemCounts = {}
  todayOrders.forEach((o) => {
    ;(o.items || []).forEach((item) => {
      const name = item.menu_item_name || 'Unknown'
      if (!itemCounts[name]) itemCounts[name] = { name, qty: 0, revenue: 0 }
      itemCounts[name].qty += item.quantity || 1
      itemCounts[name].revenue += item.subtotal || 0
    })
  })
  const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Cashier breakdown
  const cashierBreakdown = {}
  todayOrders.forEach((o) => {
    const name = o.cashier_name || 'Unknown'
    if (!cashierBreakdown[name]) cashierBreakdown[name] = { name, orders: 0, revenue: 0 }
    cashierBreakdown[name].orders++
    cashierBreakdown[name].revenue += o.total_amount || 0
  })
  const cashiers = Object.values(cashierBreakdown).sort((a, b) => b.revenue - a.revenue)

  // Cancelled/voided today
  const allTodayOrders = orders.filter((o) => o.order_date === today)
  const cancelledCount = allTodayOrders.filter((o) => o.status === 'voided' || o.status === 'cancelled').length
  const refundedCount = allTodayOrders.filter((o) => o.status === 'refunded').length

  const handlePrint = () => {
    const printEl = document.getElementById('eod-print-content')
    if (!printEl) return
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    printWindow.document.write(`
      <html><head><title>End of Day — ${format(new Date(), 'MMM d, yyyy')}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; font-size: 12px; padding: 20px; max-width: 350px; margin: 0 auto; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 3px 4px; text-align: left; }
        td:last-child, th:last-child { text-align: right; }
        .total-row td { border-top: 2px solid #000; font-weight: bold; padding-top: 6px; }
        .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
        @media print { button { display: none; } }
      </style></head><body>
      ${printEl.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-lg text-gray-900">End-of-Day Summary</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg" title="Print">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4" id="eod-print-content">
          <h1 style={{ fontSize: '16px', textAlign: 'center', marginBottom: '4px' }}>Chelsy's Burger</h1>
          <p className="subtitle" style={{ textAlign: 'center', color: '#666', marginBottom: '12px', fontSize: '12px' }}>
            End of Day Report — {format(new Date(), 'MMMM d, yyyy')}
          </p>

          {/* Revenue Summary */}
          <h2 className="text-sm font-bold text-gray-900 border-b pb-1 mb-2 mt-0">Sales Summary</h2>
          <table className="w-full text-sm mb-1">
            <tbody>
              <tr><td className="py-1 text-gray-600">Total Revenue</td><td className="py-1 text-right font-bold text-lg">₱{totalRevenue.toLocaleString()}</td></tr>
              <tr><td className="py-1 text-gray-600">Completed Orders</td><td className="py-1 text-right font-semibold">{orderCount}</td></tr>
              <tr><td className="py-1 text-gray-600">Average Per Order</td><td className="py-1 text-right">₱{avgOrder.toLocaleString()}</td></tr>
              {cancelledCount > 0 && <tr><td className="py-1 text-red-600">Cancelled</td><td className="py-1 text-right text-red-600">{cancelledCount}</td></tr>}
              {refundedCount > 0 && <tr><td className="py-1 text-yellow-700">Refunded</td><td className="py-1 text-right text-yellow-700">{refundedCount}</td></tr>}
            </tbody>
          </table>

          {/* Payment Breakdown */}
          <h2 className="text-sm font-bold text-gray-900 border-b pb-1 mb-2 mt-4">Payment Breakdown</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-gray-600">Cash ({cashOrders.length} orders)</td><td className="py-1 text-right font-semibold text-green-700">₱{cashTotal.toLocaleString()}</td></tr>
              <tr><td className="py-1 text-gray-600">GCash ({gcashOrders.length} orders)</td><td className="py-1 text-right font-semibold text-blue-700">₱{gcashTotal.toLocaleString()}</td></tr>
            </tbody>
            <tfoot>
              <tr className="total-row"><td className="pt-2 font-bold border-t">Total</td><td className="pt-2 text-right font-bold border-t">₱{totalRevenue.toLocaleString()}</td></tr>
            </tfoot>
          </table>

          {/* Top Items */}
          {topItems.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-900 border-b pb-1 mb-2 mt-4">Top Items</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500"><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Revenue</th></tr></thead>
                <tbody>
                  {topItems.map((item) => (
                    <tr key={item.name}><td className="py-1 text-gray-700">{item.name}</td><td className="py-1 text-right">{item.qty}</td><td className="py-1 text-right">₱{item.revenue.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Cashier Breakdown */}
          {cashiers.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-900 border-b pb-1 mb-2 mt-4">Cashier Performance</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500"><th className="text-left py-1">Cashier</th><th className="text-right py-1">Orders</th><th className="text-right py-1">Revenue</th></tr></thead>
                <tbody>
                  {cashiers.map((c) => (
                    <tr key={c.name}><td className="py-1 text-gray-700">{c.name}</td><td className="py-1 text-right">{c.orders}</td><td className="py-1 text-right">₱{c.revenue.toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Stock Alerts */}
          {inventoryAlerts.totalAlerts > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-900 border-b pb-1 mb-2 mt-4">Stock Alerts</h2>
              <div className="text-sm space-y-1">
                {inventoryAlerts.outOfStock.length > 0 && (
                  <p className="text-red-700">🔴 {inventoryAlerts.outOfStock.length} out of stock: {inventoryAlerts.outOfStock.slice(0, 5).map((i) => i.name).join(', ')}</p>
                )}
                {inventoryAlerts.lowStock.length > 0 && (
                  <p className="text-yellow-700">🟡 {inventoryAlerts.lowStock.length} low stock: {inventoryAlerts.lowStock.slice(0, 5).map((i) => `${i.name} (${i.current_stock})`).join(', ')}</p>
                )}
                {inventoryAlerts.expiredBatches.length > 0 && (
                  <p className="text-red-700">🔴 {inventoryAlerts.expiredBatches.length} expired batches</p>
                )}
                {inventoryAlerts.expiringBatches.length > 0 && (
                  <p className="text-orange-700">🟠 {inventoryAlerts.expiringBatches.length} batches expiring soon</p>
                )}
              </div>
            </>
          )}

          <div className="divider" style={{ borderTop: '1px dashed #ccc', margin: '14px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#999' }}>
            Generated {format(new Date(), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>
    </div>
  )
}

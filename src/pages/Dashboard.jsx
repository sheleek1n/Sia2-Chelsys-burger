import { useState, useEffect } from 'react'
import { api } from '@/api'
import { DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'
import StatCard from '@/components/dashboard/StatCard'
import LowStockAlert from '@/components/dashboard/LowStockAlert'
import RevenueChart from '@/components/dashboard/RevenueChart'
import TopItems from '@/components/dashboard/TopItems'
import PageHeader from '@/components/shared/PageHeader'

export default function Dashboard() {
  const [orders, setOrders] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [chartView, setChartView] = useState('today') // 'today' or 'week'

  useEffect(() => {
    Promise.all([api.orders.list(500), api.ingredients.list()])
      .then(([o, i]) => {
        setOrders(o)
        setIngredients(i)
      })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const todayOrders = orders.filter((o) => o.order_date === today && o.status === 'completed')
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const todayOrderCount = todayOrders.length
  const avgOrderValue = todayOrderCount > 0 ? Math.round(todayRevenue / todayOrderCount) : 0

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
          const orderTime = new Date(`${o.order_date}T${o.createdAt ? new Date(o.createdAt).toISOString().split('T')[1] : '12:00:00'}`)
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
        .filter((o) => o.order_date === dateStr && o.status === 'completed')
        .reduce((s, o) => s + (o.total_amount || 0), 0)
      return { label: format(date, 'MMM d'), revenue: rev }
    })
  }

  return (
    <div>
      <PageHeader title="Sales Dashboard" subtitle={`Today, ${format(new Date(), 'MMMM d, yyyy')}`} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue Today" value={`₱${todayRevenue.toLocaleString()}`} subtitle={`${todayOrderCount} orders`} icon={DollarSign} color="primary" />
        <StatCard title="Total Orders Today" value={todayOrderCount} subtitle="Completed orders" icon={ShoppingCart} color="orange" />
        <StatCard title="Average Order Value" value={`₱${avgOrderValue.toLocaleString()}`} subtitle="Per order" icon={TrendingUp} color="green" />
      </div>
      <div className="mb-6">
        <RevenueChart data={chartData} view={chartView} onViewChange={setChartView} />
      </div>
      <TopItems orders={todayOrders} />
      <LowStockAlert ingredients={ingredients} />
    </div>
  )
}

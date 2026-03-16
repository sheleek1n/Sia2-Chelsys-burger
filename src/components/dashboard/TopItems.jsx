export default function TopItems({ orders = [] }) {
  const itemStats = {}
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const name = item.menu_item_name || 'Unknown'
      if (!itemStats[name]) {
        itemStats[name] = { qty: 0, revenue: 0 }
      }
      itemStats[name].qty += item.quantity || 1
      itemStats[name].revenue += (item.quantity || 1) * (item.unit_price || 0)
    })
  })
  const top = Object.entries(itemStats)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5)
  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <h3 className="font-semibold text-sm mb-4">Top Selling Items Today</h3>
      {top.length === 0 && <p className="text-muted-foreground text-sm">No data yet.</p>}
      <div className="space-y-3">
        {top.map(([name, stats], i) => (
          <div key={name} className="grid grid-cols-4 gap-2 text-sm">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
              {i + 1}
            </span>
            <span className="col-span-2">{name}</span>
            <div className="text-right">
              <p className="font-semibold">{stats.qty} sold</p>
              <p className="text-xs text-muted-foreground">₱{stats.revenue.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

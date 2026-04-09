export default function StatCard({ title, value, subtitle, icon: Icon, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl border p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl flex-shrink-0 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold mt-0.5 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
    </div>
  )
}

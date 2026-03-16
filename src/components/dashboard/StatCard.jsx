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
    <div className="bg-card rounded-xl border p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

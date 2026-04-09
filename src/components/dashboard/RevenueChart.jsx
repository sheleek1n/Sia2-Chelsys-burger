import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function RevenueChart({ data = [], view, onViewChange }) {
  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Sales Overview</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('today')}
            className={`px-3 py-1 text-xs rounded ${view === 'today' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
          >
            Today
          </button>
          <button
            onClick={() => onViewChange('week')}
            className={`px-3 py-1 text-xs rounded ${view === 'week' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
          >
            This Week
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(val) => [`₱${Number(val).toLocaleString()}`, 'Revenue']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5ddd5' }}
          />
          <Bar dataKey="revenue" fill="hsl(4,75%,42%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

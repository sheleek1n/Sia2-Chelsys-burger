import { AlertTriangle } from 'lucide-react'

export default function LowStockAlert({ ingredients = [] }) {
  const low = ingredients.filter((i) => i.current_stock <= i.reorder_level)
  if (low.length === 0) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <span className="font-semibold text-red-700 text-sm">Low Stock Alert ({low.length} items)</span>
      </div>
      <div className="space-y-2">
        {low.map((i) => (
          <div key={i.id} className="flex justify-between items-center text-sm">
            <span className="text-red-800">{i.name}</span>
            <span className="text-red-600 font-medium">
              {i.current_stock} {i.unit} left (min: {i.reorder_level})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

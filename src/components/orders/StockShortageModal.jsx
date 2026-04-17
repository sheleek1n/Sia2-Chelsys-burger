import { useState } from 'react'
import { AlertTriangle, Package, Check, X } from 'lucide-react'
import { api } from '@/api'
import { toast } from 'sonner'

/**
 * Stock Shortage Modal — shown when a cashier tries to place an order
 * but ingredients are insufficient. Allows quick "Open Pack" to restock
 * without leaving the POS screen.
 */
export default function StockShortageModal({ shortages: initialShortages, cashierName, onRetry, onCancel }) {
  const [shortages, setShortages] = useState(initialShortages)
  const [opening, setOpening] = useState({}) // ingredientId → true while loading

  const handleOpenPack = async (shortage) => {
    const { ingredientId, ingredientName } = shortage
    setOpening((prev) => ({ ...prev, [ingredientId]: true }))
    try {
      const result = await api.ingredients.consume(ingredientId, {
        loggedBy: cashierName,
        note: 'Quick restock from POS order',
        qty: 1,
      })
      const updatedItem = result.item
      const ppp = updatedItem.pieces_per_pack
      const newAvailable = ppp && ppp > 1
        ? (updatedItem.current_stock || 0) * ppp + (updatedItem.open_pieces || 0)
        : updatedItem.current_stock
      const newAvailableLabel = ppp && ppp > 1
        ? `${newAvailable} pieces (${updatedItem.current_stock} unopened + ${updatedItem.open_pieces || 0} ready)`
        : null
      setShortages((prev) =>
        prev.map((s) =>
          s.ingredientId === ingredientId
            ? { ...s, available: newAvailable, availableLabel: newAvailableLabel }
            : s
        )
      )
      const pieceText = ppp && ppp > 1 ? ` → ${updatedItem.open_pieces || 0} ready to use` : ''
      toast.success(`Opened 1 pack of ${ingredientName}${pieceText}`)
    } catch (err) {
      toast.error(err?.message || `Failed to open pack of ${ingredientName}`)
    } finally {
      setOpening((prev) => ({ ...prev, [ingredientId]: false }))
    }
  }

  const allResolved = shortages.every((s) => s.available >= s.needed)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-amber-50">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">Cannot Place Order</h3>
            <p className="text-sm text-gray-500">Not enough stock for this order</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto p-1.5 rounded-lg hover:bg-amber-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortage list */}
        <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {shortages.map((s) => {
            const resolved = s.available >= s.needed
            return (
              <div
                key={s.ingredientId}
                className={`rounded-lg border p-3 transition-colors ${
                  resolved ? 'bg-green-50 border-green-200' : 'bg-red-50/50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {resolved ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Package className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-semibold text-gray-900 text-sm">{s.ingredientName}</span>
                  </div>
                  {resolved && (
                    <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Resolved
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    Need: <strong>{s.needed} {s.availableLabel ? 'pcs' : s.unit}</strong> — Have:{' '}
                    <strong className={resolved ? 'text-green-700' : 'text-red-600'}>
                      {s.availableLabel || `${s.available} ${s.unit}`}
                    </strong>
                  </p>
                  {!resolved && (
                    <button
                      type="button"
                      onClick={() => handleOpenPack(s)}
                      disabled={opening[s.ingredientId]}
                      className="ml-3 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-green-300 text-green-700 bg-white hover:bg-green-50 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {opening[s.ingredientId] ? (
                        <span className="w-3 h-3 border-2 border-green-300 border-t-green-700 rounded-full animate-spin" />
                      ) : (
                        <span className="text-sm leading-none">+</span>
                      )}
                      Open Pack
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hint + actions */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-[11px] text-gray-400 mb-3">
            Stock will update immediately. Please notify admin of pack usage.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRetry}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white transition-colors ${
                allResolved
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-[#B01010] hover:bg-[#8e0d0d]'
              }`}
            >
              {allResolved ? 'Place Order' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

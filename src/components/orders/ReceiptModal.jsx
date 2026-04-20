import { useEffect } from 'react'
import { format } from 'date-fns'
import { X, Printer } from 'lucide-react'
import { getMenuItemIcon } from '@/utils/menuItemIcons'
import { getPaymentLabel } from '@/utils'

export default function ReceiptModal({ order, onClose }) {
  useEffect(() => {
    if (!order) return
    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [order, onClose])

  if (!order) return null

  const createdAt = order.created_at || order.createdAt
  const tenderedAmount = Number(order.amount_tendered)
  const changeAmount = Number(order.change_amount)
  const hasTendered = Number.isFinite(tenderedAmount)
  const hasChange = Number.isFinite(changeAmount)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-md mx-4 max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          <div className="flex justify-end mb-2">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100" type="button">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div id="receipt" className="text-center font-mono text-sm">
            <h2 className="text-lg font-bold mb-2">Chelsy's Burger</h2>
            <p className="mb-2">Order Receipt</p>
            <p className="mb-1">Order: {order.order_number}</p>
            <p className="mb-1">
              {createdAt ? format(new Date(createdAt), 'MMMM d, yyyy — h:mm a') : order.order_date}
            </p>
            <p className="mb-4">Served by: {order.cashier_name}</p>

            <div className="border-t border-b py-2 mb-2">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex justify-between mb-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-sm">{getMenuItemIcon(item)}</span>
                    <span>{item.menu_item_name} x{item.quantity}</span>
                  </span>
                  <span>₱{(item.subtotal || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 mb-4">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>₱{(order.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{getPaymentLabel(order.payment_method)}</span>
              </div>
              {order.payment_method === 'cash' && hasTendered && (
                <div className="flex justify-between">
                  <span>Tendered:</span>
                  <span>₱{tenderedAmount.toFixed(2)}</span>
                </div>
              )}
              {order.payment_method === 'cash' && hasChange && (
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>₱{changeAmount.toFixed(2)}</span>
                </div>
              )}
              {order.payment_method === 'gcash' && (
                <div className="flex justify-between">
                  <span>Reference #:</span>
                  <span>{order.gcash_reference || '-'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              type="button"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded"
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Reusable delete confirmation modal with permanent-loss warning.
 *
 * Props:
 *   title      – modal heading (e.g. "Delete Menu Item")
 *   message    – what's being deleted (JSX ok)
 *   onConfirm  – called when user clicks Delete
 *   onCancel   – called when user clicks Cancel
 */
export default function DeleteConfirmModal({ title, message, onConfirm, onCancel }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        onCancel?.()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-sm mx-4 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">{title || 'Confirm Delete'}</h3>
              <p className="text-sm text-gray-600 mt-1">{message}</p>
            </div>
          </div>
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>This action is permanent.</strong> Deleted data cannot be recovered unless you restore from a backup file in Settings.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end px-5 pb-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

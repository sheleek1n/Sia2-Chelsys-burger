import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCashierStore } from '@/lib/useCashierStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function DisplayNameEntry() {
  const navigate = useNavigate()
  const { username, setCashierName } = useCashierStore()
  
  // Pre-fill with username, but allow changes
  const [displayName, setDisplayName] = useState(username || '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!username) {
      navigate('/cashier-entry', { replace: true })
    }
  }, [username, navigate])

  if (!username) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('Please enter cashier name.')
      return
    }
    setCashierName(trimmed)
    navigate('/CashierPOS', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c1810] mb-2">Enter Cashier Name</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Input
              autoFocus
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => { 
                setDisplayName(e.target.value)
                if (error) setError('')
              }}
              placeholder="Enter cashier name"
              className="h-14 text-center text-lg bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
              autoComplete="off"
            />
            {error && (
              <p className="text-sm font-medium text-red-600 text-center">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-semibold bg-[#B01010] hover:bg-[#8A0C0C] text-white rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Start Shift
          </Button>
        </form>

      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCashierStore } from '@/lib/useCashierStore'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'

export default function CashierEntry() {
  const [view, setView]         = useState('cashier') // 'cashier' | 'admin'
  const [name, setName]         = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const { setCashierName } = useCashierStore()
  const { login } = useAuth()
  const navigate = useNavigate()

  const today = format(new Date(), 'EEEE, MMMM d')

  // ── Cashier submit ──────────────────────────────────────────────
  const handleCashierSubmit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name to continue.')
      return
    }
    setCashierName(trimmed)
    navigate('/', { replace: true })
  }

  // ── Admin submit ────────────────────────────────────────────────
  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  // ── Switch to admin view ────────────────────────────────────────
  const showAdmin = () => {
    setView('admin')
    setError('')
    setUsername('')
    setPassword('')
  }

  const backToPOS = () => {
    setView('cashier')
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-8">

        {/* ── Shared header ── */}
        <div className="flex flex-col items-center">
          <img src="/chelsys-burger-logo.png" alt="Chelsy's Burger" className="h-24 w-24 object-contain mb-4" />
          {view === 'cashier' ? (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#2c1810]">Chelsy's Burger</h1>
              <p className="text-muted-foreground font-medium mt-1">{today}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#2c1810]">Admin Login</h1>
              <p className="text-muted-foreground text-sm mt-1">Chelsy's Burger Management</p>
            </>
          )}
        </div>

        {/* ── Cashier form ── */}
        {view === 'cashier' && (
          <form onSubmit={handleCashierSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                autoFocus
                id="cashierName"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError('') }}
                placeholder="Enter your name to start..."
                className="mt-1 h-14 text-center text-lg bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
                autoComplete="off"
              />
              {error && <p className="text-sm font-medium text-red-600 text-center">{error}</p>}
            </div>
            <Button
              type="submit"
              className="w-full h-14 text-lg font-semibold bg-[#B01010] hover:bg-[#8A0C0C] text-white rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Start Shift
            </Button>

            {/* Subtle admin access link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={showAdmin}
                className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
              >
                Admin Access
              </button>
            </div>
          </form>
        )}

        {/* ── Admin login form ── */}
        {view === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-3">
              <Input
                autoFocus
                id="adminUsername"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) setError('') }}
                placeholder="Username"
                className="h-12 bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
                autoComplete="username"
              />
              <Input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                placeholder="Password"
                className="h-12 bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
                autoComplete="current-password"
              />
              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 font-semibold bg-[#B01010] hover:bg-[#8A0C0C] text-white rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60"
            >
              {loading ? 'Logging in…' : 'Log In'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={backToPOS}
                className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
              >
                ← Back to POS
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

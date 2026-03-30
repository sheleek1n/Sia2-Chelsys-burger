import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCashierStore } from '@/lib/useCashierStore'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'

export default function CashierEntry() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const { setCashierSession } = useCashierStore()

  const today = format(new Date(), 'EEEE, MMMM d')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const user = await login(username.trim(), password)
      
      if (user.role === 'cashier') {
        // Store cashier username and route to name entry
        setCashierSession(user.username, user.username)
        navigate('/display-name-entry', { replace: true })
      } else if (user.role === 'admin') {
        // Admin goes straight to dashboard
        navigate('/Dashboard', { replace: true })
      }
    } catch (_err) {
      setError('Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center">
          <img 
            src="/chelsys-burger-logo.png" 
            alt="Chelsy's Burger" 
            className="h-24 w-24 object-contain mb-4" 
          />
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c1810]">
            Chelsy's Burger
          </h1>
          <p className="text-muted-foreground font-medium mt-1">{today}</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Input
              autoFocus
              id="username"
              type="text"
              value={username}
              onChange={(e) => { 
                setUsername(e.target.value)
                if (error) setError('')
              }}
              placeholder="Username"
              className="h-12 bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
              autoComplete="username"
            />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { 
                setPassword(e.target.value)
                if (error) setError('')
              }}
              placeholder="Password"
              className="h-12 bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]"
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm font-medium text-red-600 text-center">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 font-semibold bg-[#B01010] hover:bg-[#8A0C0C] text-white rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60"
          >
            {loading ? 'Logging in…' : 'Log In'}
          </Button>
        </form>

      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-8">
        
        {/* Header styling specifically to match Chelsy's Brand */}
        <div className="flex flex-col items-center">
          <img src="/chelsys-burger-logo.png" alt="Chelsy's Burger" className="h-24 w-24 object-contain mb-4" />
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c1810]">Chelsy's Burger</h1>
          <p className="text-muted-foreground font-medium mt-1">{today}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">Username</Label>
            <Input 
              id="username" 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Enter username" 
              className="mt-1 h-14 text-center text-lg bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]" 
              autoComplete="username" 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter password" 
              className="mt-1 h-14 text-center text-lg bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010]" 
              autoComplete="current-password" 
              required 
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600 text-center">{error}</p>}
          <Button 
            type="submit" 
            className="w-full h-14 text-lg font-semibold bg-[#B01010] hover:bg-[#8A0C0C] text-white rounded-xl transition-all shadow-md hover:shadow-lg"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'LOG IN'}
          </Button>
        </form>
        
        <div className="text-center">
          <button 
            type="button"
            onClick={() => navigate('/cashier-entry')}
            className="text-sm text-muted-foreground hover:text-primary underline"
          >
            Back to POS
          </button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">Default: admin / admin123</p>
      </div>
    </div>
  )
}

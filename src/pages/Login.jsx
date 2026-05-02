import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { Eye, EyeOff } from 'lucide-react'
import logoUrl from '@/assets/chelsys-burger-logo.png'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
          <img src={logoUrl} alt="Chelsy's Burger" className="h-24 w-24 object-contain mb-4" />
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
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-14 text-center text-lg bg-slate-50 border-slate-200 focus:border-[#B01010] focus:ring-[#B01010] pr-12"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
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
        
      </div>
    </div>
  )
}

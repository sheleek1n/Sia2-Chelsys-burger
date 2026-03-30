import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '@/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.auth
      .getUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = (username, password) =>
    api.auth.login(username, password).then((u) => {
      // Only admin should live in persistent auth context.
      setUser(u.role === 'admin' ? u : null)
      return u
    })

  const logout = () =>
    api.auth.logout().then(() => setUser(null))

  const setCashierSession = (username) => {
    // Cashier session doesn't persist — just kept in context
    const session = { username, role: 'cashier' }
    return Promise.resolve(session)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, setCashierSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

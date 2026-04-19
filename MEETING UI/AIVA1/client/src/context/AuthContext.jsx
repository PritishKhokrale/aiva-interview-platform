import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const email = localStorage.getItem('aiva_user_email')
    if (email) {
      fetch(`/api/auth/me?email=${encodeURIComponent(email)}`)
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u && u.email) setUser(u)
          else localStorage.removeItem('aiva_user_email')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const saveUser = (u) => {
    if (u && u.email) {
      localStorage.setItem('aiva_user_email', u.email)
      setUser(u)
    } else {
      localStorage.removeItem('aiva_user_email')
      setUser(null)
    }
  }

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    saveUser(data)
    return data
  }, [])

  const register = useCallback(async (email, name, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    saveUser(data)
    return data
  }, [])

  const googleLogin = useCallback(async (credential) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    saveUser(data)
    return data
  }, [])

  const logout = useCallback(() => {
    saveUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

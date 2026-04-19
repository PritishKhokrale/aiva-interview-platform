import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState({ name: 'Local User', email: 'user@localhost', id: 1 })
  const [loading, setLoading] = useState(false)

  // Auth is completely bypassed.
  useEffect(() => {
    // No-op
  }, [])

  const saveUser = (u) => setUser(u)

  const login = useCallback(async (email, password) => {
    return { name: 'Local User', email: 'user@localhost', id: 1 }
  }, [])

  const register = useCallback(async (email, name, password) => {
    return { name: 'Local User', email: 'user@localhost', id: 1 }
  }, [])

  const googleLogin = useCallback(async (credential) => {
    return { name: 'Local User', email: 'user@localhost', id: 1 }
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

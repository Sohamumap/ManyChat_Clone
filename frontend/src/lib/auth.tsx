import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api } from '../api'
import type { User } from '../types'

interface AuthState {
  /** undefined while the initial /api/auth/me check is running */
  user: User | null | undefined
  /** Set when /api/auth/me failed for a reason other than 401 (backend down...). */
  error: string | null
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  recheck: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const recheck = useCallback(async () => {
    try {
      setUser(await api.auth.me())
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        setError(null)
      } else {
        setUser(null)
        setError(err instanceof Error ? err.message : 'Could not reach the server')
      }
    }
  }, [])

  useEffect(() => {
    void recheck()
  }, [recheck])

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.auth.login(email, password)
    setUser(u)
    setError(null)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, error, login, logout, recheck }), [user, error, login, logout, recheck])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, errorMessage } from '../api'
import type { Account } from '../types'
import { storage } from './utils'

const STORAGE_KEY = 'flowdm.selectedAccountId'

interface AccountsState {
  accounts: Account[]
  /** The selected Instagram account (null when none is connected). */
  account: Account | null
  accountId: number | null
  loading: boolean
  error: string | null
  select: (id: number) => void
  reload: () => Promise<Account[]>
  /** Replace one account in the list after an action returned the updated record. */
  upsert: (account: Account) => void
}

const AccountsContext = createContext<AccountsState | null>(null)

function readStoredId(): number | null {
  const raw = storage.get(STORAGE_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : null
}

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(readStoredId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const list = await api.accounts.list()
      setAccounts(list)
      setError(null)
      return list
    } catch (err) {
      setError(errorMessage(err))
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const select = useCallback((id: number) => {
    setSelectedId(id)
    storage.set(STORAGE_KEY, String(id))
  }, [])

  const upsert = useCallback((account: Account) => {
    setAccounts((list) => {
      const i = list.findIndex((a) => a.id === account.id)
      if (i === -1) return [...list, account]
      const next = [...list]
      next[i] = account
      return next
    })
  }, [])

  // Fall back to the first account when the stored one is gone (or nothing was stored).
  const account = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null,
    [accounts, selectedId],
  )

  const value = useMemo<AccountsState>(
    () => ({ accounts, account, accountId: account?.id ?? null, loading, error, select, reload, upsert }),
    [accounts, account, loading, error, select, reload, upsert],
  )
  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
}

export function useAccounts(): AccountsState {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts must be used inside <AccountsProvider>')
  return ctx
}

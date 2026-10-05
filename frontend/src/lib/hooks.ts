import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react'
import { errorMessage } from '../api'

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return debounced
}

export interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  /** Re-run the loader. `silent` keeps the current data on screen without a spinner. */
  reload: (silent?: boolean) => Promise<void>
  setData: Dispatch<SetStateAction<T | undefined>>
}

export interface AsyncOptions {
  /** Skip loading while false (e.g. no account selected yet). */
  enabled?: boolean
  /** Keep showing the previous data while new deps load (search, pagination). */
  keepPrevious?: boolean
}

/** Load data when `deps` change. Stale responses (from a previous deps value) are ignored. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  { enabled = true, keepPrevious = false }: AsyncOptions = {},
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const seq = useRef(0)

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current
    if (!silent) setLoading(true)
    try {
      const result = await loaderRef.current()
      if (id !== seq.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (id !== seq.current) return
      setError(errorMessage(err))
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      seq.current++
      setLoading(false)
      return
    }
    if (!keepPrevious) setData(undefined)
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  return { data, error, loading, reload: run, setData }
}

/** Call `fn` every `ms` while `active`. */
export function useInterval(fn: () => void, ms: number, active: boolean) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => ref.current(), ms)
    return () => window.clearInterval(t)
  }, [ms, active])
}

/** Re-render periodically so relative times ("3m ago") stay fresh. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useInterval(() => setNow(new Date()), ms, true)
  return now
}

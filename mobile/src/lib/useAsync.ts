import { useCallback, useEffect, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setData(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      if (!silent) setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run()
  }, [run])

  const reload = useCallback(() => run(false), [run])
  const refresh = useCallback(() => run(true), [run])

  return { data, error, loading, reload, refresh }
}

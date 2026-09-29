'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ProductSearch({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial)
  const router = useRouter()

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        router.push(`/productos?${params.toString()}`)
      }}
      className="flex gap-2"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
      <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
        Buscar
      </button>
    </form>
  )
}

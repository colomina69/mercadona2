'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function FuelFilters({
  initial,
}: {
  initial: { q?: string; fuel?: string; from?: string; to?: string; fuels?: string[]; year?: string }
}) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [fuel, setFuel] = useState(initial.fuel ?? '')
  const [from, setFrom] = useState(initial.from ?? '')
  const [to, setTo] = useState(initial.to ?? '')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (initial.year) params.set('year', initial.year)
    if (q.trim()) params.set('q', q.trim())
    if (fuel) params.set('fuel', fuel)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    router.push(`/combustible?${params.toString()}`)
  }

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100'

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar (estación / localidad / ticket)</label>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. GLEM, COCENTAINA" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Carburante</label>
          <select className={input} value={fuel} onChange={(e) => setFuel(e.target.value)}>
            <option value="">Todos</option>
            {(initial.fuels ?? []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => router.push('/combustible')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CategoryOption = { id: string; name: string; kind: 'expense' | 'income' }

type Initial = {
  q?: string
  from?: string
  to?: string
  category?: string
  min?: string
  max?: string
}

export function BankFilters({ initial, categories }: { initial: Initial; categories: CategoryOption[] }) {
  const router = useRouter()
  const [q, setQ] = useState(initial.q ?? '')
  const [from, setFrom] = useState(initial.from ?? '')
  const [to, setTo] = useState(initial.to ?? '')
  const [category, setCategory] = useState(initial.category ?? '')
  const [min, setMin] = useState(initial.min ?? '')
  const [max, setMax] = useState(initial.max ?? '')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (category) params.set('category', category)
    if (min) params.set('min', min)
    if (max) params.set('max', max)
    router.push(`/movimientos?${params.toString()}`)
  }

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  const expenses = categories.filter((c) => c.kind === 'expense')
  const incomes = categories.filter((c) => c.kind === 'income')

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Buscar (concepto / referencia)</label>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. MERCADONA" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            <option value="none">Sin categoría</option>
            {expenses.length > 0 && (
              <optgroup label="Gastos">
                {expenses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {incomes.length > 0 && (
              <optgroup label="Ingresos">
                {incomes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Importe mín. (€)</label>
            <input type="number" step="0.01" className={input} value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Importe máx. (€)</label>
            <input type="number" step="0.01" className={input} value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => router.push('/movimientos')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

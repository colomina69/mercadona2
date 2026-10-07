'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ContractOption = { id: string; label: string; contract_number: string }

export function InvoiceFilters({
  contracts,
  initial,
}: {
  contracts: ContractOption[]
  initial: { contract?: string; q?: string; from?: string; to?: string; year?: string }
}) {
  const router = useRouter()
  const [contract, setContract] = useState(initial.contract ?? '')
  const [q, setQ] = useState(initial.q ?? '')
  const [from, setFrom] = useState(initial.from ?? '')
  const [to, setTo] = useState(initial.to ?? '')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (initial.year) params.set('year', initial.year)
    if (contract) params.set('contract', contract)
    if (q.trim()) params.set('q', q.trim())
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    router.push(`/facturas?${params.toString()}`)
  }

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100'

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Contrato</label>
          <select className={input} value={contract} onChange={(e) => setContract(e.target.value)}>
            <option value="">Todos</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.contract_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Nº factura</label>
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. 2124..." />
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
        <button type="submit" className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => router.push('/facturas')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
}

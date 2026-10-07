'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'
import { dateOnly, eur } from '@/lib/format'

export type ClassifierMovement = {
  id: string
  operation_date: string | null
  description: string | null
  concept: string | null
  amount: number | null
  category_id: string | null
}

type Sug = {
  type: 'ticket' | 'invoice' | 'waylet'
  id: string
  label: string
  sub: string
  amount: number | null
  linked: boolean
}

type LinkedItem = { id: string; target_type: string; target_id: string; label: string }

export function Classifier({
  movements,
  categories,
}: {
  movements: ClassifierMovement[]
  categories: BankCategory[]
}) {
  const db = getInsforgeBrowser().database
  const [rows, setRows] = useState(movements)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCat, setBulkCat] = useState('')
  const [onlyUncategorized, setOnlyUncategorized] = useState(true)
  const [year, setYear] = useState<string>('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, { linked: LinkedItem[]; sugs: Sug[] }>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const years = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.operation_date) set.add(String(r.operation_date).slice(0, 4))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [rows])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyUncategorized && r.category_id) return false
      if (year && String(r.operation_date ?? '').slice(0, 4) !== year) return false
      if (term) {
        const hay = `${r.concept ?? ''} ${r.description ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [rows, onlyUncategorized, year, q])

  const expenses = categories.filter((c) => c.kind === 'expense')
  const incomes = categories.filter((c) => c.kind === 'income')

  function CategorySelect({
    value,
    onChange,
    disabled,
  }: {
    value: string | null
    onChange: (v: string | null) => void
    disabled?: boolean
  }) {
    return (
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
      >
        <option value="">Sin categoría</option>
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
    )
  }

  async function assign(id: string, categoryId: string | null) {
    setError(null)
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, category_id: categoryId } : r)))
    const { error: err } = await db.from('bank_transactions').update({ category_id: categoryId }).eq('id', id)
    if (err) setError(err.message)
  }

  async function assignBulk(categoryId: string | null) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setBusy(true)
    setError(null)
    const { error: err } = await db.from('bank_transactions').update({ category_id: categoryId }).in('id', ids)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    const set = new Set(ids)
    setRows((rs) => rs.map((r) => (set.has(r.id) ? { ...r, category_id: categoryId } : r)))
    setSelected(new Set())
  }

  async function loadDetail(rowId: string) {
    setLoadingDetail(rowId)
    try {
      const [linksRes, tRes, iRes, wRes] = await Promise.all([
        db.from('bank_transaction_links').select('id, target_type, target_id').eq('transaction_id', rowId),
        db.rpc('bank_match_tickets', { p_transaction_id: rowId }),
        db.rpc('bank_match_invoices', { p_transaction_id: rowId }),
        db.rpc('bank_match_waylet', { p_transaction_id: rowId }),
      ])
            const links = (linksRes.data ?? []) as any[]
      const linked: LinkedItem[] = await Promise.all(
                links.map(async (l: any) => {
          if (l.target_type === 'ticket') {
            const { data } = await db.from('mercadona_tickets').select('store_name').eq('id', l.target_id).maybeSingle()
            return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.store_name ?? 'Ticket') }
          }
          if (l.target_type === 'invoice') {
            const { data } = await db.from('iberdrola_invoices').select('invoice_number').eq('id', l.target_id).maybeSingle()
            return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.invoice_number ?? 'Factura') }
          }
          const { data } = await db.from('waylet_tickets').select('station_name').eq('id', l.target_id).maybeSingle()
          return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.station_name ?? 'Repostaje') }
        }),
      )
      const linkedIds = new Set(links.map((l) => String(l.target_id)))
      const sugs: Sug[] = []
            for (const t of (tRes.data ?? []) as any[])
        sugs.push({ type: 'ticket', id: String(t.id), label: String(t.store_name ?? 'Ticket'), sub: `${dateOnly(t.purchased_at)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })
            for (const t of (iRes.data ?? []) as any[])
        sugs.push({ type: 'invoice', id: String(t.id), label: `Factura ${t.invoice_number ?? ''}`, sub: `${dateOnly(t.issue_date)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })
            for (const t of (wRes.data ?? []) as any[])
        sugs.push({ type: 'waylet', id: String(t.id), label: String(t.station_name ?? 'Repostaje'), sub: `${dateOnly(t.purchased_at)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })
      setDetails((d) => ({ ...d, [rowId]: { linked, sugs } }))
    } finally {
      setLoadingDetail(null)
    }
  }

  async function toggle(rowId: string) {
    if (open === rowId) {
      setOpen(null)
      return
    }
    setOpen(rowId)
    if (!details[rowId]) await loadDetail(rowId)
  }

  async function doLink(rowId: string, type: Sug['type'], targetId: string) {
    setError(null)
    const { error: err } = await db
      .from('bank_transaction_links')
      .insert([{ transaction_id: rowId, target_type: type, target_id: targetId }])
    if (err) {
      setError(err.message)
      return
    }
    await loadDetail(rowId)
  }

  async function unlinkRow(rowId: string, linkId: string) {
    setError(null)
    const { error: err } = await db.from('bank_transaction_links').delete().eq('id', linkId)
    if (err) {
      setError(err.message)
      return
    }
    await loadDetail(rowId)
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setYear('')}
            className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-medium ${year === '' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Todos
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-medium ${year === y ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {y}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyUncategorized} onChange={(e) => setOnlyUncategorized(e.target.checked)} />
            Solo sin categoría
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-h-[40px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar concepto / descripción…"
          />
          <span className="text-xs text-slate-400">
            {filtered.length} movimientos
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
            <span className="text-sm font-medium text-emerald-800">{selected.size} seleccionados</span>
            <CategorySelect value={bulkCat || null} onChange={(v) => setBulkCat(v ?? '')} disabled={busy} />
            <button
              type="button"
              disabled={busy}
              onClick={() => assignBulk(bulkCat || null)}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              Asignar
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-slate-500 hover:underline">
              Quitar selección
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            {onlyUncategorized ? 'No quedan movimientos sin categoría. 🎉' : 'Sin movimientos.'}
          </p>
        )}
        {filtered.map((r) => {
          const cat = r.category_id ? catById.get(r.category_id) : null
          const isOpen = open === r.id
          const detail = details[r.id]
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  aria-label="Seleccionar"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{r.concept?.trim() || r.description || '—'}</p>
                  <p className="text-xs text-slate-400">
                    {dateOnly(r.operation_date)}
                    {cat ? ` · ${cat.name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${(r.amount ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {eur(r.amount)}
                </span>
                <CategorySelect value={r.category_id} onChange={(v) => assign(r.id, v)} />
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  🔗 {isOpen ? 'Ocultar' : 'Vincular'}
                </button>
                <Link href={`/movimientos/${r.id}`} className="text-xs text-slate-400 hover:underline">
                  Editar
                </Link>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 p-3">
                  {loadingDetail === r.id ? (
                    <p className="text-sm text-slate-400">Buscando tickets y facturas…</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vinculados</h4>
                        {!detail || detail.linked.length === 0 ? (
                          <p className="text-sm text-slate-400">Sin vínculos.</p>
                        ) : (
                          <ul className="divide-y divide-slate-100">
                            {detail.linked.map((l) => (
                              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                                <span className="text-slate-700">
                                  <span className="mr-1 text-xs uppercase text-slate-400">{l.target_type}</span>
                                  {l.label}
                                </span>
                                <button type="button" onClick={() => unlinkRow(r.id, l.id)} className="text-xs text-slate-400 hover:text-red-600">
                                  Desvincular
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Tickets/facturas archivadas sugeridas
                        </h4>
                        {!detail || detail.sugs.length === 0 ? (
                          <p className="text-sm text-slate-400">Sin coincidencias automáticas (±3 días, mismo importe).</p>
                        ) : (
                          <ul className="divide-y divide-slate-100">
                            {detail.sugs.map((s) => (
                              <li key={`${s.type}-${s.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate text-slate-700">
                                    <span className="mr-1 text-xs uppercase text-slate-400">{s.type}</span>
                                    {s.label}
                                  </p>
                                  <p className="text-xs text-slate-400">{s.sub} · {eur(s.amount)}</p>
                                </div>
                                {s.linked ? (
                                  <span className="shrink-0 text-xs text-emerald-600">vinculado</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => doLink(r.id, s.type, s.id)}
                                    className="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    Vincular
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { LinkedTicket, TicketCandidate } from '@/lib/types'
import { eur, dateTime } from '@/lib/format'

function sameAmountClass(a: number | null, b: number | null) {
  return a != null && b != null && Math.abs(a - Math.abs(b)) <= 0.02 ? 'text-emerald-700' : 'text-slate-500'
}

export function TicketLinker({
  transactionId,
  amount,
  suggestions,
  linkedTickets,
  linkedByTicketId,
}: {
  transactionId: string
  amount: number | null
  suggestions: TicketCandidate[]
  linkedTickets: LinkedTicket[]
  linkedByTicketId: Record<string, string>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TicketCandidate[] | null>(null)

  async function link(ticketId: string) {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_transaction_links')
      .insert([{ transaction_id: transactionId, target_type: 'ticket', target_id: ticketId }])
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    router.refresh()
  }

  async function unlink(linkId: string) {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser().database.from('bank_transaction_links').delete().eq('id', linkId)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    router.refresh()
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    const term = q.replace(/[,()%*]/g, ' ').trim()
    setBusy(true)
    setError(null)
    let query: any = getInsforgeBrowser()
      .database.from('mercadona_tickets')
      .select('id, ticket_number, purchased_at, store_name, store_city, total')
    if (term) query = query.or(`store_name.ilike.%${term}%,store_city.ilike.%${term}%,ticket_number.ilike.%${term}%`)
    const { data, error: err } = await query.order('purchased_at', { ascending: false }).limit(15)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setResults((data ?? []) as TicketCandidate[])
  }

  const linkedIds = new Set(Object.keys(linkedByTicketId))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Tickets vinculados</h2>
        {linkedTickets.length === 0 ? (
          <p className="text-sm text-slate-400">Sin tickets vinculados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1">Fecha</th>
                <th className="py-1">Tienda</th>
                <th className="py-1 text-right">Total</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linkedTickets.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 whitespace-nowrap">{dateTime(t.purchased_at)}</td>
                  <td className="py-2">
                    <Link href={`/tickets/${t.id}`} className="text-emerald-700 hover:underline">
                      {t.store_name ?? 'Ticket'}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">{t.store_city ?? ''}</span>
                  </td>
                  <td className={`py-2 text-right font-medium ${sameAmountClass(t.total, amount)}`}>{eur(t.total)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unlink(linkedByTicketId[t.id])}
                      className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Desvincular
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Sugerencias automáticas</h2>
        <p className="mb-3 text-xs text-slate-400">
          Tickets con el mismo importe ({eur(amount)}) y fecha cercana (±3 días).
        </p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">Sin coincidencias automáticas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {suggestions.map((s) => {
              const already = linkedIds.has(s.id) || s.linked
              return (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <Link href={`/tickets/${s.id}`} className="text-slate-800 hover:text-emerald-700 hover:underline">
                      {s.store_name ?? 'Ticket'}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">
                      {dateTime(s.purchased_at)} · ±{s.date_diff}d
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{eur(s.total)}</span>
                    {already ? (
                      <span className="text-xs text-emerald-600">vinculado</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => link(s.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Vincular
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Buscar ticket</h2>
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tienda, ciudad o nº de ticket…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Buscar
          </button>
        </form>

        {results && (
          <ul className="mt-3 divide-y divide-slate-100">
            {results.length === 0 && <li className="py-2 text-sm text-slate-400">Sin resultados.</li>}
            {results.map((s) => {
              const already = linkedIds.has(s.id)
              return (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <Link href={`/tickets/${s.id}`} className="text-slate-800 hover:text-emerald-700 hover:underline">
                      {s.store_name ?? 'Ticket'}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">
                      {dateTime(s.purchased_at)} · {s.ticket_number ?? ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{eur(s.total)}</span>
                    {already ? (
                      <span className="text-xs text-emerald-600">vinculado</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => link(s.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Vincular
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

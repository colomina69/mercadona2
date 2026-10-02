'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { WayletCandidate, WayletTicket } from '@/lib/types'
import { eur, dateTime, liters, eurPerL } from '@/lib/format'

export function FuelLinker({
  transactionId,
  amount,
  suggestions,
  linkedTickets,
  linkedById,
}: {
  transactionId: string
  amount: number | null
  suggestions: WayletCandidate[]
  linkedTickets: WayletTicket[]
  linkedById: Record<string, string>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function link(ticketId: string) {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_transaction_links')
      .insert([{ transaction_id: transactionId, target_type: 'waylet', target_id: ticketId }])
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

  const linkedIds = new Set(Object.keys(linkedById))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Repostajes vinculados</h2>
        {linkedTickets.length === 0 ? (
          <p className="text-sm text-slate-400">Sin repostajes vinculados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1">Fecha</th>
                <th className="py-1">Estación</th>
                <th className="py-1 text-right">Litros</th>
                <th className="py-1 text-right">€/L</th>
                <th className="py-1 text-right">Total</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linkedTickets.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 whitespace-nowrap">{dateTime(t.purchased_at)}</td>
                  <td className="py-2">
                    <Link href={`/combustible/${t.id}`} className="text-orange-700 hover:underline">
                      {t.station_name ?? 'Repsol'}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">{t.locality ?? ''}</span>
                  </td>
                  <td className="py-2 text-right text-slate-500">{liters(t.liters)}</td>
                  <td className="py-2 text-right text-slate-500">{eurPerL(t.unit_price)}</td>
                  <td className="py-2 text-right font-medium">{eur(t.total)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unlink(linkedById[t.id])}
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
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Sugerencias de repostajes</h2>
        <p className="mb-3 text-xs text-slate-400">
          Tickets Waylet con el mismo importe ({eur(amount)}) y fecha cercana (±7 días).
        </p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-400">Sin coincidencias.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {suggestions.map((s) => {
              const already = linkedIds.has(s.id) || s.linked
              return (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <Link href={`/combustible/${s.id}`} className="text-slate-800 hover:text-orange-700 hover:underline">
                      {s.station_name ?? 'Repsol'} · {s.fuel_type ?? ''}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">
                      {dateTime(s.purchased_at)} · ±{s.date_diff}d · {liters(s.liters)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{eur(s.total)}</span>
                    {already ? (
                      <span className="text-xs text-orange-600">vinculado</span>
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

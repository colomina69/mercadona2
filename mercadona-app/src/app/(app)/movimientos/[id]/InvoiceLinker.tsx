'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { IberdrolaInvoice, InvoiceCandidate } from '@/lib/types'
import { eur, dateOnly, kwh } from '@/lib/format'

export function InvoiceLinker({
  transactionId,
  amount,
  suggestions,
  linkedInvoices,
  linkedByInvoiceId,
}: {
  transactionId: string
  amount: number | null
  suggestions: InvoiceCandidate[]
  linkedInvoices: IberdrolaInvoice[]
  linkedByInvoiceId: Record<string, string>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function link(invoiceId: string) {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_transaction_links')
      .insert([{ transaction_id: transactionId, target_type: 'invoice', target_id: invoiceId }])
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

  const linkedIds = new Set(Object.keys(linkedByInvoiceId))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Facturas vinculadas</h2>
        {linkedInvoices.length === 0 ? (
          <p className="text-sm text-slate-400">Sin facturas vinculadas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1">Emisión</th>
                <th className="py-1">Factura</th>
                <th className="py-1 text-right">Consumo</th>
                <th className="py-1 text-right">Total</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linkedInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2 whitespace-nowrap">{dateOnly(inv.issue_date)}</td>
                  <td className="py-2">
                    <Link href={`/facturas/${inv.id}`} className="text-sky-700 hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-slate-500">{kwh(inv.consumption_kwh)}</td>
                  <td className="py-2 text-right font-medium">{eur(inv.total)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unlink(linkedByInvoiceId[inv.id])}
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
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Sugerencias de facturas</h2>
        <p className="mb-3 text-xs text-slate-400">
          Facturas Iberdrola con el mismo importe ({eur(amount)}) y fecha cercana (±7 días).
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
                    <Link href={`/facturas/${s.id}`} className="text-slate-800 hover:text-sky-700 hover:underline">
                      {s.invoice_number}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">
                      {dateOnly(s.issue_date)} · ±{s.date_diff}d · {kwh(s.consumption_kwh)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{eur(s.total)}</span>
                    {already ? (
                      <span className="text-xs text-sky-600">vinculada</span>
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

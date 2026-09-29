import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { Ticket, TicketItem } from '@/lib/types'
import { eur, num, dateTime, pricePer } from '@/lib/format'
import { PdfButton } from '@/components/PdfButton'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: ticketData } = await insforge.database
    .from('mercadona_tickets')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  const ticket = (ticketData ?? null) as Ticket | null
  if (!ticket) notFound()

  const { data: itemsData } = await insforge.database
    .from('mercadona_ticket_items')
    .select('*')
    .eq('ticket_id', params.id)
    .order('line_no', { ascending: true })

  const items = (itemsData ?? []) as TicketItem[]

  return (
    <div className="space-y-4">
      <Link href="/tickets" className="text-sm text-emerald-700 hover:underline">
        ← Volver a tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{ticket.store_name ?? 'Ticket'}</h1>
          <p className="text-sm text-slate-500">
            {ticket.store_address}
            {ticket.store_city ? ` · ${ticket.store_postal_code ?? ''} ${ticket.store_city}`.trim() : ''}
          </p>
          <p className="text-sm text-slate-500">{dateTime(ticket.purchased_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="text-3xl font-bold text-emerald-700">{eur(ticket.total)}</span>
          {ticket.pdf_key && <PdfButton pdfKey={ticket.pdf_key} />}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Nº ticket" value={ticket.ticket_number ?? '—'} />
          <Field label="Nº artículos" value={ticket.item_count ?? '—'} />
          <Field label="Forma de pago" value={ticket.payment_method ?? '—'} />
          <Field label="Tarjeta" value={ticket.card_last4 ? `**** ${ticket.card_last4}` : '—'} />
          <Field label="Subtotal (base IVA)" value={eur(ticket.subtotal)} />
          <Field label="IVA total" value={eur(ticket.total != null && ticket.subtotal != null ? Number((ticket.total - ticket.subtotal).toFixed(2)) : null)} />
          <Field label="Entrada / salida" value={`${ticket.entry_time ?? '—'} / ${ticket.exit_time ?? '—'}`} />
          <Field label="N.C / AUT" value={`${ticket.nc ?? '—'} / ${ticket.auth_code ?? '—'}`} />
        </dl>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 w-8">#</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-right">Cant.</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it) => {
              const qty = it.quantity ?? 0
              const eff =
                it.unit === 'kg'
                  ? it.unit_price ?? (it.weight_kg ? (it.amount ?? 0) / it.weight_kg : null)
                  : it.unit_price ?? (qty ? (it.amount ?? 0) / qty : null)
              return (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-400">{it.line_no}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/productos/${encodeURIComponent(it.product_name ?? '')}`}
                      className="text-slate-800 hover:text-emerald-700 hover:underline"
                    >
                      {it.product_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {num(it.quantity, 3)} {it.unit === 'kg' ? 'kg' : 'ud'}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{pricePer(it.unit, eff)}</td>
                  <td className="px-4 py-2 text-right font-medium">{eur(it.amount)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-3" colSpan={4}>
                TOTAL
              </td>
              <td className="px-4 py-3 text-right">{eur(ticket.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {ticket.vat_summary && ticket.vat_summary.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Desglose de IVA</h2>
          <table className="w-full max-w-md text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1">Tipo</th>
                <th className="py-1 text-right">Base</th>
                <th className="py-1 text-right">Cuota</th>
              </tr>
            </thead>
            <tbody>
              {ticket.vat_summary.map((v, i) => (
                <tr key={i}>
                  <td className="py-1">{v.rate}%</td>
                  <td className="py-1 text-right">{eur(v.base)}</td>
                  <td className="py-1 text-right">{eur(v.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { WayletLine, WayletTicket } from '@/lib/types'
import { eur, dateTime, liters, eurPerL, fixed } from '@/lib/format'
import { PdfButton } from '@/components/PdfButton'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

export default async function CombustibleDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data } = await insforge.database.from('waylet_tickets').select('*').eq('id', params.id).maybeSingle()
  const ticket = (data ?? null) as WayletTicket | null
  if (!ticket) notFound()

  const { data: linesData } = await insforge.database
    .from('waylet_ticket_lines')
    .select('*')
    .eq('ticket_id', params.id)
    .order('line_no')
  const lines = (linesData ?? []) as WayletLine[]

  return (
    <div className="space-y-4">
      <Link href="/combustible" className="text-sm text-orange-700 hover:underline">
        ← Volver a combustible
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{ticket.station_name ?? 'Repsol'}</h1>
          <p className="text-sm text-slate-500">
            {ticket.address ?? ''}
            {ticket.postal_code ? ` · ${ticket.postal_code} ${ticket.locality ?? ''}` : ''}
          </p>
          <p className="text-sm text-slate-500">
            {dateTime(ticket.purchased_at)} · {ticket.fuel_type ?? '—'} · Ticket {ticket.ticket_number}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-3xl font-bold text-slate-800">{eur(ticket.total)}</span>
          {ticket.pdf_key && <PdfButton pdfKey={ticket.pdf_key} bucket="waylet" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Litros</p>
          <p className="mt-1 text-2xl font-semibold">{liters(ticket.liters)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Precio €/L</p>
          <p className="mt-1 text-2xl font-semibold">{eurPerL(ticket.unit_price)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Descuento</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {ticket.discount_amount != null ? `−${fixed(ticket.discount_amount, 2)} €` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Importe bruto</p>
          <p className="mt-1 text-2xl font-semibold text-slate-500">{eur(ticket.gross_amount)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Líneas</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-1">Producto</th>
              <th className="py-1 text-right">€/L</th>
              <th className="py-1 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-2">{l.product_name ?? '—'}</td>
                <td className="py-2 text-right text-slate-600">{l.unit_price != null ? eurPerL(l.unit_price) : '—'}</td>
                <td className="py-2 text-right font-medium">{eur(l.amount)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-400">
                  Sin líneas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Datos del ticket</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Estación" value={ticket.station_name ?? '—'} />
          <Field label="Localidad" value={ticket.locality ?? '—'} />
          <Field label="Fecha" value={dateTime(ticket.purchased_at)} />
          <Field label="Nº ticket" value={ticket.ticket_number} />
          <Field label="Carburante" value={ticket.fuel_type ?? '—'} />
          <Field label="Pago" value={ticket.payment_method ?? '—'} />
          <Field label="Tarjeta" value={ticket.card_last4 ? `****${ticket.card_last4}` : '—'} />
          <Field label="Vehículo" value={ticket.vehicle_plate ?? '—'} />
          <Field label="Puntos" value={ticket.points != null ? String(ticket.points) : '—'} />
          <Field label="Id Waylet" value={ticket.id} />
        </dl>
      </div>
    </div>
  )
}

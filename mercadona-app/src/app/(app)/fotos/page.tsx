import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { PhotoTicket } from '@/lib/types'
import { dateOnly, eur } from '@/lib/format'
import { TicketPhotoUploader } from '@/components/TicketPhotoUploader'

export default async function FotosPage() {
  const insforge = createInsForgeServerClient()
  const { data } = await insforge.database
    .from('photo_tickets')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(200)
  const tickets = (data ?? []) as PhotoTicket[]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Tickets por foto</h1>

      <TicketPhotoUploader />

      {tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          Aún no hay fotos de tickets.
        </p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/fotos/${t.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{t.store_name ?? 'Ticket'}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {dateOnly(t.purchased_at ?? t.captured_at)}
                    {t.ticket_number ? ` · ${t.ticket_number}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.status === 'revisado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {t.status}
                  </span>
                  <span className="font-semibold text-slate-800">{eur(t.total)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

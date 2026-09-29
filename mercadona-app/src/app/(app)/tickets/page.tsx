import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { Ticket } from '@/lib/types'
import { eur, dateTime, num } from '@/lib/format'
import { TicketFilters } from '@/components/TicketFilters'

const PAGE_SIZE = 25
const COLS = 'id, ticket_number, purchased_at, store_name, store_city, total, item_count, payment_method'

function sanitize(value: string): string {
  return value.replace(/[,()%*]/g, ' ').trim()
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { q?: string; from?: string; to?: string; store?: string; min?: string; max?: string; page?: string }
}) {
  const insforge = createInsForgeServerClient()

  const q = searchParams.q ? sanitize(searchParams.q) : ''
  const store = searchParams.store ? sanitize(searchParams.store) : ''
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  const min = searchParams.min ? Number(searchParams.min) : null
  const max = searchParams.max ? Number(searchParams.max) : null
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  let query: any = insforge.database.from('mercadona_tickets').select(COLS, { count: 'exact' })
  if (q) query = query.or(`store_name.ilike.%${q}%,store_city.ilike.%${q}%,ticket_number.ilike.%${q}%`)
  if (store) query = query.ilike('store_name', `%${store}%`)
  if (from) query = query.gte('purchased_at', `${from}T00:00:00`)
  if (to) query = query.lte('purchased_at', `${to}T23:59:59`)
  if (min !== null && !Number.isNaN(min)) query = query.gte('total', min)
  if (max !== null && !Number.isNaN(max)) query = query.lte('total', max)

  const { data, count, error } = await query
    .order('purchased_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const tickets = (data ?? []) as Ticket[]
  const total = count ?? tickets.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (store) params.set('store', store)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (min !== null) params.set('min', String(min))
    if (max !== null) params.set('max', String(max))
    params.set('page', String(targetPage))
    return `/tickets?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tickets</h1>
      <TicketFilters initial={{ q, from, to, store, min: searchParams.min, max: searchParams.max }} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tienda</th>
              <th className="px-4 py-3">Nº ticket</th>
              <th className="px-4 py-3 text-right">Art.</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">{dateTime(t.purchased_at)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{t.store_name ?? '—'}</div>
                  <div className="text-xs text-slate-400">{t.store_city ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{t.ticket_number ?? '—'}</td>
                <td className="px-4 py-3 text-right">{t.item_count ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold">{eur(t.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/tickets/${t.id}`} className="text-emerald-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {error ? `Error: ${error.message}` : 'Sin resultados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {num(total, 0)} tickets · página {page} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={buildUrl(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              ← Anterior
            </Link>
          )}
          {page < pages && (
            <Link href={buildUrl(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              Siguiente →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { WayletSummary, WayletTicket } from '@/lib/types'
import { eur, dateTime, liters, eurPerL, fixed, monthLabel } from '@/lib/format'
import { MonthlyFuelChart, PriceLineChart } from '@/components/charts'
import { FuelFilters } from '@/components/FuelFilters'
import { YearFilter } from '@/components/YearFilter'
import { resolveRange, yearsFromMonthly } from '@/lib/years'

const MAX_ROWS = 500

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default async function CombustiblePage({
  searchParams,
}: {
  searchParams: { q?: string; fuel?: string; from?: string; to?: string; year?: string }
}) {
  const insforge = createInsForgeServerClient()

  const q = searchParams.q ?? ''
  const fuel = searchParams.fuel ?? ''
  const { from, to } = resolveRange(searchParams.year, searchParams.from, searchParams.to)

  const [summaryRes, yearsRes, listRes] = await Promise.all([
    insforge.database.rpc('waylet_summary', { p_from: from || null, p_to: to || null }),
    insforge.database.rpc('waylet_summary', {}),
    (() => {
      let query: any = insforge.database.from('waylet_tickets').select('*', { count: 'exact' })
      if (q) query = query.or(`station_name.ilike.%${q}%,locality.ilike.%${q}%,ticket_number.ilike.%${q}%`)
      if (fuel) query = query.eq('fuel_type', fuel)
      if (from) query = query.gte('purchased_at', from)
      if (to) query = query.lte('purchased_at', to)
      return query.order('purchased_at', { ascending: false }).limit(MAX_ROWS)
    })(),
  ])

  const summary = (summaryRes.data ?? null) as WayletSummary | null
  const tickets = (listRes.data ?? []) as WayletTicket[]
  const years = yearsFromMonthly((yearsRes.data as WayletSummary | null)?.monthly)

  const priceRows = (summary?.monthly ?? []).map((m) => ({
    label: monthLabel(m.month),
    eur_l: m.eur_per_l,
  }))
  const fuels = (summary?.by_fuel ?? []).map((f) => f.fuel).filter((f) => f && f !== '—')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Combustible (Waylet)</h1>
        <span className="text-sm text-slate-400">Repsol · ES GLEM S.L</span>
      </div>

      <YearFilter years={years} />

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Repostajes" value={String(summary.totals.tickets)} />
            <Stat label="Litros" value={liters(summary.totals.liters)} />
            <Stat label="Importe" value={eur(summary.totals.total)} />
            <Stat label="€/L medio" value={eurPerL(summary.totals.eur_per_l)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Gasto por mes</h2>
              <MonthlyFuelChart data={summary.monthly} />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Evolución del precio (€/L, antes de descuento)</h2>
              {priceRows.length > 0 ? (
                <PriceLineChart
                  data={priceRows}
                  lines={[{ key: 'eur_l', name: '€/L', color: '#ea580c' }]}
                  decimals={3}
                  suffix="€/L"
                />
              ) : (
                <p className="text-sm text-slate-400">Sin datos.</p>
              )}
            </section>
          </div>
        </>
      )}

      <FuelFilters initial={{ q, fuel, from, to, year: searchParams.year, fuels }} />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{t.station_name ?? 'Repsol'}</p>
                <p className="text-xs text-slate-400">
                  {t.locality ?? ''} · {dateTime(t.purchased_at)}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-800">{eur(t.total)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {t.fuel_type ?? '—'} · {liters(t.liters)} · {eurPerL(t.unit_price)}
              </span>
              <Link
                href={`/combustible/${t.id}`}
                className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm text-orange-700 hover:bg-slate-50"
              >
                Ver
              </Link>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            {listRes.error ? `Error: ${listRes.error.message}` : 'Sin repostajes todavía.'}
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estación</th>
              <th className="px-4 py-3">Carburante</th>
              <th className="px-4 py-3 text-right">Litros</th>
              <th className="px-4 py-3 text-right">€/L</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>{dateTime(t.purchased_at)}</div>
                  <div className="text-xs text-slate-400">{t.ticket_number}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{t.station_name ?? '—'}</div>
                  <div className="text-xs text-slate-400">{t.locality ?? ''}</div>
                </td>
                <td className="px-4 py-3">{t.fuel_type ?? '—'}</td>
                <td className="px-4 py-3 text-right">{liters(t.liters)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{eurPerL(t.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {eur(t.total)}
                  {t.discount_amount ? (
                    <span className="ml-1 text-xs font-normal text-emerald-600">(−{fixed(t.discount_amount, 2)} €)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/combustible/${t.id}`} className="text-orange-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {listRes.error ? `Error: ${listRes.error.message}` : 'Sin repostajes todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

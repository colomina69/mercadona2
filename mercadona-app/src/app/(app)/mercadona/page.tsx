import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { SpendSummary } from '@/lib/types'
import { eur, num } from '@/lib/format'
import { resolveRange, yearsFromMonthly } from '@/lib/years'
import { MonthlySpendChart, StoreSpendChart, TopProductsChart } from '@/components/charts'
import { YearFilter } from '@/components/YearFilter'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default async function MercadonaPage({ searchParams }: { searchParams: { year?: string } }) {
  const insforge = createInsForgeServerClient()
  const { from, to } = resolveRange(searchParams.year)

  const [yearsRes, summaryRes] = await Promise.all([
    insforge.database.rpc('mercadona_spend_summary'),
    insforge.database.rpc('mercadona_spend_summary', { p_from: from || null, p_to: to || null }),
  ])

  const years = yearsFromMonthly((yearsRes.data as SpendSummary | null)?.monthly)
  const summary = (summaryRes.data ?? null) as SpendSummary | null

  if (summaryRes.error || !summary) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar el resumen: {summaryRes.error?.message ?? 'sin datos'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Resumen de gasto</h1>
        <YearFilter years={years} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Gasto total" value={eur(summary.totals.total)} />
        <Stat label="Tickets" value={num(summary.totals.tickets, 0)} />
        <Stat label="Ticket medio" value={eur(summary.totals.avg_ticket)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Gasto por mes</h2>
        <MonthlySpendChart data={summary.monthly} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Gasto por tienda</h2>
          <StoreSpendChart data={summary.by_store} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Top productos (por gasto)</h2>
          <TopProductsChart data={summary.top_products} />
          <p className="mt-3 text-right text-xs">
            <Link href="/productos" className="text-emerald-700 hover:underline">
              Ver todos los productos →
            </Link>
          </p>
        </section>
      </div>
    </div>
  )
}

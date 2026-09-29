import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { SpendSummary } from '@/lib/types'
import { eur, num } from '@/lib/format'
import { MonthlySpendChart, StoreSpendChart, TopProductsChart } from '@/components/charts'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const insforge = createInsForgeServerClient()
  const { data, error } = await insforge.database.rpc('mercadona_spend_summary')
  const summary = (data ?? null) as SpendSummary | null

  if (error || !summary) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        No se pudo cargar el resumen: {error?.message ?? 'sin datos'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Resumen de gasto</h1>

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

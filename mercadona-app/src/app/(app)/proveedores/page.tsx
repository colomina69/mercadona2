import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { SupplierInvoice, SupplierSummary } from '@/lib/types'
import { dateOnly, eur, num } from '@/lib/format'
import { resolveRange, yearsFromMonthly } from '@/lib/years'
import { MonthlySpendChart } from '@/components/charts'
import { YearFilter } from '@/components/YearFilter'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: { year?: string; supplier?: string }
}) {
  const insforge = createInsForgeServerClient()
  const supplier = searchParams.supplier ?? ''
  const { from, to } = resolveRange(searchParams.year)

  const [summaryRes, yearsRes, listRes] = await Promise.all([
    insforge.database.rpc('supplier_summary', { p_from: from || null, p_to: to || null, p_supplier: supplier || null }),
    insforge.database.rpc('supplier_summary', {}),
    (() => {
      let query: any = insforge.database.from('supplier_invoices').select('*')
      if (from) query = query.gte('issue_date', from)
      if (to) query = query.lte('issue_date', to)
      if (supplier) query = query.eq('supplier_name', supplier)
      return query.order('issue_date', { ascending: false }).limit(500)
    })(),
  ])

  const summary = (summaryRes.data ?? null) as SupplierSummary | null
  const invoices = (listRes.data ?? []) as SupplierInvoice[]
  const years = yearsFromMonthly((yearsRes.data as SupplierSummary | null)?.monthly)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Facturas de proveedores</h1>
        <YearFilter years={years} />
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Facturas" value={num(summary.totals.invoices, 0)} />
            <Stat label="Base" value={eur(summary.totals.base)} />
            <Stat label="IVA" value={eur(summary.totals.vat)} />
            <Stat label="Total" value={eur(summary.totals.total)} />
          </div>

          {(summary.monthly?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Facturación por mes</h2>
              <MonthlySpendChart data={summary.monthly} />
            </section>
          )}

          {(summary.by_supplier?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Por proveedor</h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/proveedores"
                  className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-medium ${supplier === '' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Todos
                </Link>
                {summary.by_supplier.map((s) => (
                  <Link
                    key={s.supplier}
                    href={`/proveedores?supplier=${encodeURIComponent(s.supplier)}`}
                    className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-medium ${supplier === s.supplier ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {s.supplier} · {eur(s.total)}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {invoices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          {listRes.error ? `Error: ${listRes.error.message}` : 'Sin facturas todavía.'}
        </p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/proveedores/${inv.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {inv.supplier_name} · {inv.invoice_number}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {dateOnly(inv.issue_date)} · {inv.product ?? '—'}
                    {inv.quantity != null ? ` · ${num(inv.quantity)} ${inv.unit ?? ''}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-slate-800">{eur(inv.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

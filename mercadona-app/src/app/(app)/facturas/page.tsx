import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { IberdrolaContract, IberdrolaInvoice, IberdrolaSummary } from '@/lib/types'
import { eur, num, dateOnly, kwh, eurPerKwh } from '@/lib/format'
import { MonthlyInvoiceChart } from '@/components/charts'
import { InvoiceFilters } from '@/components/InvoiceFilters'

const PAGE_SIZE = 25
const COLS = '*, contract:iberdrola_contracts(label, contract_number)'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: { contract?: string; q?: string; from?: string; to?: string; page?: string }
}) {
  const insforge = createInsForgeServerClient()

  const contract = searchParams.contract ?? ''
  const q = searchParams.q ?? ''
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [summaryRes, contractsRes, listRes] = await Promise.all([
    insforge.database.rpc('iberdrola_summary', {
      p_contract_id: contract || null,
      p_from: from || null,
      p_to: to || null,
    }),
    insforge.database.from('iberdrola_contracts').select('id, label, contract_number').order('contract_number'),
    (() => {
      let query: any = insforge.database.from('iberdrola_invoices').select(COLS, { count: 'exact' })
      if (contract) query = query.eq('contract_id', contract)
      if (q) query = query.ilike('invoice_number', `%${q}%`)
      if (from) query = query.gte('issue_date', from)
      if (to) query = query.lte('issue_date', to)
      return query.order('issue_date', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    })(),
  ])

  const summary = (summaryRes.data ?? null) as IberdrolaSummary | null
  const contracts = (contractsRes.data ?? []) as IberdrolaContract[]
  const invoices = (listRes.data ?? []) as IberdrolaInvoice[]
  const total = listRes.count ?? invoices.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams()
    if (contract) params.set('contract', contract)
    if (q) params.set('q', q)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', String(targetPage))
    return `/facturas?${params.toString()}`
  }

  const perKwh = (inv: IberdrolaInvoice) =>
    inv.consumption_kwh && inv.consumption_kwh > 0 && inv.energy_amount != null ? inv.energy_amount / inv.consumption_kwh : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Facturas Iberdrola</h1>
        <Link href="/contratos" className="text-sm text-sky-700 hover:underline">
          Contratos →
        </Link>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Facturas" value={num(summary.totals.invoices, 0)} />
            <Stat label="Consumo" value={kwh(summary.totals.kwh)} />
            <Stat label="Importe total" value={eur(summary.totals.total)} />
            <Stat label="€/kWh (energía)" value={eurPerKwh(summary.totals.eur_per_kwh)} />
          </div>

          {summary.monthly.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Facturación por mes</h2>
              <MonthlyInvoiceChart data={summary.monthly} />
            </section>
          )}
        </>
      )}

      <InvoiceFilters
        contracts={contracts.map((c) => ({ id: c.id, label: c.label ?? c.contract_number, contract_number: c.contract_number }))}
        initial={{ contract, q, from, to }}
      />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{inv.contract?.label ?? inv.contract_number ?? 'Contrato'}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {dateOnly(inv.issue_date)} · {inv.invoice_number}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-800">{eur(inv.total)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {kwh(inv.consumption_kwh)} · {eurPerKwh(perKwh(inv))}
              </span>
              <Link
                href={`/facturas/${inv.id}`}
                className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm text-sky-700 hover:bg-slate-50"
              >
                Ver
              </Link>
            </div>
          </div>
        ))}
        {invoices.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            {listRes.error ? `Error: ${listRes.error.message}` : 'Sin facturas todavía.'}
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Emisión</th>
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3 text-right">Consumo</th>
              <th className="px-4 py-3 text-right">€/kWh</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">{dateOnly(inv.issue_date)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{inv.contract?.label ?? inv.contract_number ?? '—'}</div>
                  <div className="text-xs text-slate-400">{inv.invoice_number}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {dateOnly(inv.period_start)} – {dateOnly(inv.period_end)}
                </td>
                <td className="px-4 py-3 text-right">{kwh(inv.consumption_kwh)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{eurPerKwh(perKwh(inv))}</td>
                <td className="px-4 py-3 text-right font-semibold">{eur(inv.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/facturas/${inv.id}`} className="text-sky-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {listRes.error ? `Error: ${listRes.error.message}` : 'Sin facturas todavía.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {num(total, 0)} facturas · página {page} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={buildUrl(page - 1)} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 px-3 hover:bg-slate-50">
              ← Anterior
            </Link>
          )}
          {page < pages && (
            <Link href={buildUrl(page + 1)} className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 px-3 hover:bg-slate-50">
              Siguiente →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

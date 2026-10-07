import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { IberdrolaContract, IberdrolaInvoice, IberdrolaPricePoint, IberdrolaSummary } from '@/lib/types'
import { eur, num, dateOnly, kwh, eurPerKwh, eurPerKwDay, monthLabel } from '@/lib/format'
import { MonthlyInvoiceChart, PriceLineChart } from '@/components/charts'
import { InvoiceFilters } from '@/components/InvoiceFilters'
import { YearFilter } from '@/components/YearFilter'
import { resolveRange, yearsFromMonthly } from '@/lib/years'

const MAX_ROWS = 500
const COLS = '*, contract:iberdrola_contracts(label, contract_number)'
const ACCENTS = ['#0284c7', '#7c3aed', '#0891b2', '#db2777', '#059669']

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function perKwh(inv: IberdrolaInvoice): number | null {
  return inv.consumption_kwh && inv.consumption_kwh > 0 && inv.energy_amount != null ? inv.energy_amount / inv.consumption_kwh : null
}

function InvoiceTable({ invoices }: { invoices: IberdrolaInvoice[] }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 p-3 md:hidden">
        {invoices.map((inv) => (
          <div key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{inv.invoice_number}</p>
                <p className="mt-0.5 text-xs text-slate-400">{dateOnly(inv.issue_date)}</p>
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
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Emisión</th>
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
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>{dateOnly(inv.issue_date)}</div>
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
          </tbody>
        </table>
      </div>
    </>
  )
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: { contract?: string; q?: string; from?: string; to?: string; year?: string }
}) {
  const insforge = createInsForgeServerClient()

  const contract = searchParams.contract ?? ''
  const q = searchParams.q ?? ''
  const { from, to } = resolveRange(searchParams.year, searchParams.from, searchParams.to)

  const [summaryRes, contractsRes, listRes, priceRes, yearsRes] = await Promise.all([
    insforge.database.rpc('iberdrola_summary', {
      p_contract_id: contract || null,
      p_from: from || null,
      p_to: to || null,
    }),
    insforge.database.from('iberdrola_contracts').select('id, label, contract_number, tariff').order('contract_number'),
    (() => {
      let query: any = insforge.database.from('iberdrola_invoices').select(COLS)
      if (contract) query = query.eq('contract_id', contract)
      if (q) query = query.ilike('invoice_number', `%${q}%`)
      if (from) query = query.gte('issue_date', from)
      if (to) query = query.lte('issue_date', to)
      return query.order('issue_date', { ascending: false }).limit(MAX_ROWS)
    })(),
    insforge.database.rpc('iberdrola_price_history', { p_contract_id: contract || null }),
    insforge.database.rpc('iberdrola_summary', {}),
  ])

  const summary = (summaryRes.data ?? null) as IberdrolaSummary | null
  const contracts = (contractsRes.data ?? []) as IberdrolaContract[]
  const invoices = (listRes.data ?? []) as IberdrolaInvoice[]
  const priceHistory = (priceRes.data ?? []) as IberdrolaPricePoint[]
  const years = yearsFromMonthly((yearsRes.data as IberdrolaSummary | null)?.monthly)

  const priceByContract = new Map<string, { label: string; energy: number | null; punta: number | null; valle: number | null }[]>()
  for (const p of priceHistory) {
    const key = p.contract_id ?? 'none'
    const arr = priceByContract.get(key) ?? []
    arr.push({
      label: monthLabel(p.issue_date.slice(0, 7)),
      energy: p.energy_eur_kwh,
      punta: p.power_punta,
      valle: p.power_valle,
    })
    priceByContract.set(key, arr)
  }

  const totalsByContract = new Map((summary?.by_contract ?? []).map((b) => [b.contract_id ?? '', b]))
  const powerByContract = new Map((summary?.power_by_contract ?? []).map((p) => [p.contract_id ?? '', p]))

  const byContract = new Map<string, IberdrolaInvoice[]>()
  for (const inv of invoices) {
    const key = inv.contract_id ?? 'none'
    const arr = byContract.get(key)
    if (arr) arr.push(inv)
    else byContract.set(key, [inv])
  }

  const sections = contracts
    .filter((c) => byContract.has(c.id))
    .map((c) => ({
      id: c.id,
      label: c.label ?? c.contract_number,
      contract_number: c.contract_number,
      tariff: c.tariff,
      invoices: byContract.get(c.id)!,
    }))
  if (byContract.has('none')) {
    sections.push({
      id: 'none',
      label: 'Sin contrato',
      contract_number: '',
      tariff: null,
      invoices: byContract.get('none')!,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Facturas Iberdrola</h1>
        <Link href="/contratos" className="text-sm text-sky-700 hover:underline">
          Contratos →
        </Link>
      </div>

      <YearFilter years={years} />

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
        initial={{ contract, q, from, to, year: searchParams.year }}
      />

      {sections.map((section, index) => {
        const t = totalsByContract.get(section.id)
        const p = powerByContract.get(section.id)
        const accent = ACCENTS[index % ACCENTS.length]
        const priceRows = priceByContract.get(section.id) ?? []
        return (
          <details
            key={section.id}
            open
            className="overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm"
            style={{ borderLeftColor: accent }}
          >
            <summary className="cursor-pointer list-none p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: accent }} />
                    {section.label}
                    {section.contract_number ? (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        Contrato {section.contract_number} · {section.tariff ?? '—'}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {section.invoices.length} factura{section.invoices.length === 1 ? '' : 's'} mostradas
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-slate-500 sm:grid-cols-4">
                  <span>
                    <span className="text-slate-400">Facturas:</span> {num(t?.invoices ?? section.invoices.length, 0)}
                  </span>
                  <span>
                    <span className="text-slate-400">Consumo:</span> {kwh(t?.kwh ?? null)}
                  </span>
                  <span>
                    <span className="text-slate-400">Total:</span> {eur(t?.total ?? null)}
                  </span>
                  <span>
                    <span className="text-slate-400">€/kWh:</span> {eurPerKwh(t?.eur_per_kwh ?? null)}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  <span className="text-slate-400">Potencia:</span> punta {eurPerKwDay(p?.punta ?? null)} · valle{' '}
                  {eurPerKwDay(p?.valle ?? null)}
                </span>
                {section.id !== 'none' && (
                  <Link href={`/contratos/${section.id}`} className="text-sky-700 hover:underline">
                    Ver contrato →
                  </Link>
                )}
              </div>
            </summary>

            <div className="border-t border-slate-100">
              {priceRows.length > 0 && (
                <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Precio de la energía (€/kWh)
                    </h3>
                    <PriceLineChart
                      data={priceRows}
                      lines={[{ key: 'energy', name: '€/kWh', color: accent }]}
                      decimals={3}
                      suffix="€/kWh"
                    />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Precio de la potencia (€/kW·día)
                    </h3>
                    <PriceLineChart
                      data={priceRows}
                      lines={[
                        { key: 'punta', name: 'Punta', color: '#f59e0b' },
                        { key: 'valle', name: 'Valle', color: '#10b981' },
                      ]}
                      decimals={4}
                      suffix="€/kW·día"
                    />
                  </div>
                </div>
              )}
              <InvoiceTable invoices={section.invoices} />
            </div>
          </details>
        )
      })}

      {sections.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          {listRes.error ? `Error: ${listRes.error.message}` : 'Sin facturas todavía.'}
        </p>
      )}
    </div>
  )
}

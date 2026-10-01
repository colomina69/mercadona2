import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { IberdrolaContract, IberdrolaInvoice, IberdrolaPricePoint, IberdrolaSummary } from '@/lib/types'
import { eur, kwh, num, eurPerKwh, eurPerKwDay, dateOnly, monthLabel } from '@/lib/format'
import { MonthlyInvoiceChart, PriceLineChart } from '@/components/charts'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

export default async function ContratoDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: contractData } = await insforge.database.from('iberdrola_contracts').select('*').eq('id', params.id).maybeSingle()
  const contract = (contractData ?? null) as IberdrolaContract | null
  if (!contract) notFound()

  const [summaryRes, invoicesRes, priceRes] = await Promise.all([
    insforge.database.rpc('iberdrola_summary', { p_contract_id: params.id }),
    insforge.database
      .from('iberdrola_invoices')
      .select('*')
      .eq('contract_id', params.id)
      .order('issue_date', { ascending: false }),
    insforge.database.rpc('iberdrola_price_history', { p_contract_id: params.id }),
  ])

  const summary = (summaryRes.data ?? null) as IberdrolaSummary | null
  const invoices = (invoicesRes.data ?? []) as IberdrolaInvoice[]
  const priceRows = ((priceRes.data ?? []) as IberdrolaPricePoint[]).map((p) => ({
    label: monthLabel(p.issue_date.slice(0, 7)),
    energy: p.energy_eur_kwh,
    punta: p.power_punta,
    valle: p.power_valle,
  }))
  const power = summary?.power_by_contract?.[0]
  const tramo = new Map((summary?.consumption_by_tramo ?? []).map((t) => [t.tramo, t.kwh]))

  return (
    <div className="space-y-4">
      <Link href="/contratos" className="text-sm text-sky-700 hover:underline">
        ← Volver a contratos
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">{contract.label ?? contract.contract_number}</h1>
        <p className="text-sm text-slate-500">
          Contrato {contract.contract_number} · {contract.tariff ?? '—'} · {contract.titular ?? ''}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="CUPS" value={contract.cups ?? '—'} />
          <Field label="Suministro" value={contract.supply_address ?? '—'} />
          <Field label="Potencia punta" value={`${contract.contracted_power_punta ?? '—'} kW`} />
          <Field label="Potencia valle" value={`${contract.contracted_power_valle ?? '—'} kW`} />
          <Field label="Potencia €/kW·día (punta)" value={eurPerKwDay(power?.punta ?? null)} />
          <Field label="Potencia €/kW·día (valle)" value={eurPerKwDay(power?.valle ?? null)} />
          <Field label="Energía €/kWh" value={eurPerKwh(summary?.totals.eur_per_kwh ?? null)} />
          <Field label="Nº facturas" value={num(summary?.totals.invoices ?? 0, 0)} />
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Consumo total</p>
          <p className="mt-1 text-2xl font-semibold">{kwh(summary?.totals.kwh ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Importe total</p>
          <p className="mt-1 text-2xl font-semibold">{eur(summary?.totals.total ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Punta / Llano / Valle</p>
          <p className="mt-1 text-sm font-medium">
            {kwh(tramo.get('punta') ?? 0)} · {kwh(tramo.get('llano') ?? 0)} · {kwh(tramo.get('valle') ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Periodo</p>
          <p className="mt-1 text-sm font-medium">
            {dateOnly(summary?.totals.first_invoice)} – {dateOnly(summary?.totals.last_invoice)}
          </p>
        </div>
      </div>

      {(summary?.monthly?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Facturación por mes</h2>
          <MonthlyInvoiceChart data={summary!.monthly} />
        </section>
      )}

      {priceRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">Evolución del precio de la energía (€/kWh)</h2>
            <PriceLineChart
              data={priceRows}
              lines={[{ key: 'energy', name: '€/kWh', color: '#0284c7' }]}
              decimals={3}
              suffix="€/kWh"
            />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">Evolución del precio de la potencia (€/kW·día)</h2>
            <PriceLineChart
              data={priceRows}
              lines={[
                { key: 'punta', name: 'Punta', color: '#f59e0b' },
                { key: 'valle', name: 'Valle', color: '#10b981' },
              ]}
              decimals={4}
              suffix="€/kW·día"
            />
          </section>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            {invoices.map((inv) => {
              const perKwh = inv.consumption_kwh && inv.consumption_kwh > 0 && inv.energy_amount != null ? inv.energy_amount / inv.consumption_kwh : null
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">{dateOnly(inv.issue_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {dateOnly(inv.period_start)} – {dateOnly(inv.period_end)}
                  </td>
                  <td className="px-4 py-3 text-right">{kwh(inv.consumption_kwh)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{eurPerKwh(perKwh)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{eur(inv.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/facturas/${inv.id}`} className="text-sky-700 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              )
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Sin facturas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

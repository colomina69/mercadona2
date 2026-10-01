import Link from 'next/link'
import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { IberdrolaConsumption, IberdrolaInvoice, IberdrolaInvoiceLine } from '@/lib/types'
import { eur, dateOnly, kwh, eurPerKwh, eurPerKwDay, fixed } from '@/lib/format'
import { PdfButton } from '@/components/PdfButton'

const GROUP_ORDER = ['power', 'energy', 'charges', 'services', 'taxes']
const GROUP_LABEL: Record<string, string> = {
  power: 'Potencia',
  energy: 'Energía',
  charges: 'Cargos normativos',
  services: 'Servicios y otros conceptos',
  taxes: 'Impuestos',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

function priceCell(line: IberdrolaInvoiceLine): string {
  if (line.unit === '%' && line.vat_rate != null) return `${fixed(line.vat_rate, 2)} %`
  if (line.unit_price == null) return '—'
  if (line.unit === 'kWh') return eurPerKwh(line.unit_price)
  if (line.unit === 'kW') return eurPerKwDay(line.unit_price)
  return `${fixed(line.unit_price, 6)} €/${line.unit ?? ''}`
}

function qtyCell(line: IberdrolaInvoiceLine): string {
  if (line.quantity == null) return '—'
  return `${fixed(line.quantity, 2)} ${line.unit ?? ''}`.trim()
}

export default async function FacturaDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: invData } = await insforge.database
    .from('iberdrola_invoices')
    .select('*, contract:iberdrola_contracts(label, contract_number, cups, tariff, supply_address)')
    .eq('id', params.id)
    .maybeSingle()

  const invoice = (invData ?? null) as IberdrolaInvoice | null
  if (!invoice) notFound()

  const [linesRes, consumptionRes] = await Promise.all([
    insforge.database
      .from('iberdrola_invoice_lines')
      .select('*')
      .eq('invoice_id', params.id)
      .order('line_no'),
    insforge.database.from('iberdrola_invoice_consumption').select('*').eq('invoice_id', params.id),
  ])

  const lines = (linesRes.data ?? []) as IberdrolaInvoiceLine[]
  const consumption = (consumptionRes.data ?? []) as IberdrolaConsumption[]

  const byGroup = GROUP_ORDER.map((g) => ({ group: g, items: lines.filter((l) => l.grp === g) })).filter((x) => x.items.length > 0)

  const perKwh =
    invoice.consumption_kwh && invoice.consumption_kwh > 0 && invoice.energy_amount != null
      ? invoice.energy_amount / invoice.consumption_kwh
      : null

  return (
    <div className="space-y-4">
      <Link href="/facturas" className="text-sm text-sky-700 hover:underline">
        ← Volver a facturas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            Factura {invoice.invoice_number} · {invoice.contract?.label ?? invoice.contract_number ?? ''}
          </h1>
          <p className="text-sm text-slate-500">
            Emitida {dateOnly(invoice.issue_date)} · Periodo {dateOnly(invoice.period_start)} – {dateOnly(invoice.period_end)}
          </p>
          <p className="text-sm text-slate-500">
            {kwh(invoice.consumption_kwh)} · {eurPerKwh(perKwh)} · Tarifa {invoice.tariff ?? '—'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-3xl font-bold text-slate-800">{eur(invoice.total)}</span>
          {invoice.pdf_key && <PdfButton pdfKey={invoice.pdf_key} bucket="iberdrola" />}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Consumo por tramo</h2>
        {consumption.length === 0 ? (
          <p className="text-sm text-slate-400">Sin desglose por tramo.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {consumption.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs capitalize text-slate-400">{c.tramo}</p>
                <p className="font-medium">{kwh(c.kwh)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Desglose de la factura</h2>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1">Concepto</th>
                <th className="py-1">Cantidad</th>
                <th className="py-1">Precio</th>
                <th className="py-1 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byGroup.map((g) => (
                <Fragment key={g.group}>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {GROUP_LABEL[g.group] ?? g.group}
                    </td>
                  </tr>
                  {g.items.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2">
                        <div className="text-slate-800">{line.concept ?? '—'}</div>
                        {line.detail && <div className="text-xs text-slate-400">{line.detail}</div>}
                      </td>
                      <td className="py-2 text-slate-600">{qtyCell(line)}</td>
                      <td className="py-2 text-slate-600">{priceCell(line)}</td>
                      <td className="py-2 text-right font-medium">{eur(line.amount)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="space-y-3 md:hidden">
          {byGroup.map((g) => (
            <div key={g.group}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{GROUP_LABEL[g.group] ?? g.group}</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {g.items.map((line) => (
                  <li key={line.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{line.concept ?? '—'}</p>
                      <p className="text-xs text-slate-400">
                        {qtyCell(line)} · {priceCell(line)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium">{eur(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Datos del contrato</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Contrato" value={invoice.contract_number ?? '—'} />
          <Field label="Tarifa" value={invoice.tariff ?? '—'} />
          <Field label="CUPS" value={invoice.cups ?? '—'} />
          <Field label="Suministro" value={(invoice.contract as any)?.supply_address ?? '—'} />
          <Field label="Base imponible" value={eur(invoice.subtotal)} />
          <Field label="Energía" value={eur(invoice.energy_amount)} />
          <Field label="Cargos" value={eur(invoice.charges_amount)} />
          <Field label="Servicios" value={eur(invoice.services_amount)} />
        </dl>
      </div>
    </div>
  )
}

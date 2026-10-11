import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { SupplierInvoice, SupplierInvoiceLine } from '@/lib/types'
import { dateOnly, eur, num } from '@/lib/format'
import { PdfButton } from '@/components/PdfButton'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

export default async function ProveedorDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: invData } = await insforge.database.from('supplier_invoices').select('*').eq('id', params.id).maybeSingle()
  const invoice = (invData ?? null) as SupplierInvoice | null
  if (!invoice) notFound()

  const { data: linesData } = await insforge.database
    .from('supplier_invoice_lines')
    .select('*')
    .eq('invoice_id', params.id)
    .order('line_no')
  const lines = (linesData ?? []) as SupplierInvoiceLine[]

  return (
    <div className="space-y-4">
      <Link href="/proveedores" className="text-sm text-emerald-700 hover:underline">
        ← Volver a proveedores
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">
          {invoice.supplier_name} · {invoice.invoice_number}
        </h1>
        <p className="text-sm text-slate-500">
          NIF {invoice.supplier_tax_id ?? '—'} · {invoice.document_type ?? 'documento'}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Fecha factura" value={dateOnly(invoice.issue_date)} />
          <Field label="Fecha entrega" value={dateOnly(invoice.delivery_date)} />
          <Field label="Nº albarán" value={invoice.albaran ?? '—'} />
          <Field label="Nº pedido" value={invoice.pedido ?? '—'} />
          <Field label="Producto" value={invoice.product ?? '—'} />
          <Field label="Cantidad" value={invoice.quantity != null ? `${num(invoice.quantity)} ${invoice.unit ?? ''}` : '—'} />
          <Field label="Precio" value={invoice.unit_price != null ? `${num(invoice.unit_price, 6)} €` : '—'} />
          <Field label="Forma de pago" value={invoice.payment_method ?? '—'} />
          <Field label="Matrícula" value={invoice.plate ?? '—'} />
          <Field label="Conductor" value={invoice.driver ?? '—'} />
          <Field label="Densidad" value={invoice.density != null ? `${num(invoice.density, 4)} kg/L` : '—'} />
          <Field label="CAE" value={invoice.cae ?? '—'} />
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-500">Base: <span className="font-medium text-slate-800">{eur(invoice.base)}</span></span>
          <span className="text-slate-500">IVA {num(invoice.vat_rate ?? 0, 0)}%: <span className="font-medium text-slate-800">{eur(invoice.vat_amount)}</span></span>
          <span className="text-slate-500">Total: <span className="text-lg font-semibold text-slate-900">{eur(invoice.total)}</span></span>
        </div>
        {invoice.pdf_key ? (
          <div className="mt-4">
            <PdfButton pdfKey={invoice.pdf_key} bucket="suppliers" />
          </div>
        ) : null}
        {invoice.responsibility_pdf_key ? (
          <div className="mt-2">
            <PdfButton pdfKey={invoice.responsibility_pdf_key} bucket="suppliers" label="Documento de responsabilidad" />
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">{l.product_name ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {num(l.quantity)} {l.unit ?? ''}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{num(l.unit_price, 6)} €</td>
                <td className="px-4 py-3 text-right font-semibold">{eur(l.amount)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Sin líneas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

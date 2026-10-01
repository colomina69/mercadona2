import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { BankCategory, BankLink, BankTransaction, IberdrolaInvoice, InvoiceCandidate, LinkedTicket, TicketCandidate } from '@/lib/types'
import { eur, dateOnly } from '@/lib/format'
import { TransactionEditor } from './TransactionEditor'
import { TicketLinker } from './TicketLinker'
import { InvoiceLinker } from './InvoiceLinker'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  )
}

export default async function MovimientoDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: txData } = await insforge.database
    .from('bank_transactions')
    .select('*, category:bank_categories(id, name, kind, color, sort_order)')
    .eq('id', params.id)
    .maybeSingle()

  const tx = (txData ?? null) as BankTransaction | null
  if (!tx) notFound()

  const [categoriesRes, linksRes, suggestionsRes, invoiceSuggestionsRes] = await Promise.all([
    insforge.database.from('bank_categories').select('id, name, kind, color, sort_order').order('kind').order('sort_order'),
    insforge.database.from('bank_transaction_links').select('id, transaction_id, target_type, target_id').eq('transaction_id', params.id),
    insforge.database.rpc('bank_match_tickets', { p_transaction_id: params.id }),
    insforge.database.rpc('bank_match_invoices', { p_transaction_id: params.id }),
  ])

  const categories = (categoriesRes.data ?? []) as BankCategory[]
  const links = (linksRes.data ?? []) as BankLink[]
  const suggestions = (suggestionsRes.data ?? []) as TicketCandidate[]
  const invoiceSuggestions = (invoiceSuggestionsRes.data ?? []) as InvoiceCandidate[]

  const ticketIds = links.filter((l) => l.target_type === 'ticket').map((l) => l.target_id)
  let linkedTickets: LinkedTicket[] = []
  if (ticketIds.length > 0) {
    const { data } = await insforge.database
      .from('mercadona_tickets')
      .select('id, ticket_number, purchased_at, store_name, store_city, total')
      .in('id', ticketIds)
    linkedTickets = (data ?? []) as LinkedTicket[]
  }
  const linkedByTicketId = Object.fromEntries(links.filter((l) => l.target_type === 'ticket').map((l) => [l.target_id, l.id]))

  const invoiceIds = links.filter((l) => l.target_type === 'invoice').map((l) => l.target_id)
  let linkedInvoices: IberdrolaInvoice[] = []
  if (invoiceIds.length > 0) {
    const { data } = await insforge.database
      .from('iberdrola_invoices')
      .select('id, invoice_number, issue_date, period_start, period_end, total, consumption_kwh, contract_number')
      .in('id', invoiceIds)
    linkedInvoices = (data ?? []) as IberdrolaInvoice[]
  }
  const linkedByInvoiceId = Object.fromEntries(links.filter((l) => l.target_type === 'invoice').map((l) => [l.target_id, l.id]))

  const label = tx.concept ?? tx.description ?? 'Movimiento'

  return (
    <div className="space-y-4">
      <Link href="/movimientos" className="text-sm text-emerald-700 hover:underline">
        ← Volver a movimientos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{label}</h1>
          <p className="text-sm text-slate-500">{dateOnly(tx.operation_date)}</p>
          {tx.category && (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {tx.category.name}
            </span>
          )}
        </div>
        <span className={`text-3xl font-bold ${(tx.amount ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {eur(tx.amount)}
        </span>
      </div>

      <TransactionEditor
        transactionId={tx.id}
        description={tx.description}
        concept={tx.concept}
        categoryId={tx.category_id}
        categories={categories}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Datos originales</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Fecha operación" value={dateOnly(tx.operation_date)} />
          <Field label="Fecha valor" value={dateOnly(tx.value_date)} />
          <Field label="Importe" value={eur(tx.amount)} />
          <Field label="Saldo" value={eur(tx.balance)} />
          <Field label="CIF / emisor" value={tx.counterparty_tax_id ?? '—'} />
          <Field label="Referencia" value={tx.reference ?? '—'} />
          <Field label="Fichero" value={tx.source_file ?? '—'} />
          <Field label="Concepto original" value={tx.description ?? '—'} />
        </dl>
        {tx.raw_key && <p className="mt-3 text-xs text-slate-400">{tx.raw_key}</p>}
      </div>

      <TicketLinker
        transactionId={tx.id}
        amount={tx.amount}
        suggestions={suggestions}
        linkedTickets={linkedTickets}
        linkedByTicketId={linkedByTicketId}
      />

      <InvoiceLinker
        transactionId={tx.id}
        amount={tx.amount}
        suggestions={invoiceSuggestions}
        linkedInvoices={linkedInvoices}
        linkedByInvoiceId={linkedByInvoiceId}
      />
    </div>
  )
}

import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { BankSummary, BankTransaction, BankCategory, BankAccountBalance } from '@/lib/types'
import { eur, num, dateOnly } from '@/lib/format'
import { MonthlyBankChart } from '@/components/charts'
import { BankFilters } from '@/components/BankFilters'
import { YearFilter } from '@/components/YearFilter'
import { BankUploadForm } from './UploadForm'
import { resolveRange, yearsFromMonthly } from '@/lib/years'

const PAGE_SIZE = 50
const COLS =
  'id, operation_date, value_date, description, concept, amount, balance, counterparty_tax_id, reference, source_file, raw_key, category_id, category:bank_categories(name, kind), links:bank_transaction_links(id, target_type)'

type TxRow = BankTransaction & { links?: { id: string; target_type: string }[] | null }

function sanitize(value: string): string {
  return value.replace(/[,()%*]/g, ' ').trim()
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-red-600' : 'text-slate-900'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: { q?: string; from?: string; to?: string; min?: string; max?: string; category?: string; page?: string; year?: string }
}) {
  const insforge = createInsForgeServerClient()

  const q = searchParams.q ? sanitize(searchParams.q) : ''
  const { from, to } = resolveRange(searchParams.year, searchParams.from, searchParams.to)
  const category = searchParams.category ?? ''
  const min = searchParams.min ? Number(searchParams.min) : null
  const max = searchParams.max ? Number(searchParams.max) : null
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [summaryRes, categoriesRes, listRes, balancesRes, yearsRes] = await Promise.all([
    insforge.database.rpc('bank_summary', { p_from: from || null, p_to: to || null }),
    insforge.database.from('bank_categories').select('id, name, kind, color, sort_order').order('kind').order('sort_order'),
    (() => {
      let query: any = insforge.database.from('bank_transactions').select(COLS, { count: 'exact' })
      if (q) query = query.or(`description.ilike.%${q}%,concept.ilike.%${q}%,reference.ilike.%${q}%`)
      if (from) query = query.gte('operation_date', from)
      if (to) query = query.lte('operation_date', to)
      if (min !== null && !Number.isNaN(min)) query = query.gte('amount', min)
      if (max !== null && !Number.isNaN(max)) query = query.lte('amount', max)
      if (category === 'none') query = query.is('category_id', null)
      else if (category) query = query.eq('category_id', category)
      return query
        .order('operation_date', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
    })(),
    insforge.database
      .from('bank_account_balances')
      .select('account_iban, account_name, balance, currency, as_of, source')
      .order('as_of', { ascending: false })
      .limit(50),
    insforge.database.rpc('bank_summary', {}),
  ])

  const summary = (summaryRes.data ?? null) as BankSummary | null
  const categories = (categoriesRes.data ?? []) as BankCategory[]
  const transactions = (listRes.data ?? []) as TxRow[]
  const balanceRows = (balancesRes.data ?? []) as BankAccountBalance[]
  const latestByAccount = new Map<string, BankAccountBalance>()
  for (const b of balanceRows) {
    if (!latestByAccount.has(b.account_iban)) latestByAccount.set(b.account_iban, b)
  }
  const accounts = Array.from(latestByAccount.values())
  const years = yearsFromMonthly((yearsRes.data as BankSummary | null)?.monthly)
  const total = listRes.count ?? transactions.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (searchParams.year) params.set('year', searchParams.year)
    else {
      if (from) params.set('from', from)
      if (to) params.set('to', to)
    }
    if (category) params.set('category', category)
    if (min !== null) params.set('min', String(min))
    if (max !== null) params.set('max', String(max))
    params.set('page', String(targetPage))
    return `/movimientos?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Movimientos bancarios</h1>
        <Link href="/categorias" className="text-sm text-emerald-700 hover:underline">
          Categorías →
        </Link>
      </div>

      <YearFilter years={years} />

      <BankUploadForm />

      {accounts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Saldo de la cuenta</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {accounts.map((a) => (
              <div
                key={a.account_iban}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {a.account_name ?? 'Cuenta'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.account_iban} · {dateOnly(a.as_of)}
                    {a.source === 'enable_banking' ? ' · Enable Banking' : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xl font-semibold text-slate-900">{eur(a.balance)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Ingresos" value={eur(summary.totals.inflow)} tone="positive" />
            <Stat label="Gastos" value={eur(summary.totals.outflow)} tone="negative" />
            <Stat label="Neto" value={eur(summary.totals.net)} tone={summary.totals.net >= 0 ? 'positive' : 'negative'} />
            <Stat label="Último saldo" value={eur(summary.totals.last_balance)} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Ingresos vs gastos por mes</h2>
              <MonthlyBankChart data={summary.monthly} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-600">Gasto por categoría</h2>
              <div className="space-y-1">
                {(summary.by_category ?? [])
                  .filter((c) => c.total < 0)
                  .slice(0, 10)
                  .map((c) => {
                    const maxAbs = Math.max(...(summary.by_category ?? []).filter((x) => x.total < 0).map((x) => Math.abs(x.total)), 1)
                    const pct = Math.round((Math.abs(c.total) / maxAbs) * 100)
                    return (
                      <div key={c.category} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">{c.category}</span>
                          <span className="font-medium">{eur(c.total)}</span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                {(summary.by_category ?? []).filter((c) => c.total < 0).length === 0 && (
                  <p className="text-xs text-slate-400">Sin datos de categorías todavía.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <BankFilters
        categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
        initial={{ q, from, to, category, min: searchParams.min, max: searchParams.max, year: searchParams.year }}
      />

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {transactions.map((t) => {
          const label = t.concept ?? t.description ?? '—'
          const ticketCount = (t.links ?? []).filter((l) => l.target_type === 'ticket').length
          const kindColor = t.category?.kind === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          return (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {dateOnly(t.operation_date)}
                    {t.reference ? ` · ${t.reference}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 font-semibold ${(t.amount ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {eur(t.amount)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {t.category ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${kindColor}`}>
                      {t.category.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">Sin categoría</span>
                  )}
                  {ticketCount > 0 && (
                    <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                      {ticketCount} ticket{ticketCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <Link
                  href={`/movimientos/${t.id}`}
                  className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-slate-200 px-3 text-sm text-emerald-700 hover:bg-slate-50"
                >
                  Editar
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-400">Saldo: {eur(t.balance)}</p>
            </div>
          )
        })}
        {transactions.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            {listRes.error ? `Error: ${listRes.error.message}` : 'Sin movimientos. Sube un extracto .txt para empezar.'}
          </p>
        )}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-center">Tickets</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((t) => {
              const label = t.concept ?? t.description ?? '—'
              const ticketCount = (t.links ?? []).filter((l) => l.target_type === 'ticket').length
              const kindColor = t.category?.kind === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">{dateOnly(t.operation_date)}</td>
                  <td className="px-4 py-3">
                    {t.concept ? (
                      <div className="font-medium text-slate-800">{t.concept}</div>
                    ) : (
                      <div className="text-slate-600">{label}</div>
                    )}
                    <div className="text-xs text-slate-400">{t.reference ?? ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    {t.category ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${kindColor}`}>
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ticketCount > 0 ? (
                      <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {ticketCount}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      (t.amount ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {eur(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{eur(t.balance)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/movimientos/${t.id}`} className="text-emerald-700 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              )
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {listRes.error ? `Error: ${listRes.error.message}` : 'Sin movimientos. Sube un extracto .txt para empezar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {num(total, 0)} movimientos · página {page} de {pages}
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

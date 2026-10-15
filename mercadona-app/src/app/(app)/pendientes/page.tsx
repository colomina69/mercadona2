import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { PendingCount, PendingMovement } from '@/lib/types'
import { eur, dateOnly } from '@/lib/format'

export default async function PendientesPage() {
  const insforge = createInsForgeServerClient()
  const [countRes, listRes] = await Promise.all([
    insforge.database.rpc('bank_pending_count', {}),
    insforge.database.rpc('bank_pending_movements', { p_limit: 500, p_offset: 0 }),
  ])

  const count = (countRes.data ?? { missing_category: 0, missing_link: 0, total: 0 }) as PendingCount
  const items = (listRes.data ?? []) as PendingMovement[]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pendientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Movimientos a los que les falta la <strong>categoría</strong> o un <strong>ticket/factura</strong> vinculado.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total</p>
          <p className="text-2xl font-bold text-slate-800">{count.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sin categoría</p>
          <p className="text-2xl font-bold text-amber-600">{count.missing_category}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sin documento</p>
          <p className="text-2xl font-bold text-rose-600">{count.missing_link}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          🎉 No hay movimientos pendientes.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {items.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/movimientos/${m.id}`}
                  className="flex items-center gap-3 p-4 transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{m.concept?.trim() || m.description || 'Movimiento'}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {dateOnly(m.operation_date)}
                      {m.category_name ? ` · ${m.category_name}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.needs_category ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Falta categoría</span>
                      ) : null}
                      {m.needs_link ? (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Falta documento</span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`shrink-0 font-semibold ${(m.amount ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {eur(m.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

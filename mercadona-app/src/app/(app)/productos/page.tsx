import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { ProductRow } from '@/lib/types'
import { eur, num, dateOnly } from '@/lib/format'
import { ProductSearch } from '@/components/ProductSearch'

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string } }) {
  const insforge = createInsForgeServerClient()
  const q = searchParams.q ?? ''

  const { data, error } = await insforge.database.rpc('mercadona_products', { q: q || null, lim: 500 })
  const products = (data ?? []) as ProductRow[]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Productos</h1>
        <div className="w-full sm:w-96">
          <ProductSearch initial={q} />
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {products.map((p) => (
          <div key={p.product_name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Link
              href={`/productos/${encodeURIComponent(p.product_name)}`}
              className="font-medium text-slate-800 hover:text-emerald-700"
            >
              {p.product_name}
            </Link>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{num(p.purchases, 0)} compras</span>
              <span>Últ.: {dateOnly(p.last_date)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-xs text-slate-400">Precio últ.</p>
                <p className="font-medium">{eur(p.last_price)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-xs text-slate-400">Precio medio</p>
                <p className="text-slate-500">{eur(p.avg_price)}</p>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            {error ? `Error: ${error.message}` : 'Sin resultados'}
          </p>
        )}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-right">Compras</th>
              <th className="px-4 py-3 text-right">Última</th>
              <th className="px-4 py-3 text-right">Precio últ.</th>
              <th className="px-4 py-3 text-right">Precio medio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.product_name} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/productos/${encodeURIComponent(p.product_name)}`}
                    className="font-medium text-slate-800 hover:text-emerald-700 hover:underline"
                  >
                    {p.product_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">{num(p.purchases, 0)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap text-slate-500">{dateOnly(p.last_date)}</td>
                <td className="px-4 py-2 text-right">{eur(p.last_price)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{eur(p.avg_price)}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  {error ? `Error: ${error.message}` : 'Sin resultados'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

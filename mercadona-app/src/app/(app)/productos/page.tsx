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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
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

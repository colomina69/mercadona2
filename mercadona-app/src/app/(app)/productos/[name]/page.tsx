import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { HistoryRow, ProductRow } from '@/lib/types'
import { eur, num, dateOnly, pricePer } from '@/lib/format'
import { PriceHistoryChart } from '@/components/charts'
import { AliasManager } from '@/components/AliasManager'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function ProductDetailPage({ params }: { params: { name: string } }) {
  const insforge = createInsForgeServerClient()
  const name = safeDecode(params.name)

  const { data: histData } = await insforge.database.rpc('mercadona_product_history', { p_name: name })
  const history = (histData ?? []) as HistoryRow[]

  const { data: prodData } = await insforge.database.rpc('mercadona_products', { q: null, lim: 1000 })
  const productNames = ((prodData ?? []) as ProductRow[]).map((p) => p.product_name)

  const prices = history.map((h) => h.unit_price_eff).filter((v): v is number => v != null)
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  const last = prices.length ? prices[prices.length - 1] : null
  const unit = history.find((h) => h.unit === 'kg') ? 'kg' : 'ud'

  return (
    <div className="space-y-4">
      <Link href="/productos" className="text-sm text-emerald-700 hover:underline">
        ← Volver a productos
      </Link>

      <h1 className="text-xl font-semibold">{name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Compras" value={num(history.length, 0)} />
        <Stat label={`Último precio (${unit === 'kg' ? '€/kg' : '€/ud'})`} value={pricePer(unit, last)} />
        <Stat label="Precio medio" value={pricePer(unit, avg)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Evolución del precio</h2>
        <PriceHistoryChart data={history} />
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tienda</th>
              <th className="px-4 py-3 text-right">Cantidad</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((h, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap">{dateOnly(h.purchased_at)}</td>
                <td className="px-4 py-2">{h.store_name ?? '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {num(h.quantity, 3)} {h.unit === 'kg' ? 'kg' : 'ud'}
                </td>
                <td className="px-4 py-2 text-right">{pricePer(h.unit, h.unit_price_eff)}</td>
                <td className="px-4 py-2 text-right font-medium">{eur(h.amount)}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Sin compras registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AliasManager productName={name} productNames={productNames} />
    </div>
  )
}

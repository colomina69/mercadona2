'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'

export function AliasManager({
  productName,
  productNames,
}: {
  productName: string
  productNames: string[]
}) {
  const router = useRouter()
  const [aliases, setAliases] = useState<string[]>([])
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ensureProduct(name: string): Promise<string | null> {
    const db = getInsforgeBrowser().database
    const { data } = await db.from('mercadona_products').select('id').eq('name', name).maybeSingle()
    if (data?.id) return data.id as string
    const { data: ins, error: insErr } = await db
      .from('mercadona_products')
      .insert([{ name }])
      .select('id')
      .single()
    if (insErr) return null
    return (ins as { id: string } | null)?.id ?? null
  }

  async function loadAliases() {
    const db = getInsforgeBrowser().database
    const { data: prod } = await db.from('mercadona_products').select('id').eq('name', productName).maybeSingle()
    if (!prod?.id) {
      setAliases([])
      return
    }
    const { data } = await db.from('mercadona_product_aliases').select('raw_name').eq('product_id', prod.id as string)
    setAliases(((data ?? []) as { raw_name: string }[]).map((a) => a.raw_name).filter((n) => n !== productName))
  }

  useEffect(() => {
    void loadAliases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName])

  async function merge(event: React.FormEvent) {
    event.preventDefault()
    const otherName = other.trim()
    if (!otherName || otherName === productName) return
    setBusy(true)
    setError(null)
    try {
      const db = getInsforgeBrowser().database
      const targetId = await ensureProduct(productName)
      const sourceId = await ensureProduct(otherName)
      if (!targetId || !sourceId || targetId === sourceId) {
        setError('No se pudo unir el producto')
        setBusy(false)
        return
      }
      await db.from('mercadona_product_aliases').update({ product_id: targetId }).eq('product_id', sourceId)
      await db.from('mercadona_product_aliases').delete().eq('raw_name', otherName)
      await db.from('mercadona_product_aliases').insert([{ raw_name: otherName, product_id: targetId }])
      await db.from('mercadona_products').delete().eq('id', sourceId)
      setOther('')
      await loadAliases()
      router.refresh()
    } catch {
      setError('Error al unir')
    }
    setBusy(false)
  }

  async function removeAlias(raw: string) {
    setBusy(true)
    const db = getInsforgeBrowser().database
    await db.from('mercadona_product_aliases').delete().eq('raw_name', raw)
    await loadAliases()
    router.refresh()
    setBusy(false)
  }

  const candidates = productNames.filter((n) => n !== productName)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-600">Variantes (alias)</h2>
      <p className="mt-1 text-xs text-slate-400">
        Une nombres parecidos del ticket para agrupar sus compras y precios bajo este producto.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {aliases.length === 0 && <span className="text-xs text-slate-400">Sin variantes unidas.</span>}
        {aliases.map((raw) => (
          <span key={raw} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">
            {raw}
            <button
              onClick={() => removeAlias(raw)}
              disabled={busy}
              className="text-slate-400 hover:text-red-600 disabled:opacity-50"
              title="Quitar alias"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={merge} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          list="product-options"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Producto a unir…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <datalist id="product-options">
          {candidates.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={busy || !other.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {busy ? 'Uniendo…' : 'Unir a este producto'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

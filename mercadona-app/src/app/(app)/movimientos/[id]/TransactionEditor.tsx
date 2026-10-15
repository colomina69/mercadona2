'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'
import { CategoryCreator, CategoryOptions } from '@/components/CategoryCreator'

export function TransactionEditor({
  transactionId,
  description,
  concept,
  categoryId,
  documentNa,
  categories: initialCategories,
}: {
  transactionId: string
  description: string | null
  concept: string | null
  categoryId: string | null
  documentNa: boolean
  categories: BankCategory[]
}) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [name, setName] = useState(concept ?? '')
  const [category, setCategory] = useState(categoryId ?? '')
  const [docNa, setDocNa] = useState(documentNa)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [suggestion, setSuggestion] = useState<{ id: string; source: string } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await getInsforgeBrowser().database.rpc('bank_suggest_category', {
        p_transaction_id: transactionId,
      })
      const sug = data as { category_id: string; source: string } | null
      if (active && sug?.category_id) setSuggestion({ id: sug.category_id, source: sug.source })
    })()
    return () => {
      active = false
    }
  }, [transactionId])

  async function save(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setBusy(true)
      setError(null)
      setSaved(false)
    }
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_transactions')
      .update({ concept: name.trim() || null, category_id: category || null, document_na: docNa })
      .eq('id', transactionId)
    if (!options?.silent) setBusy(false)
    if (err) {
      if (!options?.silent) setError(err.message)
      return
    }
    setSaved(true)
    setDirty(false)
    if (!options?.silent) router.push('/movimientos')
  }

  // Al vincular/desvincular desde la propia ficha se guardan también los cambios del movimiento
  useEffect(() => {
    const handler = () => {
      void save({ silent: true })
    }
    window.addEventListener('movement:save', handler)
    return () => window.removeEventListener('movement:save', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, category, docNa])

  function markDirty() {
    setSaved(false)
    setDirty(true)
  }

  const expenses = categories.filter((c) => c.kind === 'expense')
  const incomes = categories.filter((c) => c.kind === 'income')
  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-600">Editar</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Concepto</label>
          <input
            className={input}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              markDirty()
            }}
            placeholder={description ?? 'Concepto'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
          <select
            className={input}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              markDirty()
            }}
          >
            <option value="">Sin categoría</option>
            {expenses.length > 0 && (
              <optgroup label="Gastos">
                <CategoryOptions categories={categories} kind="expense" />
              </optgroup>
            )}
            {incomes.length > 0 && (
              <optgroup label="Ingresos">
                <CategoryOptions categories={categories} kind="income" />
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={docNa}
          onChange={(e) => {
            setDocNa(e.target.checked)
            markDirty()
          }}
          className="h-4 w-4 rounded border-slate-300"
        />
        Sin documento (no aplica) — no hace falta ticket/factura (nómina, comisiones…)
      </label>

      {(() => {
        const sugName = suggestion ? categories.find((c) => c.id === suggestion.id)?.name : null
        if (!suggestion || !sugName || suggestion.id === category) return null
        return (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-800">
              💡 Sugerida: <strong>{sugName}</strong>{' '}
              <span className="text-amber-700/70">
                ({suggestion.source === 'historial' ? 'según tus movimientos' : 'por comercio'})
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setCategory(suggestion.id)
                markDirty()
              }}
              className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Usar
            </button>
          </div>
        )
      })()}

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Nueva categoría o subcategoría</p>
        <CategoryCreator
          categories={categories}
          onCreated={(c) => {
            setCategories((cs) => [...cs, c])
            setCategory(c.id)
            markDirty()
          }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => save()}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-xs text-emerald-600">Guardado ✓</span>}
        {dirty && <span className="text-xs text-amber-600">• Cambios sin guardar</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}

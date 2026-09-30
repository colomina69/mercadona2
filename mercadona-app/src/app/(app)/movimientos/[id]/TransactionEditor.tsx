'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'

export function TransactionEditor({
  transactionId,
  description,
  concept,
  categoryId,
  categories: initialCategories,
}: {
  transactionId: string
  description: string | null
  concept: string | null
  categoryId: string | null
  categories: BankCategory[]
}) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [name, setName] = useState(concept ?? '')
  const [category, setCategory] = useState(categoryId ?? '')
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'expense' | 'income'>('expense')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function refreshCategories() {
    return getInsforgeBrowser()
      .database.from('bank_categories')
      .select('id, name, kind, color, sort_order')
      .order('kind')
      .order('sort_order')
  }

  async function createCategory() {
    const n = newName.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .insert([{ name: n, kind: newKind }])
      .select('id')
      .single()
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    setNewName('')
    setCategory((data as { id: string } | null)?.id ?? '')
    const { data: list } = await refreshCategories()
    setCategories((list ?? []) as BankCategory[])
    setBusy(false)
  }

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_transactions')
      .update({ concept: name.trim() || null, category_id: category || null })
      .eq('id', transactionId)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setSaved(true)
    router.push('/movimientos')
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
            onChange={(e) => setName(e.target.value)}
            placeholder={description ?? 'Concepto'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sin categoría</option>
            {expenses.length > 0 && (
              <optgroup label="Gastos">
                {expenses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {incomes.length > 0 && (
              <optgroup label="Ingresos">
                {incomes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
        <span className="text-xs font-medium text-slate-500">Nueva categoría:</span>
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ej. Gasolina"
        />
        <select
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as 'expense' | 'income')}
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>
        <button
          type="button"
          onClick={createCategory}
          disabled={busy || !newName.trim()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white disabled:opacity-50"
        >
          Crear
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-xs text-emerald-600">Guardado ✓</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'

function CategoryRow({
  category,
  busy,
  onRename,
  onChangeKind,
  onRemove,
}: {
  category: BankCategory
  busy: boolean
  onRename: (id: string, name: string, kind: 'expense' | 'income') => void
  onChangeKind: (id: string, kind: 'expense' | 'income') => void
  onRemove: (id: string) => void
}) {
  const [value, setValue] = useState(category.name)
  return (
    <li className="flex items-center gap-2 py-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() && value !== category.name && onRename(category.id, value, category.kind)}
        className="flex-1 rounded-lg border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-emerald-500 focus:outline-none"
      />
      <select
        value={category.kind}
        onChange={(e) => onChangeKind(category.id, e.target.value as 'expense' | 'income')}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
      >
        <option value="expense">Gasto</option>
        <option value="income">Ingreso</option>
      </select>
      <button
        type="button"
        onClick={() => onRemove(category.id)}
        disabled={busy}
        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
        title="Eliminar"
      >
        ✕
      </button>
    </li>
  )
}

export function CategoryManager({ initial }: { initial: BankCategory[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initial)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const input =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  async function reload() {
    const { data } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .select('id, name, kind, color, sort_order')
      .order('kind')
      .order('sort_order')
    setCategories((data ?? []) as BankCategory[])
    router.refresh()
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser().database.from('bank_categories').insert([{ name: n, kind }])
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setName('')
    await reload()
  }

  async function onRename(id: string, newName: string, currentKind: 'expense' | 'income') {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .update({ name: newName.trim(), kind: currentKind })
      .eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await reload()
  }

  async function onChangeKind(id: string, newKind: 'expense' | 'income') {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .update({ kind: newKind })
      .eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await reload()
  }

  async function onRemove(id: string) {
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser().database.from('bank_categories').delete().eq('id', id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await reload()
  }

  const expenses = categories.filter((c) => c.kind === 'expense')
  const incomes = categories.filter((c) => c.kind === 'income')

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Nueva categoría</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={`${input} flex-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej. Gasolina)"
          />
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value as 'expense' | 'income')}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Añadir
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-600">Gastos</h2>
          <ul className="divide-y divide-slate-100">
            {expenses.map((c) => (
              <CategoryRow key={c.id} category={c} busy={busy} onRename={onRename} onChangeKind={onChangeKind} onRemove={onRemove} />
            ))}
            {expenses.length === 0 && <li className="py-2 text-sm text-slate-400">Sin categorías.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-slate-600">Ingresos</h2>
          <ul className="divide-y divide-slate-100">
            {incomes.map((c) => (
              <CategoryRow key={c.id} category={c} busy={busy} onRename={onRename} onChangeKind={onChangeKind} onRemove={onRemove} />
            ))}
            {incomes.length === 0 && <li className="py-2 text-sm text-slate-400">Sin categorías.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}

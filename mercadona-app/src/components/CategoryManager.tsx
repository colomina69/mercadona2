'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'
import { CategoryCreator } from '@/components/CategoryCreator'

const CAT_COLS = 'id, name, kind, color, sort_order, parent_id'

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

function SubcategoryRow({
  category,
  busy,
  onRename,
  onRemove,
}: {
  category: BankCategory
  busy: boolean
  onRename: (id: string, name: string, kind: 'expense' | 'income') => void
  onRemove: (id: string) => void
}) {
  const [value, setValue] = useState(category.name)
  return (
    <li className="flex items-center gap-2 py-1.5 pl-6">
      <span className="text-slate-300">↳</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() && value !== category.name && onRename(category.id, value, category.kind)}
        className="flex-1 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-600 hover:border-slate-200 focus:border-emerald-500 focus:outline-none"
      />
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null)
  const [childName, setChildName] = useState('')

  async function reload() {
    const { data } = await getInsforgeBrowser().database.from('bank_categories').select(CAT_COLS).order('sort_order')
    setCategories((data ?? []) as BankCategory[])
    router.refresh()
  }

  async function addSubcategory(parentId: string) {
    const n = childName.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser().database.from('bank_categories').insert([{ name: n, parent_id: parentId }])
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setChildName('')
    setAddingChildFor(null)
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
    const { error: err } = await getInsforgeBrowser().database.from('bank_categories').update({ kind: newKind }).eq('id', id)
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

  async function clearAll() {
    if (!confirm('¿Eliminar TODAS las categorías? Los movimientos quedarán sin categoría.')) return
    setBusy(true)
    setError(null)
    const { error: err } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await reload()
  }

  const roots = (kind: 'expense' | 'income') => categories.filter((c) => !c.parent_id && c.kind === kind)
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id)

  function Section({ kind, title }: { kind: 'expense' | 'income'; title: string }) {
    const list = roots(kind)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">{title}</h2>
        <ul className="divide-y divide-slate-100">
          {list.map((c) => (
            <li key={c.id}>
              <ul>
                <CategoryRow category={c} busy={busy} onRename={onRename} onChangeKind={onChangeKind} onRemove={onRemove} />
                {childrenOf(c.id).map((ch) => (
                  <SubcategoryRow key={ch.id} category={ch} busy={busy} onRename={onRename} onRemove={onRemove} />
                ))}
              </ul>
              {addingChildFor === c.id ? (
                <div className="mb-2 flex items-center gap-2 pl-6">
                  <input
                    autoFocus
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addSubcategory(c.id)
                    }}
                    placeholder="Nueva subcategoría…"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => addSubcategory(c.id)}
                    disabled={busy || !childName.trim()}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingChildFor(null)
                      setChildName('')
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddingChildFor(c.id)
                    setChildName('')
                  }}
                  className="mb-2 pl-6 text-xs font-medium text-emerald-700 hover:underline"
                >
                  + Subcategoría
                </button>
              )}
            </li>
          ))}
          {list.length === 0 && <li className="py-2 text-sm text-slate-400">Sin categorías.</li>}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Nueva categoría o subcategoría</h2>
        <CategoryCreator categories={categories} onCreated={(c) => setCategories((cs) => [...cs, c])} />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-400">Las subcategorías heredan el tipo (gasto/ingreso) de su categoría.</p>
          <button
            type="button"
            onClick={clearAll}
            disabled={busy || categories.length === 0}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Vaciar todas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section kind="expense" title="Gastos" />
        <Section kind="income" title="Ingresos" />
      </div>
    </div>
  )
}

'use client'

import { Fragment, useState } from 'react'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { BankCategory } from '@/lib/types'

const input =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function rootsOf(categories: BankCategory[], kind: 'expense' | 'income') {
  return categories
    .filter((c) => !c.parent_id && c.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function childrenOf(categories: BankCategory[], parentId: string) {
  return categories
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

/** Opciones <option> para un <select>, con subcategorías indentadas bajo su categoría. */
export function CategoryOptions({ categories, kind }: { categories: BankCategory[]; kind: 'expense' | 'income' }) {
  return (
    <>
      {rootsOf(categories, kind).map((root) => (
        <Fragment key={root.id}>
          <option value={root.id}>{root.name}</option>
          {childrenOf(categories, root.id).map((child) => (
            <option key={child.id} value={child.id}>
              {'\u00A0\u00A0— '}
              {child.name}
            </option>
          ))}
        </Fragment>
      ))}
    </>
  )
}

export function CategoryCreator({
  categories,
  defaultKind = 'expense',
  onCreated,
}: {
  categories: BankCategory[]
  defaultKind?: 'expense' | 'income'
  onCreated: (category: BankCategory) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>(defaultKind)
  const [parent, setParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roots = rootsOf(categories, kind)

  async function create() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await getInsforgeBrowser()
      .database.from('bank_categories')
      .insert([{ name: n, kind, parent_id: parent || null }])
      .select('id, name, kind, color, sort_order, parent_id')
      .single()
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setName('')
    setParent('')
    if (data) onCreated(data as BankCategory)
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} min-w-[140px] flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={parent ? 'Nueva subcategoría…' : 'Nueva categoría…'}
        />
        <select
          className={input}
          value={kind}
          onChange={(e) => setKind(e.target.value as 'expense' | 'income')}
          disabled={!!parent}
          title={parent ? 'El tipo lo hereda de la categoría padre' : undefined}
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>
        <select className={input} value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">Categoría raíz</option>
          {roots.map((r) => (
            <option key={r.id} value={r.id}>
              Subcategoría de {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? 'Creando…' : 'Crear'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

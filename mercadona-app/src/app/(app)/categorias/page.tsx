import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { BankCategory } from '@/lib/types'
import { CategoryManager } from '@/components/CategoryManager'

export default async function CategoriasPage() {
  const insforge = createInsForgeServerClient()
  const { data } = await insforge.database
    .from('bank_categories')
    .select('id, name, kind, color, sort_order')
    .order('kind')
    .order('sort_order')

  const categories = (data ?? []) as BankCategory[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categorías</h1>
        <Link href="/movimientos" className="text-sm text-emerald-700 hover:underline">
          ← Movimientos
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Tipos de gasto e ingreso que puedes asignar a los movimientos bancarios.
      </p>
      <CategoryManager initial={categories} />
    </div>
  )
}

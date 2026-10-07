import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { BankCategory } from '@/lib/types'
import { Classifier, type ClassifierMovement } from '@/components/Classifier'

export default async function ClasificarPage() {
  const insforge = createInsForgeServerClient()
  const [movsRes, catsRes] = await Promise.all([
    insforge.database
      .from('bank_transactions')
      .select('id, operation_date, description, concept, amount, category_id')
      .order('operation_date', { ascending: false })
      .limit(1000),
    insforge.database
      .from('bank_categories')
      .select('id, name, kind, color, sort_order')
      .order('kind')
      .order('sort_order'),
  ])

  const movements = (movsRes.data ?? []) as ClassifierMovement[]
  const categories = (catsRes.data ?? []) as BankCategory[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clasificar movimientos</h1>
        <Link href="/categorias" className="text-sm text-emerald-700 hover:underline">
          Categorías →
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Asigna una categoría a cada movimiento y vincula los tickets y facturas que tienes archivados.
      </p>
      <Classifier movements={movements} categories={categories} />
    </div>
  )
}

'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function YearFilter({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('year') ?? ''

  function set(year: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (year) params.set('year', year)
    else params.delete('year')
    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  if (years.length === 0) return null

  const options = [{ label: 'Todos', value: '' }, ...years.map((y) => ({ label: String(y), value: String(y) }))]

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por año">
      <span className="mr-1 text-xs font-medium text-slate-500">Año:</span>
      {options.map((o) => {
        const active = current === o.value
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => set(o.value)}
            aria-pressed={active}
            className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
              active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

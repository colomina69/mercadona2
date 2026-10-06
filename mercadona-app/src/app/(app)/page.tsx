import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import { eur, dateOnly } from '@/lib/format'

type Section = {
  href: string
  emoji: string
  title: string
  description: string
  accent: string
}

const SECTIONS: Section[] = [
  {
    href: '/mercadona',
    emoji: '🥕',
    title: 'Mercadona',
    description: 'Tickets, productos y gasto',
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    href: '/facturas',
    emoji: '⚡',
    title: 'Iberdrola',
    description: 'Facturas y contratos de luz',
    accent: 'bg-amber-50 text-amber-700',
  },
  {
    href: '/combustible',
    emoji: '⛽',
    title: 'Combustible',
    description: 'Repostajes Waylet',
    accent: 'bg-sky-50 text-sky-700',
  },
  {
    href: '/movimientos',
    emoji: '🏦',
    title: 'Cuenta',
    description: 'Movimientos y categorías',
    accent: 'bg-violet-50 text-violet-700',
  },
]

export default async function HomePage() {
  const insforge = createInsForgeServerClient()
  const { data } = await insforge.database
    .from('bank_account_balances')
    .select('account_iban, account_name, balance, currency, as_of')
    .order('as_of', { ascending: false })
    .limit(1)
  const snapshot = (data?.[0] ?? null) as { balance: number | null; as_of: string | null } | null
  const sections = snapshot
    ? SECTIONS.map((s) =>
        s.href === '/movimientos'
          ? { ...s, description: `Saldo ${eur(snapshot.balance)} · ${dateOnly(snapshot.as_of)}` }
          : s,
      )
    : SECTIONS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mis gastos</h1>
        <p className="mt-1 text-sm text-slate-500">Elige un apartado para empezar.</p>
      </div>

      <nav aria-label="Apartados" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99]"
          >
            <span
              aria-hidden
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${section.accent}`}
            >
              {section.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900">{section.title}</span>
              <span className="block text-sm text-slate-500">{section.description}</span>
            </span>
            <span aria-hidden className="shrink-0 text-xl text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-400">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

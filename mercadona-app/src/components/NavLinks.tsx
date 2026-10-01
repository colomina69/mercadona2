'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: 'Resumen',
    links: [{ href: '/', label: 'Dashboard' }],
  },
  {
    label: 'Mercadona',
    links: [
      { href: '/tickets', label: 'Tickets' },
      { href: '/productos', label: 'Productos' },
    ],
  },
  {
    label: 'Iberdrola',
    links: [
      { href: '/facturas', label: 'Facturas' },
      { href: '/contratos', label: 'Contratos' },
    ],
  },
  {
    label: 'Bancos',
    links: [
      { href: '/movimientos', label: 'Movimientos' },
      { href: '/categorias', label: 'Categorías' },
    ],
  },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Principal"
      className="no-scrollbar -mx-4 flex items-stretch gap-2 overflow-x-auto px-4 pb-2 text-sm font-medium"
    >
      {GROUPS.map((group, index) => (
        <div key={group.label} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-slate-200" />}
          <span className="shrink-0 pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </span>
          {group.links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-lg px-3 transition-colors ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

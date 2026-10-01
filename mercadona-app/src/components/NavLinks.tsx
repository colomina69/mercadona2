'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/productos', label: 'Productos' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/facturas', label: 'Facturas' },
  { href: '/contratos', label: 'Contratos' },
  { href: '/categorias', label: 'Categorías' },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Principal"
      className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 text-sm font-medium"
    >
      {LINKS.map((link) => {
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
    </nav>
  )
}

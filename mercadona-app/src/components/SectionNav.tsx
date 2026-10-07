'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Section = {
  key: string
  label: string
  links: { href: string; label: string }[]
}

const SECTIONS: Section[] = [
  {
    key: 'mercadona',
    label: 'Mercadona',
    links: [
      { href: '/mercadona', label: 'Resumen' },
      { href: '/tickets', label: 'Tickets' },
      { href: '/productos', label: 'Productos' },
    ],
  },
  {
    key: 'iberdrola',
    label: 'Iberdrola',
    links: [
      { href: '/facturas', label: 'Facturas' },
      { href: '/contratos', label: 'Contratos' },
    ],
  },
  {
    key: 'combustible',
    label: 'Combustible',
    links: [{ href: '/combustible', label: 'Repostajes' }],
  },
  {
    key: 'cuenta',
    label: 'Cuenta',
    links: [
      { href: '/movimientos', label: 'Movimientos' },
      { href: '/clasificar', label: 'Clasificar' },
      { href: '/categorias', label: 'Categorías' },
    ],
  },
]

function isActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SectionNav() {
  const pathname = usePathname()
  const section = SECTIONS.find((group) => group.links.some((link) => isActive(link.href, pathname)))

  if (!section) return null

  return (
    <nav
      aria-label={`Sección ${section.label}`}
      className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-2"
    >
      {section.links.map((link) => {
        const active = isActive(link.href, pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
              active
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

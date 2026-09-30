import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import { signOutAction } from '@/app/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const insforge = createInsForgeServerClient()
  const { data } = await insforge.auth.getCurrentUser()
  const user = data?.user

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-emerald-700">🥕 Tickets Mercadona</span>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/tickets" className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Tickets
              </Link>
              <Link href="/productos" className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Productos
              </Link>
              <Link href="/movimientos" className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Movimientos
              </Link>
              <Link href="/categorias" className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Categorías
              </Link>
            </nav>
          </div>
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">{user.email}</span>
            <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

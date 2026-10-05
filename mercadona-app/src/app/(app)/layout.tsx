import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import { signOutAction } from '@/app/actions'
import { SectionNav } from '@/components/SectionNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const insforge = createInsForgeServerClient()
  const { data } = await insforge.auth.getCurrentUser()
  const user = data?.user

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between gap-3 pt-3">
            <Link
              href="/"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <span aria-hidden>🏠</span> Inicio
            </Link>
            <form action={signOutAction} className="flex shrink-0 items-center gap-3">
              <span className="hidden text-xs text-slate-400 sm:inline">{user.email}</span>
              <button className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
                Salir
              </button>
            </form>
          </div>
          <SectionNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

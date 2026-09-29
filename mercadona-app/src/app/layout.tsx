import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tickets Mercadona',
  description: 'Consulta tus tickets de Mercadona, sus productos y la evolución de precios',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}

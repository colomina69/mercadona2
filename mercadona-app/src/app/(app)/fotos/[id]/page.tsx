import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { PhotoTicket, PhotoTicketLine } from '@/lib/types'
import { PdfButton } from '@/components/PdfButton'
import { TicketPhotoEditor } from '@/components/TicketPhotoEditor'

export default async function FotoDetailPage({ params }: { params: { id: string } }) {
  const insforge = createInsForgeServerClient()

  const { data: tData } = await insforge.database.from('photo_tickets').select('*').eq('id', params.id).maybeSingle()
  const ticket = (tData ?? null) as PhotoTicket | null
  if (!ticket) notFound()

  const { data: lData } = await insforge.database
    .from('photo_ticket_lines')
    .select('*')
    .eq('ticket_id', params.id)
    .order('line_no')
  const lines = (lData ?? []) as PhotoTicketLine[]

  return (
    <div className="space-y-4">
      <Link href="/fotos" className="text-sm text-emerald-700 hover:underline">
        ← Volver a tickets por foto
      </Link>

      <h1 className="text-xl font-semibold">{ticket.store_name ?? 'Ticket'}</h1>

      {ticket.image_key ? <PdfButton pdfKey={ticket.image_key} bucket="receipts" label="Ver foto original" /> : null}

      <TicketPhotoEditor ticket={ticket} lines={lines} />

      {ticket.raw_text ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">Texto OCR</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{ticket.raw_text}</pre>
        </details>
      ) : null}
    </div>
  )
}

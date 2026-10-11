'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInsforgeBrowser } from '@/lib/insforge/client'
import type { PhotoTicket, PhotoTicketLine } from '@/lib/types'

type LineDraft = {
  product_name: string
  quantity: string
  unit: string
  unit_price: string
  amount: string
}

function toNum(v: string): number | null {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

export function TicketPhotoEditor({
  ticket,
  lines,
}: {
  ticket: PhotoTicket
  lines: PhotoTicketLine[]
}) {
  const router = useRouter()
  const [storeName, setStoreName] = useState(ticket.store_name ?? '')
  const [ticketNumber, setTicketNumber] = useState(ticket.ticket_number ?? '')
  const [purchasedAt, setPurchasedAt] = useState((ticket.purchased_at ?? '').slice(0, 10))
  const [total, setTotal] = useState(ticket.total != null ? String(ticket.total) : '')
  const [subtotal, setSubtotal] = useState(ticket.subtotal != null ? String(ticket.subtotal) : '')
  const [notes, setNotes] = useState(ticket.notes ?? '')
  const [status, setStatus] = useState(ticket.status === 'revisado' ? 'revisado' : 'pendiente')
  const [draftLines, setDraftLines] = useState<LineDraft[]>(
    lines.length
      ? lines.map((l) => ({
          product_name: l.product_name ?? '',
          quantity: l.quantity != null ? String(l.quantity) : '',
          unit: l.unit ?? '',
          unit_price: l.unit_price != null ? String(l.unit_price) : '',
          amount: l.amount != null ? String(l.amount) : '',
        }))
      : [{ product_name: '', quantity: '', unit: '', unit_price: '', amount: '' }],
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function setLine(i: number, key: keyof LineDraft, value: string) {
    setDraftLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)))
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    const p_lines = draftLines
      .filter((l) => l.product_name.trim() || toNum(l.amount) != null)
      .map((l, i) => ({
        line_no: i + 1,
        product_name: l.product_name.trim() || null,
        quantity: toNum(l.quantity),
        unit: l.unit.trim() || null,
        unit_price: toNum(l.unit_price),
        amount: toNum(l.amount),
      }))
    const { error } = await getInsforgeBrowser().database.rpc('photo_ticket_update', {
      p_id: ticket.id,
      p_fields: {
        store_name: storeName.trim() || null,
        ticket_number: ticketNumber.trim() || null,
        purchased_at: purchasedAt || null,
        total: toNum(total),
        subtotal: toNum(subtotal),
        notes: notes.trim() || null,
        status,
      },
      p_lines,
    })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('Guardado')
    router.refresh()
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 sm:col-span-1 text-sm">
          <span className="text-slate-500">Tienda</span>
          <input className={inputCls} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Nº ticket</span>
          <input className={inputCls} value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Fecha</span>
          <input type="date" className={inputCls} value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Subtotal</span>
          <input inputMode="decimal" className={inputCls} value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Total</span>
          <input inputMode="decimal" className={inputCls} value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Estado</span>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pendiente">pendiente</option>
            <option value="revisado">revisado</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-slate-500">Notas</span>
        <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-600">Líneas</h3>
          <button
            type="button"
            onClick={() => setDraftLines((ls) => [...ls, { product_name: '', quantity: '', unit: '', unit_price: '', amount: '' }])}
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            + Añadir
          </button>
        </div>
        <div className="space-y-2">
          {draftLines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className={`${inputCls} col-span-5`} placeholder="Producto" value={l.product_name} onChange={(e) => setLine(i, 'product_name', e.target.value)} />
              <input className={`${inputCls} col-span-2`} placeholder="Cant." inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} />
              <input className={`${inputCls} col-span-1`} placeholder="ud" value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} />
              <input className={`${inputCls} col-span-2`} placeholder="Precio" inputMode="decimal" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} />
              <input className={`${inputCls} col-span-2`} placeholder="Importe" inputMode="decimal" value={l.amount} onChange={(e) => setLine(i, 'amount', e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  )
}

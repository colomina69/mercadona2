'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadTicketPhotoAction } from '@/app/actions'

export function TicketPhotoUploader() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setBusy(true)
    setError(null)
    setStatus('Analizando el ticket con IA…')
    try {
      const fd = new FormData()
      fd.append('file', file, file.name || 'ticket.jpg')
      const res = await uploadTicketPhotoAction(fd)
      if (!res.ok || !res.id) {
        setError(res.error ?? 'No se pudo guardar la foto')
        setBusy(false)
        setStatus(null)
        return
      }
      router.push(`/fotos/${res.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error procesando la imagen')
      setBusy(false)
      setStatus(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">
        Haz una foto al ticket; un agente de IA extrae los datos y podrás revisarlos y completarlos.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          📷 Foto de ticket
        </button>
        {status && <span className="text-sm text-slate-500">{status}</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

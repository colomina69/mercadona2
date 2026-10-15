'use client'

import { useState } from 'react'
import { getInsforgeBrowser } from '@/lib/insforge/client'

export function ImageButton({ imageKey, bucket = 'receipts', label = 'Ver foto original' }: { imageKey: string; bucket?: string; label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  async function open() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await getInsforgeBrowser().storage.from(bucket).download(imageKey)
      if (error || !data) {
        setError(error?.message ?? 'No se pudo descargar la imagen')
        setLoading(false)
        return
      }
      setUrl(URL.createObjectURL(data as Blob))
    } catch {
      setError('Error al abrir la imagen')
    }
    setLoading(false)
  }

  function close() {
    setUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? 'Abriendo…' : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-lg font-bold text-slate-800 hover:bg-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

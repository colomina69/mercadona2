'use client'

import { useState } from 'react'
import { getInsforgeBrowser } from '@/lib/insforge/client'

export function PdfButton({ pdfKey }: { pdfKey: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setLoading(true)
    setError(null)
    try {
      const insforge = getInsforgeBrowser()
      const { data, error } = await insforge.storage.from('mercadona').download(pdfKey)
      if (error || !data) {
        setError(error?.message ?? 'No se pudo descargar el PDF')
        setLoading(false)
        return
      }
      const url = URL.createObjectURL(data as Blob)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Error al abrir el PDF')
    }
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {loading ? 'Abriendo…' : 'Ver PDF original'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

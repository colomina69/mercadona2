'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadBankFileAction } from '@/app/actions'

export function BankUploadForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Selecciona un fichero .txt')
      return
    }

    setLoading(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const res = await uploadBankFileAction(formData)
    setLoading(false)

    if (!res.ok) {
      setError(res.error ?? 'No se pudo procesar el fichero.')
      return
    }

    setMessage(
      `Fichero procesado: ${res.inserted ?? 0} movimientos nuevos, ${res.skipped ?? 0} ya existentes (de ${res.total ?? 0}).`,
    )
    if (inputRef.current) inputRef.current.value = ''
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Subir extracto bancario (.txt)</h2>
      <p className="mb-3 text-xs text-slate-500">
        Se envía al webhook de n8n, se guarda el fichero original y se importan los movimientos (sin duplicados).
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="w-full flex-1 cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? 'Procesando…' : 'Importar'}
        </button>
      </div>

      {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </form>
  )
}

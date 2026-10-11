'use server'

import { cookies } from 'next/headers'
import { createAuthActions } from '@insforge/sdk/ssr'

export async function signInAction(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const auth = createAuthActions({ cookies: cookies() })
  const { error } = await auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message || 'No se pudo iniciar sesión' }
  }
  return {}
}

export async function signUpAction(
  email: string,
  password: string,
  name?: string,
): Promise<{ error?: string; needsVerification?: boolean }> {
  const auth = createAuthActions({ cookies: cookies() })
  const { data, error } = await auth.signUp({ email, password, name })
  if (error) {
    return { error: error.message || 'No se pudo crear la cuenta' }
  }
  return { needsVerification: Boolean((data as { requireEmailVerification?: boolean } | null)?.requireEmailVerification) }
}

export async function signOutAction(): Promise<void> {
  const auth = createAuthActions({ cookies: cookies() })
  await auth.signOut()
}

export type BankUploadResult = {
  ok: boolean
  inserted?: number
  skipped?: number
  total?: number
  error?: string
}

export async function uploadBankFileAction(formData: FormData): Promise<BankUploadResult> {
  const url = process.env.N8N_BANK_WEBHOOK_URL
  const token = process.env.N8N_BANK_WEBHOOK_TOKEN

  if (!url || !token) {
    return { ok: false, error: 'Falta configurar N8N_BANK_WEBHOOK_URL / N8N_BANK_WEBHOOK_TOKEN en el entorno.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona un fichero .txt válido.' }
  }

  const remote = new FormData()
  remote.append('file', file, file.name)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Webhook-Token': token },
      body: remote,
      cache: 'no-store',
    })
    const text = await res.text()
    let data: BankUploadResult | null = null
    try {
      data = text ? (JSON.parse(text) as BankUploadResult) : null
    } catch {
      data = null
    }

    if (!res.ok) {
      return { ok: false, error: data?.error ?? `El webhook respondió con estado ${res.status}.` }
    }

    return {
      ok: true,
      inserted: data?.inserted ?? 0,
      skipped: data?.skipped ?? 0,
      total: data?.total ?? 0,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error llamando al webhook.' }
  }
}

export type TicketPhotoResult = {
  ok: boolean
  id?: string
  error?: string
}

export async function uploadTicketPhotoAction(formData: FormData): Promise<TicketPhotoResult> {
  const url = process.env.N8N_PHOTO_WEBHOOK_URL
  const token = process.env.N8N_PHOTO_WEBHOOK_TOKEN

  if (!url || !token) {
    return { ok: false, error: 'Falta configurar N8N_PHOTO_WEBHOOK_URL / N8N_PHOTO_WEBHOOK_TOKEN en el entorno.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona una imagen válida.' }
  }
  const rawText = String(formData.get('raw_text') ?? '')

  const remote = new FormData()
  remote.append('data', file, file.name || 'ticket.jpg')
  remote.append('raw_text', rawText)
  remote.append('captured_at', new Date().toISOString())

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-webhook-token': token },
      body: remote,
      cache: 'no-store',
    })
    const text = await res.text()
    let data: TicketPhotoResult | null = null
    try {
      data = text ? (JSON.parse(text) as TicketPhotoResult) : null
    } catch {
      data = null
    }
    if (!res.ok || !data?.ok || !data.id) {
      return { ok: false, error: data?.error ?? `El webhook respondió con estado ${res.status}.` }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error llamando al webhook.' }
  }
}

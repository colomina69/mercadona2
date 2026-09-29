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

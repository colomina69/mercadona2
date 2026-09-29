import { cookies } from 'next/headers'
import { createServerClient } from '@insforge/sdk/ssr'

export function createInsForgeServerClient() {
  return createServerClient({ cookies: cookies() })
}

'use client'

import { createBrowserClient } from '@insforge/sdk/ssr'

type BrowserClient = ReturnType<typeof createBrowserClient>

let client: BrowserClient | null = null

export function getInsforgeBrowser(): BrowserClient {
  if (!client) {
    client = createBrowserClient()
  }
  return client
}

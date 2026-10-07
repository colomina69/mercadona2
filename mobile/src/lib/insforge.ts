import { createAdminClient } from '@insforge/sdk'

const baseUrl = process.env.EXPO_PUBLIC_INSFORGE_URL
const apiKey = process.env.EXPO_PUBLIC_INSFORGE_API_KEY

if (!baseUrl || !apiKey) {
  throw new Error(
    'Faltan EXPO_PUBLIC_INSFORGE_URL / EXPO_PUBLIC_INSFORGE_API_KEY. Copia .env.example a .env.',
  )
}

export const INSFORGE_BASE_URL: string = baseUrl

export const INSFORGE_API_KEY: string = apiKey

export const insforge = createAdminClient({ baseUrl, apiKey })

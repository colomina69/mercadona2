import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Text, View } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { INSFORGE_API_KEY, INSFORGE_BASE_URL } from '@/lib/insforge'
import { colors } from '@/lib/theme'

export default function FotoViewerScreen() {
  const params = useLocalSearchParams<{ bucket: string; key: string; title?: string }>()
  const bucket = params.bucket ?? 'receipts'
  const key = params.key ?? ''
  const [uri, setUri] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (!key) throw new Error('Falta la clave de la imagen')
        const name = (key.split('/').pop() || 'foto.jpg').replace(/[^\w.\-]+/g, '_')
        const dest = `${FileSystem.cacheDirectory}${name}`
        const url = `${INSFORGE_BASE_URL}/api/storage/buckets/${bucket}/objects/${encodeURIComponent(key)}`
        const res = await FileSystem.downloadAsync(url, dest, {
          headers: { Authorization: `Bearer ${INSFORGE_API_KEY}` },
        })
        if (res.status !== 200) throw new Error(`No se pudo descargar (HTTP ${res.status})`)
        if (active) setUri(res.uri)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error al abrir la imagen')
      }
    })()
    return () => {
      active = false
    }
  }, [bucket, key])

  return (
    <>
      <Stack.Screen options={{ title: params.title ?? 'Foto' }} />
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
          </View>
        ) : uri ? (
          <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.emerald} />
          </View>
        )}
      </View>
    </>
  )
}

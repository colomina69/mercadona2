import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { INSFORGE_API_KEY, INSFORGE_BASE_URL } from '@/lib/insforge'
import { colors, radius } from '@/lib/theme'

function objectUrl(bucket: string, key: string): string {
  return `${INSFORGE_BASE_URL}/api/storage/buckets/${bucket}/objects/${encodeURIComponent(key)}`
}

export function ImageButton({
  imageKey,
  bucket,
  label = 'Ver foto original',
}: {
  imageKey: string | null
  bucket: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!imageKey) return null
  const key = imageKey

  async function share() {
    setBusy(true)
    setError(null)
    try {
      const name = (key.split('/').pop() || 'foto.jpg').replace(/[^\w.\-]+/g, '_')
      const file = new File(Paths.cache, name)
      await File.downloadFileAsync(objectUrl(bucket, key), file, {
        headers: { Authorization: `Bearer ${INSFORGE_API_KEY}` },
        idempotent: true,
      })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { dialogTitle: name })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir la foto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => router.push({ pathname: '/foto', params: { bucket, key, title: label } })}
        style={({ pressed }) => [
          {
            minHeight: 48,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.emerald,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>🖼️ {label}</Text>
      </Pressable>

      <Pressable onPress={share} disabled={busy} style={{ alignSelf: 'center', paddingVertical: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{busy ? 'Preparando…' : 'Compartir / guardar'}</Text>
      </Pressable>

      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  )
}

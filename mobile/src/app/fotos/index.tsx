import { Link, Stack, router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { File } from 'expo-file-system'
import { Badge, Card, Empty, ErrorBox, Loading, Screen } from '@/components/ui'
import { dateOnly, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { PhotoTicket } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const WEBHOOK_URL = process.env.EXPO_PUBLIC_N8N_PHOTO_WEBHOOK_URL
const WEBHOOK_TOKEN = process.env.EXPO_PUBLIC_N8N_PHOTO_WEBHOOK_TOKEN

export default function FotosScreen() {
  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await insforge.database
      .from('photo_tickets')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(200)
    if (error) throw new Error(error.message)
    return (data ?? []) as PhotoTicket[]
  })

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function send(uri: string, fileName: string | null, mimeType: string | null) {
    if (!WEBHOOK_URL || !WEBHOOK_TOKEN) {
      setMsg('Falta configurar el webhook de fotos (.env).')
      return
    }
    setBusy(true)
    setMsg('Analizando el ticket con IA…')
    try {
      const form = new FormData()
      const file = new File(uri)
      form.append('data', file as unknown as Blob, fileName || 'ticket.jpg')
      form.append('captured_at', new Date().toISOString())
      const resp = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'x-webhook-token': WEBHOOK_TOKEN }, body: form })
      const json = (await resp.json()) as { ok?: boolean; id?: string; error?: string }
      setBusy(false)
      setMsg(null)
      if (json?.ok && json.id) {
        reload()
        router.push(`/fotos/${json.id}`)
      } else {
        setMsg(json?.error ?? 'No se pudo guardar la foto')
      }
    } catch (e) {
      setBusy(false)
      setMsg(e instanceof Error ? e.message : 'Error subiendo la foto')
    }
  }

  async function pickCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setMsg('Permiso de cámara denegado')
      return
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (res.canceled) return
    const a = res.assets[0]
    await send(a.uri, a.fileName ?? null, a.mimeType ?? null)
  }

  async function pickGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setMsg('Permiso de galería denegado')
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    if (res.canceled) return
    const a = res.assets[0]
    await send(a.uri, a.fileName ?? null, a.mimeType ?? null)
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Tickets por foto' }} />
      <Screen>
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Fotografía el ticket; un agente de IA extrae los datos y podrás revisarlos y completarlos.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={pickCamera}
              disabled={busy}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>📷 Cámara</Text>
            </Pressable>
            <Pressable
              onPress={pickGallery}
              disabled={busy}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>🖼️ Galería</Text>
            </Pressable>
          </View>
          {msg ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>{msg}</Text> : null}
        </Card>

        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty message="Aún no hay fotos" /> : (
          data.map((t) => (
            <Link key={t.id} href={`/fotos/${t.id}`} asChild>
              <Pressable>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{t.store_name ?? 'Ticket'}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {dateOnly(t.purchased_at ?? t.captured_at)}
                        {t.ticket_number ? ` · ${t.ticket_number}` : ''}
                      </Text>
                      <View style={{ marginTop: 6 }}>
                        <Badge text={t.status} tone={t.status === 'revisado' ? 'green' : 'amber'} />
                      </View>
                    </View>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{eur(t.total)}</Text>
                  </View>
                </Card>
              </Pressable>
            </Link>
          ))
        )}
      </Screen>
    </>
  )
}

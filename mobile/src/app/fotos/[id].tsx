import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Badge, Card, Empty, ErrorBox, Field, Loading, PrimaryButton, Screen, SectionTitle } from '@/components/ui'
import { ImageButton } from '@/components/ImageButton'
import { insforge } from '@/lib/insforge'
import type { PhotoTicket, PhotoTicketCategory, PhotoTicketLine } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

type LineDraft = {
  product_name: string
  quantity: string
  unit: string
  unit_price: string
  amount: string
  category_id: string
}

function toNum(v: string): number | null {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isNaN(n) ? null : n
}

export default function FotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const [t, l, c] = await Promise.all([
      insforge.database.from('photo_tickets').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('photo_ticket_lines').select('*').eq('ticket_id', id).order('line_no'),
      insforge.database.from('photo_ticket_categories').select('id, name, color, sort_order').order('sort_order').order('name'),
    ])
    if (t.error) throw new Error(t.error.message)
    return {
      ticket: t.data as PhotoTicket | null,
      lines: (l.data ?? []) as PhotoTicketLine[],
      categories: (c.data ?? []) as PhotoTicketCategory[],
    }
  }, [id])

  const ticket = data?.ticket
  const lines = data?.lines ?? []
  const cats = data?.categories ?? []

  const [storeName, setStoreName] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)
  const [purchasedAt, setPurchasedAt] = useState<string | null>(null)
  const [subtotal, setSubtotal] = useState<string | null>(null)
  const [total, setTotal] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [draft, setDraft] = useState<LineDraft[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [pickerLine, setPickerLine] = useState<number | null>(null)
  const [newCat, setNewCat] = useState('')

  const vStore = storeName ?? ticket?.store_name ?? ''
  const vNumber = ticketNumber ?? ticket?.ticket_number ?? ''
  const vDate = purchasedAt ?? (ticket?.purchased_at ?? '').slice(0, 10)
  const vSubtotal = subtotal ?? (ticket?.subtotal != null ? String(ticket.subtotal) : '')
  const vTotal = total ?? (ticket?.total != null ? String(ticket.total) : '')
  const vNotes = notes ?? ticket?.notes ?? ''
  const vStatus = status ?? (ticket?.status === 'revisado' ? 'revisado' : 'pendiente')
  const vLines: LineDraft[] =
    draft ??
    (lines.length
      ? lines.map((l) => ({
          product_name: l.product_name ?? '',
          quantity: l.quantity != null ? String(l.quantity) : '',
          unit: l.unit ?? '',
          unit_price: l.unit_price != null ? String(l.unit_price) : '',
          amount: l.amount != null ? String(l.amount) : '',
          category_id: l.category_id ?? '',
        }))
      : [{ product_name: '', quantity: '', unit: '', unit_price: '', amount: '', category_id: '' }])

  const catName = (cid: string) => cats.find((c) => c.id === cid)?.name ?? 'Sin categoría'

  function setLine(i: number, key: keyof LineDraft, value: string) {
    setDraft(vLines.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)))
  }

  async function addCategory() {
    const name = newCat.trim()
    if (!name) return
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database.from('photo_ticket_categories').insert([{ name }])
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setNewCat('')
    setPickerLine(null)
    reload()
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    const p_lines = vLines
      .filter((l) => l.product_name.trim() || toNum(l.amount) != null)
      .map((l, i) => ({
        line_no: i + 1,
        product_name: l.product_name.trim() || null,
        quantity: toNum(l.quantity),
        unit: l.unit.trim() || null,
        unit_price: toNum(l.unit_price),
        amount: toNum(l.amount),
        category_id: l.category_id || null,
      }))
    const { error } = await insforge.database.rpc('photo_ticket_update', {
      p_id: id,
      p_fields: {
        store_name: vStore.trim() || null,
        ticket_number: vNumber.trim() || null,
        purchased_at: vDate || null,
        total: toNum(vTotal),
        subtotal: toNum(vSubtotal),
        notes: vNotes.trim() || null,
        status: vStatus,
      },
      p_lines,
    })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('Guardado')
    reload()
  }

  return (
    <>
      <Stack.Screen options={{ title: ticket?.store_name ?? 'Ticket' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !ticket ? <Empty /> : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Badge text={vStatus} tone={vStatus === 'revisado' ? 'green' : 'amber'} />
            </View>

            {ticket.image_key ? <ImageButton imageKey={ticket.image_key} bucket="receipts" label="Ver foto original" /> : null}

            <SectionTitle>Datos</SectionTitle>
            <Card>
              <Field label="Tienda" value={vStore} onChangeText={setStoreName} />
              <Field label="Nº ticket" value={vNumber} onChangeText={setTicketNumber} />
              <Field label="Fecha (AAAA-MM-DD)" value={vDate} onChangeText={setPurchasedAt} autoCapitalize="none" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Subtotal" value={vSubtotal} onChangeText={setSubtotal} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Total" value={vTotal} onChangeText={setTotal} keyboardType="decimal-pad" /></View>
              </View>
              <Field label="Notas" value={vNotes} onChangeText={setNotes} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {(['pendiente', 'revisado'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: vStatus === s ? colors.emerald : '#eef2f6' }}
                  >
                    <Text style={{ color: vStatus === s ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <SectionTitle>Líneas</SectionTitle>
            <Card>
              {vLines.map((l, i) => (
                <View key={i} style={{ gap: 6, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }}>
                  <Field label="Producto" value={l.product_name} onChangeText={(t) => setLine(i, 'product_name', t)} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}><Field label="Cant." value={l.quantity} onChangeText={(t) => setLine(i, 'quantity', t)} keyboardType="decimal-pad" /></View>
                    <View style={{ flex: 1 }}><Field label="Ud" value={l.unit} onChangeText={(t) => setLine(i, 'unit', t)} /></View>
                    <View style={{ flex: 1 }}><Field label="Precio" value={l.unit_price} onChangeText={(t) => setLine(i, 'unit_price', t)} keyboardType="decimal-pad" /></View>
                    <View style={{ flex: 1 }}><Field label="Importe" value={l.amount} onChangeText={(t) => setLine(i, 'amount', t)} keyboardType="decimal-pad" /></View>
                  </View>
                  <Pressable
                    onPress={() => setPickerLine(i)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f8fafc' }}
                  >
                    <Text style={{ color: colors.faint, fontSize: 12 }}>Categoría</Text>
                    <Text style={{ color: l.category_id ? colors.text : colors.faint, fontSize: 13, fontWeight: '600' }}>{catName(l.category_id)} ▾</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => setDraft([...vLines, { product_name: '', quantity: '', unit: '', unit_price: '', amount: '', category_id: '' }])}>
                <Text style={{ color: colors.emerald, fontWeight: '600' }}>+ Añadir línea</Text>
              </Pressable>
            </Card>

            <PrimaryButton title="Guardar" onPress={save} loading={busy} />
            {msg ? <Text style={{ color: colors.muted, fontSize: 13 }}>{msg}</Text> : null}

            {ticket.raw_text ? (
              <Card>
                <SectionTitle>Texto OCR</SectionTitle>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{ticket.raw_text}</Text>
              </Card>
            ) : null}
          </>
        )}
      </Screen>

      <Modal visible={pickerLine !== null} transparent animationType="fade" onRequestClose={() => setPickerLine(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerLine(null)} />
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '80%' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Categoría de la línea</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable onPress={() => { if (pickerLine !== null) setLine(pickerLine, 'category_id', ''); setPickerLine(null) }} style={{ paddingVertical: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>Sin categoría</Text>
              </Pressable>
              {cats.map((c) => (
                <Pressable key={c.id} onPress={() => { if (pickerLine !== null) setLine(pickerLine, 'category_id', c.id); setPickerLine(null) }} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TextInput
                value={newCat}
                onChangeText={setNewCat}
                placeholder="Nueva categoría…"
                style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
              />
              <PrimaryButton title="Añadir" onPress={addCategory} disabled={!newCat.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

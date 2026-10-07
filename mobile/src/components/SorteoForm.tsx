import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, Field, PrimaryButton } from '@/components/ui'
import type { Sorteo } from '@/lib/types'
import { colors } from '@/lib/theme'

export type SorteoValues = {
  nombre: string
  fecha: string
  precio: number
  tipo: 'mensual' | 'especial'
  decimos_totales: number | null
}

export function SorteoForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Sorteo
  submitLabel: string
  onSubmit: (values: SorteoValues) => Promise<{ error?: string }>
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [fecha, setFecha] = useState(initial?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [precio, setPrecio] = useState(initial ? String(initial.precio) : '7')
  const [tipo, setTipo] = useState<'mensual' | 'especial'>(initial?.tipo ?? 'mensual')
  const [decimos, setDecimos] = useState(initial?.decimos_totales != null ? String(initial.decimos_totales) : '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit() {
    if (!nombre.trim()) {
      setMsg('El nombre es obligatorio')
      return
    }
    const precioNum = Number(precio.replace(',', '.'))
    if (!precioNum || precioNum <= 0) {
      setMsg('El precio debe ser mayor que 0')
      return
    }
    setBusy(true)
    setMsg(null)
    const res = await onSubmit({
      nombre: nombre.trim(),
      fecha,
      precio: precioNum,
      tipo,
      decimos_totales: decimos.trim() ? Number(decimos) : null,
    })
    setBusy(false)
    if (res.error) setMsg(res.error)
  }

  return (
    <Card>
      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Abril 2026" />
      <Field label="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} placeholder="2026-04-18" autoCapitalize="none" />
      <Field label="Precio (€)" value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" />
      <Field label="Décimos para vender (opcional)" value={decimos} onChangeText={setDecimos} keyboardType="number-pad" />

      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8 }}>Tipo</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {(['mensual', 'especial'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTipo(t)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: tipo === t ? colors.emerald : '#eef2f6' }}
          >
            <Text style={{ color: tipo === t ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
              {t === 'mensual' ? 'Mensual' : 'Extraordinario'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 14 }} />
      <PrimaryButton title={submitLabel} onPress={submit} loading={busy} />
      {msg ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{msg}</Text> : null}
    </Card>
  )
}

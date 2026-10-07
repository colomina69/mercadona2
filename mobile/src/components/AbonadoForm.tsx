import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, Field, PrimaryButton } from '@/components/ui'
import type { Abonado, Grupo } from '@/lib/types'
import { colors } from '@/lib/theme'

export type AbonadoValues = {
  nombre: string
  grupos: Grupo[]
  activo: boolean
}

const GRUPOS: { value: Grupo; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'extraordinario', label: 'Extraordinario' },
]

export function AbonadoForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Abonado
  submitLabel: string
  onSubmit: (values: AbonadoValues) => Promise<{ error?: string }>
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [grupos, setGrupos] = useState<Grupo[]>(initial?.grupos ?? ['mensual'])
  const [activo, setActivo] = useState(initial?.activo ?? true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function toggleGrupo(g: Grupo) {
    setGrupos((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  async function submit() {
    if (!nombre.trim()) {
      setMsg('El nombre es obligatorio')
      return
    }
    if (grupos.length === 0) {
      setMsg('Elige al menos un grupo')
      return
    }
    setBusy(true)
    setMsg(null)
    const res = await onSubmit({ nombre: nombre.trim(), grupos, activo })
    setBusy(false)
    if (res.error) setMsg(res.error)
  }

  return (
    <Card>
      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. MARCIAL" />
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8 }}>Grupos</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {GRUPOS.map((g) => {
          const active = grupos.includes(g.value)
          return (
            <Pressable
              key={g.value}
              onPress={() => toggleGrupo(g.value)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? colors.emerald : '#eef2f6' }}
            >
              <Text style={{ color: active ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
                {g.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 12 }}>Estado</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {[
          { value: true, label: 'Activo' },
          { value: false, label: 'Inactivo' },
        ].map((o) => (
          <Pressable
            key={o.label}
            onPress={() => setActivo(o.value)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: activo === o.value ? colors.emerald : '#eef2f6' }}
          >
            <Text style={{ color: activo === o.value ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
              {o.label}
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

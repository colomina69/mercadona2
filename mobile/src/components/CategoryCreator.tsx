import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Field, PrimaryButton } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import type { BankCategory } from '@/lib/types'
import { colors } from '@/lib/theme'

export function CategoryCreator({
  categories,
  defaultKind = 'expense',
  onCreated,
}: {
  categories: BankCategory[]
  defaultKind?: 'expense' | 'income'
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>(defaultKind)
  const [parent, setParent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const roots = categories.filter((c) => !c.parent_id && c.kind === kind)

  function chipStyle(active: boolean) {
    return {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: active ? colors.emerald : '#eef2f6',
    }
  }

  async function create() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database.from('bank_categories').insert([{ name: n, kind, parent_id: parent }])
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setName('')
    setParent(null)
    onCreated()
  }

  return (
    <View style={{ gap: 8 }}>
      <Field label={parent ? 'Nueva subcategoría' : 'Nueva categoría'} value={name} onChangeText={setName} placeholder="Ej. Supermercado" />

      {!parent ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['expense', 'income'] as const).map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={chipStyle(kind === k)}>
              <Text style={{ color: kind === k ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
                {k === 'expense' ? 'Gasto' : 'Ingreso'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={{ color: colors.faint, fontSize: 12 }}>Depende de</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pressable onPress={() => setParent(null)} style={chipStyle(parent === null)}>
          <Text style={{ color: parent === null ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>Raíz</Text>
        </Pressable>
        {roots.map((r) => (
          <Pressable key={r.id} onPress={() => setParent(r.id)} style={chipStyle(parent === r.id)}>
            <Text style={{ color: parent === r.id ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>{r.name}</Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton title={busy ? 'Creando…' : 'Crear'} onPress={create} loading={busy} disabled={!name.trim()} />
      {msg ? <Text style={{ color: colors.danger, fontSize: 12 }}>{msg}</Text> : null}
    </View>
  )
}

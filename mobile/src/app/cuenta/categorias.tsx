import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Field, Loading, PrimaryButton, Screen, SectionMenu, SectionTitle } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import type { BankCategory } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Movimientos', href: '/cuenta/movimientos' },
  { label: 'Categorías', href: '/cuenta/categorias' },
]

export default function CategoriasScreen() {
  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await insforge.database
      .from('bank_categories')
      .select('id, name, kind, color, sort_order')
      .order('kind')
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data ?? []) as BankCategory[]
  })

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database.from('bank_categories').insert([{ name: name.trim(), kind }])
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setName('')
    reload()
  }

  async function remove(id: string) {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database.from('bank_categories').delete().eq('id', id)
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    reload()
  }

  const expenses = (data ?? []).filter((c) => c.kind === 'expense')
  const incomes = (data ?? []).filter((c) => c.kind === 'income')

  return (
    <>
      <Stack.Screen options={{ title: 'Categorías' }} />
      <Screen>
        <SectionMenu items={MENU} active="/cuenta/categorias" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <>
            <SectionTitle>Nueva categoría</SectionTitle>
            <Card>
              <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Supermercado" />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {(['expense', 'income'] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: kind === k ? colors.emerald : '#eef2f6' }}
                  >
                    <Text style={{ color: kind === k ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
                      {k === 'expense' ? 'Gasto' : 'Ingreso'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ height: 12 }} />
              <PrimaryButton title="Añadir" onPress={create} loading={busy} disabled={!name.trim()} />
              {msg ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{msg}</Text> : null}
            </Card>

            <SectionTitle>Gastos ({expenses.length})</SectionTitle>
            {expenses.length === 0 ? <Empty message="Sin categorías" /> : (
              <Card>
                {expenses.map((c) => (
                  <CategoryRow key={c.id} cat={c} onRemove={remove} disabled={busy} />
                ))}
              </Card>
            )}

            <SectionTitle>Ingresos ({incomes.length})</SectionTitle>
            {incomes.length === 0 ? <Empty message="Sin categorías" /> : (
              <Card>
                {incomes.map((c) => (
                  <CategoryRow key={c.id} cat={c} onRemove={remove} disabled={busy} />
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
    </>
  )
}

function CategoryRow({ cat, onRemove, disabled }: { cat: BankCategory; onRemove: (id: string) => void; disabled: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
      <Text style={{ color: colors.text }}>{cat.name}</Text>
      <Pressable onPress={() => onRemove(cat.id)} disabled={disabled}>
        <Text style={{ color: colors.danger, fontSize: 13 }}>Eliminar</Text>
      </Pressable>
    </View>
  )
}

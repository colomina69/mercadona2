import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Screen, SectionMenu, SectionTitle } from '@/components/ui'
import { CategoryCreator } from '@/components/CategoryCreator'
import { insforge } from '@/lib/insforge'
import type { BankCategory } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Movimientos', href: '/cuenta/movimientos' },
  { label: 'Pendientes', href: '/cuenta/pendientes' },
  { label: 'Clasificar', href: '/cuenta/clasificar' },
  { label: 'Categorías', href: '/cuenta/categorias' },
]

export default function CategoriasScreen() {
  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await insforge.database
      .from('bank_categories')
      .select('id, name, kind, color, sort_order, parent_id')
      .order('kind')
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data ?? []) as BankCategory[]
  })

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const cats = data ?? []
  const roots = (kind: 'expense' | 'income') => cats.filter((c) => !c.parent_id && c.kind === kind)
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id)

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

  async function clearAll() {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database
      .from('bank_categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    reload()
  }

  function CatRow({ cat, sub = false }: { cat: BankCategory; sub?: boolean }) {
    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 10,
          paddingLeft: sub ? 14 : 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        }}
      >
        <Text style={{ color: sub ? colors.muted : colors.text, fontSize: sub ? 14 : 15 }}>
          {sub ? `↳ ${cat.name}` : cat.name}
        </Text>
        <Pressable onPress={() => remove(cat.id)} disabled={busy}>
          <Text style={{ color: colors.danger, fontSize: 13 }}>Eliminar</Text>
        </Pressable>
      </View>
    )
  }

  function Section({ kind, title }: { kind: 'expense' | 'income'; title: string }) {
    const list = roots(kind)
    return (
      <>
        <SectionTitle>
          {title} ({list.length})
        </SectionTitle>
        {list.length === 0 ? (
          <Empty message="Sin categorías" />
        ) : (
          <Card>
            {list.map((c) => (
              <View key={c.id}>
                <CatRow cat={c} />
                {childrenOf(c.id).map((ch) => (
                  <CatRow key={ch.id} cat={ch} sub />
                ))}
              </View>
            ))}
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Categorías' }} />
      <Screen>
        <SectionMenu items={MENU} active="/cuenta/categorias" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <>
            <SectionTitle>Nueva categoría o subcategoría</SectionTitle>
            <Card>
              <CategoryCreator categories={cats} onCreated={reload} />
              {msg ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{msg}</Text> : null}
              <Pressable
                onPress={clearAll}
                disabled={busy || cats.length === 0}
                style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
              >
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Vaciar todas las categorías</Text>
              </Pressable>
            </Card>

            <Section kind="expense" title="Gastos" />
            <Section kind="income" title="Ingresos" />
          </>
        )}
      </Screen>
    </>
  )
}

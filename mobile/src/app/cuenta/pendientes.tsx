import { Link, Stack, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Badge, Card, Empty, ErrorBox, Loading, Screen, SectionMenu, SectionTitle, Stat } from '@/components/ui'
import { dateOnly, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { PendingCount, PendingMovement } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Movimientos', href: '/cuenta/movimientos' },
  { label: 'Pendientes', href: '/cuenta/pendientes' },
  { label: 'Clasificar', href: '/cuenta/clasificar' },
  { label: 'Categorías', href: '/cuenta/categorias' },
]

export default function PendientesScreen() {
  const { data, error, loading, refresh } = useAsync(async () => {
    const [countRes, listRes] = await Promise.all([
      insforge.database.rpc('bank_pending_count', {}),
      insforge.database.rpc('bank_pending_movements', { p_limit: 500, p_offset: 0 }),
    ])
    if (countRes.error) throw new Error(countRes.error.message)
    return {
      count: (countRes.data ?? { missing_category: 0, missing_link: 0, total: 0 }) as PendingCount,
      items: (listRes.data ?? []) as PendingMovement[],
    }
  })

  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )

  const count = data?.count
  const items = data?.items ?? []

  return (
    <>
      <Stack.Screen options={{ title: 'Pendientes' }} />
      <Screen>
        <SectionMenu items={MENU} active="/cuenta/pendientes" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="Total" value={String(count?.total ?? 0)} />
              <Stat label="Sin categoría" value={String(count?.missing_category ?? 0)} />
              <Stat label="Sin documento" value={String(count?.missing_link ?? 0)} />
            </View>

            <SectionTitle>Por completar ({items.length})</SectionTitle>
            {items.length === 0 ? <Empty message="🎉 No hay movimientos pendientes" /> : (
              items.map((m) => (
                <Link key={m.id} href={`/cuenta/vincular/${m.id}`} asChild>
                  <Pressable>
                    <Card>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>
                            {m.concept?.trim() || m.description || 'Movimiento'}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                            {dateOnly(m.operation_date)}
                            {m.category_name ? ` · ${m.category_name}` : ''}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            {m.needs_category ? <Badge text="Falta categoría" tone="amber" /> : null}
                            {m.needs_link ? <Badge text="Falta documento" tone="amber" /> : null}
                          </View>
                        </View>
                        <Text style={{ fontWeight: '700', color: (m.amount ?? 0) < 0 ? colors.danger : colors.emerald }}>
                          {eur(m.amount)}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                </Link>
              ))
            )}

            <Pressable onPress={refresh} style={{ alignSelf: 'center', paddingVertical: 10 }}>
              <Text style={{ color: colors.emerald, fontWeight: '600' }}>Actualizar</Text>
            </Pressable>
          </>
        )}
      </Screen>
    </>
  )
}

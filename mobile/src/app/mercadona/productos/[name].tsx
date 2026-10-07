import { Stack, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Screen } from '@/components/ui'
import { dateOnly, eur, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { HistoryRow } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ name: string }>()
  const name = decodeURIComponent(params.name ?? '')
  const { data, error, loading } = useAsync(async () => {
    const { data, error } = await insforge.database.rpc('mercadona_product_history', { p_name: name })
    if (error) throw new Error(error.message)
    return (data ?? []) as HistoryRow[]
  }, [name])

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <Screen>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{name}</Text>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty message="Sin histórico" /> : (
          data.map((h, i) => (
            <Card key={`${h.purchased_at}-${i}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
                    {h.store_name ?? '—'} {h.store_city ? `· ${h.store_city}` : ''}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {dateOnly(h.purchased_at)} · {num(h.quantity)} {h.unit ?? ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{eur(h.amount)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {eur(h.unit_price_eff)}/{h.unit ?? 'ud'}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </Screen>
    </>
  )
}

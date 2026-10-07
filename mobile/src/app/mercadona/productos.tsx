import { Link, Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Field, Loading, Screen, SectionMenu } from '@/components/ui'
import { dateOnly, eur, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { ProductRow } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Resumen', href: '/mercadona' },
  { label: 'Tickets', href: '/mercadona/tickets' },
  { label: 'Productos', href: '/mercadona/productos' },
]

export default function ProductosScreen() {
  const [q, setQ] = useState('')
  const { data, error, loading } = useAsync(async () => {
    const { data, error } = await insforge.database.rpc('mercadona_products', { q: q || null, lim: 500 })
    if (error) throw new Error(error.message)
    return (data ?? []) as ProductRow[]
  }, [q])

  return (
    <>
      <Stack.Screen options={{ title: 'Productos' }} />
      <Screen>
        <SectionMenu items={MENU} active="/mercadona/productos" />
        <Field label="Buscar" value={q} onChangeText={setQ} placeholder="Nombre del producto…" autoCorrect={false} />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty message="Sin productos" /> : (
          data.map((p) => (
            <Link key={p.product_name} href={`/mercadona/productos/${encodeURIComponent(p.product_name)}`} asChild>
              <Pressable>
                <Card>
                  <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={2}>
                    {p.product_name}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {num(p.purchases, 0)} compras · últ. {dateOnly(p.last_date)}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>
                      {eur(p.last_price)}
                    </Text>
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

import { Link, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Screen, SectionMenu } from '@/components/ui'
import { dateTime, eur, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { Ticket } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Resumen', href: '/mercadona' },
  { label: 'Tickets', href: '/mercadona/tickets' },
  { label: 'Productos', href: '/mercadona/productos' },
]

export default function TicketsScreen() {
  const { data, error, loading } = useAsync(async () => {
    const { data, error } = await insforge.database
      .from('mercadona_tickets')
      .select('id, ticket_number, purchased_at, store_name, store_city, total, item_count, payment_method')
      .order('purchased_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100)
    if (error) throw new Error(error.message)
    return (data ?? []) as Ticket[]
  })

  return (
    <>
      <Stack.Screen options={{ title: 'Tickets' }} />
      <Screen>
        <SectionMenu items={MENU} active="/mercadona/tickets" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty message="Sin tickets" /> : (
          data.map((t) => (
            <Link key={t.id} href={`/mercadona/tickets/${t.id}`} asChild>
              <Pressable>
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                        {t.store_name ?? 'Ticket'} {t.store_city ? `· ${t.store_city}` : ''}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {dateTime(t.purchased_at)} · {num(t.item_count, 0)} art.
                      </Text>
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

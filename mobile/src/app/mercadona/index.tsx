import { Stack } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { BarChart, RankBars } from '@/components/charts'
import { Card, Empty, ErrorBox, Loading, Screen, SectionMenu, SectionTitle, Stat } from '@/components/ui'
import { YearFilter } from '@/components/YearFilter'
import { eur, monthLabel, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { SpendSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { yearRange, yearsFromMonthly } from '@/lib/years'

const MENU = [
  { label: 'Resumen', href: '/mercadona' },
  { label: 'Tickets', href: '/mercadona/tickets' },
  { label: 'Productos', href: '/mercadona/productos' },
]

export default function MercadonaScreen() {
  const [year, setYear] = useState<number | null>(null)

  const { data: years } = useAsync(async () => {
    const { data } = await insforge.database.rpc('mercadona_spend_summary')
    return yearsFromMonthly((data as SpendSummary | null)?.monthly)
  }, [])

  const { data, error, loading } = useAsync(async () => {
    const { data, error } = await insforge.database.rpc('mercadona_spend_summary', yearRange(year))
    if (error) throw new Error(error.message)
    return data as SpendSummary | null
  }, [year])

  return (
    <>
      <Stack.Screen options={{ title: 'Mercadona' }} />
      <Screen>
        <SectionMenu items={MENU} active="/mercadona" />
        <YearFilter years={years ?? []} value={year} onChange={setYear} />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <Empty /> : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Stat label="Gasto total" value={eur(data.totals.total)} />
              <Stat label="Tickets" value={num(data.totals.tickets, 0)} />
              <Stat label="Ticket medio" value={eur(data.totals.avg_ticket)} />
            </View>

            <SectionTitle>Gasto por mes</SectionTitle>
            <Card>
              <BarChart
                data={data.monthly.map((m) => ({ label: monthLabel(m.month), value: m.total }))}
                format={(v) => eur(v)}
              />
            </Card>

            <SectionTitle>Gasto por tienda</SectionTitle>
            <Card>
              <RankBars
                data={data.by_store.slice(0, 8).map((s) => ({ label: s.store ?? '—', value: s.total }))}
                format={(v) => eur(v)}
              />
            </Card>

            <SectionTitle>Top productos</SectionTitle>
            <Card>
              <RankBars
                data={data.top_products.slice(0, 10).map((p) => ({ label: p.product, value: p.total }))}
                format={(v) => eur(v)}
                color="#0d9488"
              />
            </Card>
          </>
        )}
      </Screen>
    </>
  )
}

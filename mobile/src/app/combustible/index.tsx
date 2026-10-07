import { Link, Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BarChart, RankBars } from '@/components/charts'
import { Card, Empty, ErrorBox, Loading, Screen, SectionTitle, Stat } from '@/components/ui'
import { YearFilter } from '@/components/YearFilter'
import { dateOnly, eur, eurPerL, liters, monthLabel, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { WayletSummary, WayletTicket } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { yearRange, yearsFromMonthly } from '@/lib/years'
import { colors } from '@/lib/theme'

export default function CombustibleScreen() {
  const [year, setYear] = useState<number | null>(null)
  const range = yearRange(year)

  const { data: years } = useAsync(async () => {
    const { data } = await insforge.database.rpc('waylet_summary', {})
    return yearsFromMonthly((data as WayletSummary | null)?.monthly)
  }, [])

  const { data, error, loading } = useAsync(async () => {
    const [summaryRes] = await Promise.all([insforge.database.rpc('waylet_summary', range)])
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = insforge.database.from('waylet_tickets').select('*')
    if (range.p_from) query = query.gte('purchased_at', range.p_from)
    if (range.p_to) query = query.lte('purchased_at', `${range.p_to}T23:59:59`)
    const ticketsRes = await query.order('purchased_at', { ascending: false }).limit(200)
    return {
      summary: summaryRes.data as WayletSummary | null,
      tickets: (ticketsRes.data ?? []) as WayletTicket[],
    }
  }, [year])

  return (
    <>
      <Stack.Screen options={{ title: 'Combustible' }} />
      <Screen>
        <YearFilter years={years ?? []} value={year} onChange={setYear} />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <Empty /> : (
          <>
            {data.summary ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Stat label="Repostajes" value={num(data.summary.totals.tickets, 0)} />
                <Stat label="Litros" value={liters(data.summary.totals.liters)} />
                <Stat label="Gasto" value={eur(data.summary.totals.total)} />
                <Stat label="€/L pagado" value={eurPerL(data.summary.totals.eur_per_l_paid)} />
              </View>
            ) : null}

            <SectionTitle>Gasto por mes</SectionTitle>
            <Card>
              <BarChart
                data={(data.summary?.monthly ?? []).map((m) => ({ label: monthLabel(m.month), value: m.total }))}
                format={(v) => eur(v)}
                color="#0369a1"
              />
            </Card>

            <SectionTitle>Por estación</SectionTitle>
            <Card>
              <RankBars
                data={(data.summary?.by_station ?? []).map((s) => ({ label: s.station, value: s.total }))}
                format={(v) => eur(v)}
                color="#0369a1"
              />
            </Card>

            <SectionTitle>Repostajes ({data.tickets.length})</SectionTitle>
            {data.tickets.length === 0 ? <Empty message="Sin repostajes" /> : data.tickets.map((t) => (
              <Link key={t.id} href={`/combustible/${t.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {t.station_name ?? 'Repostaje'}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {dateOnly(t.purchased_at)} · {t.fuel_type ?? ''}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {liters(t.liters)} · {eurPerL(t.unit_price)}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{eur(t.total)}</Text>
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </>
        )}
      </Screen>
    </>
  )
}

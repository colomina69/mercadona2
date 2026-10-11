import { Link, Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BarChart, RankBars } from '@/components/charts'
import { Card, Empty, ErrorBox, Loading, Screen, SectionTitle, Stat } from '@/components/ui'
import { YearFilter } from '@/components/YearFilter'
import { dateOnly, eur, monthLabel, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { SupplierInvoice, SupplierSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { yearRange, yearsFromMonthly } from '@/lib/years'
import { colors } from '@/lib/theme'

export default function ProveedoresScreen() {
  const [year, setYear] = useState<number | null>(null)
  const range = yearRange(year)

  const { data: years } = useAsync(async () => {
    const { data } = await insforge.database.rpc('supplier_summary', {})
    return yearsFromMonthly((data as SupplierSummary | null)?.monthly)
  }, [])

  const { data, error, loading } = useAsync(async () => {
    const summaryRes = await insforge.database.rpc('supplier_summary', range)
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    let query: any = insforge.database.from('supplier_invoices').select('*')
    if (range.p_from) query = query.gte('issue_date', range.p_from)
    if (range.p_to) query = query.lte('issue_date', range.p_to)
    const listRes = await query.order('issue_date', { ascending: false }).limit(500)
    return {
      summary: summaryRes.data as SupplierSummary | null,
      invoices: (listRes.data ?? []) as SupplierInvoice[],
    }
  }, [year])

  return (
    <>
      <Stack.Screen options={{ title: 'Proveedores' }} />
      <Screen>
        <YearFilter years={years ?? []} value={year} onChange={setYear} />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <Empty /> : (
          <>
            {data.summary ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Stat label="Facturas" value={num(data.summary.totals.invoices, 0)} />
                <Stat label="Base" value={eur(data.summary.totals.base)} />
                <Stat label="IVA" value={eur(data.summary.totals.vat)} />
                <Stat label="Total" value={eur(data.summary.totals.total)} />
              </View>
            ) : null}

            <SectionTitle>Facturación por mes</SectionTitle>
            <Card>
              <BarChart
                data={(data.summary?.monthly ?? []).map((m) => ({ label: monthLabel(m.month), value: m.total }))}
                format={(v) => eur(v)}
                color="#e11d48"
              />
            </Card>

            <SectionTitle>Por proveedor</SectionTitle>
            <Card>
              <RankBars
                data={(data.summary?.by_supplier ?? []).map((s) => ({ label: s.supplier, value: s.total }))}
                format={(v) => eur(v)}
                color="#e11d48"
              />
            </Card>

            <SectionTitle>Facturas ({data.invoices.length})</SectionTitle>
            {data.invoices.length === 0 ? <Empty message="Sin facturas" /> : data.invoices.map((inv) => (
              <Link key={inv.id} href={`/proveedores/${inv.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {inv.supplier_name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {inv.invoice_number} · {dateOnly(inv.issue_date)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {inv.product ?? '—'}
                          {inv.quantity != null ? ` · ${num(inv.quantity)} ${inv.unit ?? ''}` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{eur(inv.total)}</Text>
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

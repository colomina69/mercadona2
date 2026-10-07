import { Link, Stack } from 'expo-router'
import { View, Text, Pressable } from 'react-native'
import { BarChart, RankBars } from '@/components/charts'
import { Card, Empty, ErrorBox, Loading, Screen, SectionMenu, SectionTitle, Stat } from '@/components/ui'
import { eur, eurPerKwh, kwh, monthLabel, num, dateOnly } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { IberdrolaContract, IberdrolaInvoice, IberdrolaSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Facturas', href: '/iberdrola/facturas' },
  { label: 'Contratos', href: '/iberdrola/contratos' },
]

export default function FacturasScreen() {
  const { data, error, loading } = useAsync(async () => {
    const [summaryRes, contractsRes, invoicesRes] = await Promise.all([
      insforge.database.rpc('iberdrola_summary', {}),
      insforge.database.from('iberdrola_contracts').select('id, label, contract_number, tariff').order('contract_number'),
      insforge.database
        .from('iberdrola_invoices')
        .select('*, contract:iberdrola_contracts(label, contract_number)')
        .order('issue_date', { ascending: false })
        .limit(200),
    ])
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    return {
      summary: summaryRes.data as IberdrolaSummary | null,
      contracts: (contractsRes.data ?? []) as IberdrolaContract[],
      invoices: (invoicesRes.data ?? []) as IberdrolaInvoice[],
    }
  })

  return (
    <>
      <Stack.Screen options={{ title: 'Iberdrola' }} />
      <Screen>
        <SectionMenu items={MENU} active="/iberdrola/facturas" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <Empty /> : (
          <>
            {data.summary ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Stat label="Facturas" value={num(data.summary.totals.invoices, 0)} />
                <Stat label="Total" value={eur(data.summary.totals.total)} />
                <Stat label="Consumo" value={kwh(data.summary.totals.kwh)} />
                <Stat label="€/kWh" value={eurPerKwh(data.summary.totals.eur_per_kwh)} />
              </View>
            ) : null}

            <SectionTitle>Por contrato</SectionTitle>
            <Card>
              <RankBars
                data={data.summary?.by_contract.map((c) => ({ label: c.label, value: c.total })) ?? []}
                format={(v) => eur(v)}
                color="#b45309"
              />
            </Card>

            <SectionTitle>Facturación mensual</SectionTitle>
            <Card>
              <BarChart
                data={(data.summary?.monthly ?? []).map((m) => ({ label: monthLabel(m.month), value: m.total }))}
                format={(v) => eur(v)}
                color="#b45309"
              />
            </Card>

            <SectionTitle>Facturas ({data.invoices.length})</SectionTitle>
            {data.invoices.length === 0 ? <Empty message="Sin facturas" /> : data.invoices.map((inv) => (
              <Link key={inv.id} href={`/iberdrola/facturas/${inv.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                          {inv.contract?.label ?? inv.invoice_number}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {inv.invoice_number} · {dateOnly(inv.issue_date)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {kwh(inv.consumption_kwh)}
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

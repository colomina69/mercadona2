import { Link, Stack, useLocalSearchParams } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Row, Screen, SectionTitle, Stat } from '@/components/ui'
import { dateOnly, eur, eurPerKwh, kwh, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { IberdrolaContract, IberdrolaInvoice, IberdrolaSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function ContratoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading } = useAsync(async () => {
    const [contractRes, summaryRes, invoicesRes] = await Promise.all([
      insforge.database.from('iberdrola_contracts').select('*').eq('id', id).maybeSingle(),
      insforge.database.rpc('iberdrola_summary', { p_contract_id: id }),
      insforge.database.from('iberdrola_invoices').select('*').eq('contract_id', id).order('issue_date', { ascending: false }),
    ])
    if (contractRes.error) throw new Error(contractRes.error.message)
    return {
      contract: contractRes.data as IberdrolaContract | null,
      summary: summaryRes.data as IberdrolaSummary | null,
      invoices: (invoicesRes.data ?? []) as IberdrolaInvoice[],
    }
  }, [id])

  const c = data?.contract
  const sum = data?.summary

  const byYear = new Map<string, { year: string; invoices: number; kwh: number; energy: number; total: number }>()
  for (const inv of data?.invoices ?? []) {
    const y = inv.issue_date ? String(inv.issue_date).slice(0, 4) : '—'
    const row = byYear.get(y) ?? { year: y, invoices: 0, kwh: 0, energy: 0, total: 0 }
    row.invoices += 1
    row.kwh += inv.consumption_kwh ?? 0
    row.energy += inv.energy_amount ?? 0
    row.total += inv.total ?? 0
    byYear.set(y, row)
  }
  const yearRows = Array.from(byYear.values()).sort((a, b) => b.year.localeCompare(a.year))

  return (
    <>
      <Stack.Screen options={{ title: c?.label ?? 'Contrato' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !c ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {c.label ?? c.contract_number}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Contrato" value={c.contract_number} />
              <Row label="CUPS" value={c.cups ?? '—'} />
              <Row label="Tarifa" value={c.tariff ?? '—'} />
              <Row label="Dirección" value={c.supply_address ?? '—'} />
              <Row label="Titular" value={c.titular ?? '—'} />
              <Row label="Potencia punta" value={c.contracted_power_punta != null ? `${num(c.contracted_power_punta)} kW` : '—'} />
              <Row label="Potencia valle" value={c.contracted_power_valle != null ? `${num(c.contracted_power_valle)} kW` : '—'} />
            </Card>

            {sum ? (
              <>
                <SectionTitle>Totales</SectionTitle>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <Stat label="Facturas" value={num(sum.totals.invoices, 0)} />
                  <Stat label="Total" value={eur(sum.totals.total)} />
                  <Stat label="Consumo" value={kwh(sum.totals.kwh)} />
                  <Stat label="€/kWh" value={eurPerKwh(sum.totals.eur_per_kwh)} />
                </View>
              </>
            ) : null}

            {yearRows.length > 0 ? (
              <>
                <SectionTitle>Desglose por años</SectionTitle>
                <Card>
                  {yearRows.map((r) => (
                    <View key={r.year} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <Row label={r.year} value={eur(r.total)} strong />
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {num(r.invoices, 0)} facturas · {kwh(r.kwh)} · {eurPerKwh(r.kwh > 0 ? r.energy / r.kwh : null)}
                      </Text>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <SectionTitle>Facturas ({data.invoices.length})</SectionTitle>
            {data.invoices.length === 0 ? <Empty message="Sin facturas" /> : data.invoices.map((inv) => (
              <Link key={inv.id} href={`/iberdrola/facturas/${inv.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }}>{inv.invoice_number}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {dateOnly(inv.issue_date)} · {kwh(inv.consumption_kwh)}
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

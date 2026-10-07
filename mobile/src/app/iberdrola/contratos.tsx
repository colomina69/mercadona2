import { Link, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Screen, SectionMenu } from '@/components/ui'
import { eur, eurPerKwh, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { IberdrolaContract, IberdrolaSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Facturas', href: '/iberdrola/facturas' },
  { label: 'Contratos', href: '/iberdrola/contratos' },
]

export default function ContratosScreen() {
  const { data, error, loading } = useAsync(async () => {
    const [summaryRes, contractsRes] = await Promise.all([
      insforge.database.rpc('iberdrola_summary', {}),
      insforge.database.from('iberdrola_contracts').select('*').order('contract_number'),
    ])
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    return {
      summary: summaryRes.data as IberdrolaSummary | null,
      contracts: (contractsRes.data ?? []) as IberdrolaContract[],
    }
  })

  return (
    <>
      <Stack.Screen options={{ title: 'Contratos' }} />
      <Screen>
        <SectionMenu items={MENU} active="/iberdrola/contratos" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.contracts.length ? <Empty message="Sin contratos" /> : (
          data.contracts.map((c) => {
            const sum = data.summary?.by_contract.find((b) => b.contract_id === c.id)
            return (
              <Link key={c.id} href={`/iberdrola/contratos/${c.id}`} asChild>
                <Pressable>
                  <Card>
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {c.label ?? c.contract_number}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {c.contract_number} {c.tariff ? `· ${c.tariff}` : ''}
                    </Text>
                    {sum ? (
                      <>
                        <View style={{ height: 6 }} />
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {num(sum.invoices, 0)} facturas · {eur(sum.total)} · {eurPerKwh(sum.eur_per_kwh)}
                        </Text>
                      </>
                    ) : null}
                  </Card>
                </Pressable>
              </Link>
            )
          })
        )}
      </Screen>
    </>
  )
}

import { Link, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { BarChart, RankBars } from '@/components/charts'
import { Badge, Card, Empty, ErrorBox, Loading, Row, Screen, SectionMenu, SectionTitle, Stat } from '@/components/ui'
import { dateOnly, eur, monthLabel, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { BankAccountBalance, BankCategory, BankSummary, BankTransaction } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Movimientos', href: '/cuenta/movimientos' },
  { label: 'Categorías', href: '/cuenta/categorias' },
]

const COLS =
  'id, operation_date, value_date, description, concept, amount, balance, counterparty_tax_id, reference, category_id, category:bank_categories(name, kind)'

type TxRow = BankTransaction

export default function MovimientosScreen() {
  const { data, error, loading } = useAsync(async () => {
    const [summaryRes, balancesRes, listRes] = await Promise.all([
      insforge.database.rpc('bank_summary', {}),
      insforge.database
        .from('bank_account_balances')
        .select('account_iban, account_name, balance, currency, as_of, source')
        .order('as_of', { ascending: false })
        .limit(50),
      insforge.database
        .from('bank_transactions')
        .select(COLS)
        .order('operation_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(100),
    ])
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    const latest = new Map<string, BankAccountBalance>()
    for (const b of (balancesRes.data ?? []) as BankAccountBalance[]) {
      if (!latest.has(b.account_iban)) latest.set(b.account_iban, b)
    }
    return {
      summary: summaryRes.data as BankSummary | null,
      accounts: Array.from(latest.values()),
      transactions: (listRes.data ?? []) as unknown as TxRow[],
    }
  })

  return (
    <>
      <Stack.Screen options={{ title: 'Cuenta' }} />
      <Screen>
        <SectionMenu items={MENU} active="/cuenta/movimientos" />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <Empty /> : (
          <>
            {data.summary ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Stat label="Ingresos" value={eur(data.summary.totals.inflow)} />
                <Stat label="Gastos" value={eur(data.summary.totals.outflow)} />
                <Stat label="Neto" value={eur(data.summary.totals.net)} />
                <Stat label="Movimientos" value={num(data.summary.totals.transactions, 0)} />
              </View>
            ) : null}

            {data.accounts.length ? (
              <>
                <SectionTitle>Saldo de cuentas</SectionTitle>
                <Card>
                  {data.accounts.map((a) => (
                    <Row
                      key={a.account_iban}
                      label={`${a.account_name ?? 'Cuenta'} · ${a.account_iban.slice(-4)}`}
                      value={`${eur(a.balance)} · ${dateOnly(a.as_of)}`}
                      strong
                    />
                  ))}
                </Card>
              </>
            ) : null}

            <SectionTitle>Por categoría</SectionTitle>
            <Card>
              <RankBars
                data={(data.summary?.by_category ?? []).slice(0, 8).map((c) => ({ label: c.category, value: c.total }))}
                format={(v) => eur(v)}
                color="#6d28d9"
              />
            </Card>

            <SectionTitle>Movimientos recientes</SectionTitle>
            {data.transactions.length === 0 ? <Empty message="Sin movimientos" /> : data.transactions.map((t) => (
              <Link key={t.id} href={`/cuenta/movimientos/${t.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={2}>
                          {t.concept?.trim() || t.description || '—'}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {dateOnly(t.operation_date)}
                        </Text>
                        {t.category?.name ? (
                          <View style={{ marginTop: 6 }}>
                            <Badge text={t.category.name} tone={t.category.kind === 'income' ? 'green' : 'slate'} />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          fontWeight: '700',
                          color: (t.amount ?? 0) < 0 ? colors.danger : colors.emerald,
                        }}
                      >
                        {eur(t.amount)}
                      </Text>
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

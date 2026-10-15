import { Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { BigButton, Screen } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import { dateOnly, eur } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function HomeScreen() {
  const { data } = useAsync(async () => {
    const [balRes, pendRes] = await Promise.all([
      insforge.database
        .from('bank_account_balances')
        .select('account_iban, account_name, balance, currency, as_of')
        .order('as_of', { ascending: false })
        .limit(1),
      insforge.database.rpc('bank_pending_count', {}),
    ])
    return {
      balance: (balRes.data?.[0] ?? null) as { balance: number | null; as_of: string | null } | null,
      pending: (pendRes.data ?? { total: 0 }) as { total: number },
    }
  })

  const accountDesc = data?.balance
    ? `Saldo ${eur(data.balance.balance)} · ${dateOnly(data.balance.as_of)}`
    : 'Movimientos y categorías'

  return (
    <>
      <Stack.Screen options={{ title: 'Mis gastos' }} />
      <Screen>
        <View style={{ gap: 2, marginBottom: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Mis gastos</Text>
          <Text style={{ fontSize: 14, color: colors.muted }}>Elige un apartado para empezar.</Text>
        </View>

        <BigButton emoji="🥕" title="Mercadona" description="Tickets, productos y gasto" href="/mercadona" accent={colors.emeraldSoft} />
        <BigButton emoji="⚡" title="Iberdrola" description="Facturas y contratos de luz" href="/iberdrola/facturas" accent="#fffbeb" />
        <BigButton emoji="⛽" title="Combustible" description="Repostajes Waylet" href="/combustible" accent="#f0f9ff" />
        <BigButton emoji="🚚" title="Proveedores" description="Facturas de proveedores" href="/proveedores" accent="#fff1f2" />
        <BigButton emoji="📷" title="Tickets por foto" description="Haz una foto y revísala" href="/fotos" accent="#f7fee7" />
        {data && data.pending.total > 0 ? (
          <BigButton emoji="⚠️" title="Pendientes" description={`${data.pending.total} movimientos por completar`} href="/cuenta/pendientes" accent="#fef2f2" />
        ) : null}
        <BigButton emoji="🏦" title="Cuenta" description={accountDesc} href="/cuenta/movimientos" accent="#f5f3ff" />
        <BigButton emoji="🎟️" title="Sorteos" description="Gestión de sorteos y pagos" href="/sorteos" accent="#fef2f2" />
      </Screen>
    </>
  )
}

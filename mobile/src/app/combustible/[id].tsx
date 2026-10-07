import { Stack, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Row, Screen, SectionTitle } from '@/components/ui'
import { PdfButton } from '@/components/PdfButton'
import { dateTime, eur, eurPerL, liters } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { WayletLine, WayletTicket } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function FuelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading } = useAsync(async () => {
    const [ticket, lines] = await Promise.all([
      insforge.database.from('waylet_tickets').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('waylet_ticket_lines').select('*').eq('ticket_id', id).order('line_no'),
    ])
    if (ticket.error) throw new Error(ticket.error.message)
    return {
      ticket: ticket.data as WayletTicket | null,
      lines: (lines.data ?? []) as WayletLine[],
    }
  }, [id])

  const t = data?.ticket
  const lines = data?.lines ?? []

  return (
    <>
      <Stack.Screen options={{ title: t?.ticket_number ?? 'Repostaje' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !t ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {t.station_name ?? 'Repostaje'}
              </Text>
              {t.address ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {t.address} {t.locality ? `· ${t.locality}` : ''}
                </Text>
              ) : null}
              <View style={{ height: 6 }} />
              <Row label="Fecha" value={dateTime(t.purchased_at)} />
              <Row label="Carburante" value={t.fuel_type ?? '—'} />
              <Row label="Litros" value={liters(t.liters)} />
              <Row label="Precio" value={eurPerL(t.unit_price)} />
              <Row label="Bruto" value={eur(t.gross_amount)} />
              <Row label="Descuento" value={eur(t.discount_amount)} />
              <Row label="Pago" value={t.payment_method ?? '—'} />
              <Row label="Total" value={eur(t.total)} strong />
            </Card>

            <PdfButton pdfKey={t.pdf_key} bucket="waylet" />

            {lines.length ? (
              <>
                <SectionTitle>Líneas</SectionTitle>
                {lines.map((l) => (
                  <Card key={l.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={{ color: colors.text, flex: 1 }}>{l.product_name ?? '—'}</Text>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{eur(l.amount)}</Text>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        )}
      </Screen>
    </>
  )
}

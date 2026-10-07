import { Stack, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Row, Screen, SectionTitle } from '@/components/ui'
import { PdfButton } from '@/components/PdfButton'
import { num, dateTime, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { Ticket, TicketItem } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading } = useAsync(async () => {
    const [ticket, items] = await Promise.all([
      insforge.database.from('mercadona_tickets').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('mercadona_ticket_items').select('*').eq('ticket_id', id).order('line_no'),
    ])
    if (ticket.error) throw new Error(ticket.error.message)
    return {
      ticket: ticket.data as Ticket | null,
      items: (items.data ?? []) as TicketItem[],
    }
  }, [id])

  const ticket = data?.ticket
  const items = data?.items ?? []

  return (
    <>
      <Stack.Screen options={{ title: ticket?.ticket_number ?? 'Ticket' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !ticket ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {ticket.store_name ?? 'Ticket'}
              </Text>
              {ticket.store_address ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {ticket.store_address} {ticket.store_city ? `· ${ticket.store_city}` : ''}
                </Text>
              ) : null}
              <View style={{ height: 6 }} />
              <Row label="Fecha" value={dateTime(ticket.purchased_at)} />
              <Row label="Nº ticket" value={ticket.ticket_number ?? '—'} />
              <Row label="Artículos" value={num(ticket.item_count, 0)} />
              <Row label="Pago" value={ticket.payment_method ?? '—'} />
              <Row label="Total" value={eur(ticket.total)} strong />
            </Card>

            <PdfButton pdfKey={ticket.pdf_key} bucket="mercadona" />

            <SectionTitle>Líneas ({items.length})</SectionTitle>
            {items.length === 0 ? <Empty message="Sin líneas" /> : items.map((it) => (
              <Card key={it.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>
                      {it.product_name ?? '—'}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {num(it.quantity)} {it.unit ?? ''} × {eur(it.unit_price)}
                      {it.vat_rate != null ? ` · IVA ${num(it.vat_rate, 0)}%` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{eur(it.amount)}</Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </Screen>
    </>
  )
}

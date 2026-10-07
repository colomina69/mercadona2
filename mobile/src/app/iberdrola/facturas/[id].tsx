import { Stack, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Row, Screen, SectionTitle } from '@/components/ui'
import { PdfButton } from '@/components/PdfButton'
import { dateOnly, eur, eurPerKwh, kwh, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { IberdrolaConsumption, IberdrolaInvoice, IberdrolaInvoiceLine } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

type InvoiceFull = IberdrolaInvoice & { subtotal?: number | null; period_start?: string | null; period_end?: string | null }

export default function FacturaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading } = useAsync(async () => {
    const [inv, lines, cons] = await Promise.all([
      insforge.database
        .from('iberdrola_invoices')
        .select('*, contract:iberdrola_contracts(label, contract_number, tariff, supply_address)')
        .eq('id', id)
        .maybeSingle(),
      insforge.database.from('iberdrola_invoice_lines').select('*').eq('invoice_id', id).order('line_no'),
      insforge.database.from('iberdrola_invoice_consumption').select('*').eq('invoice_id', id),
    ])
    if (inv.error) throw new Error(inv.error.message)
    return {
      invoice: inv.data as InvoiceFull | null,
      lines: (lines.data ?? []) as IberdrolaInvoiceLine[],
      consumption: (cons.data ?? []) as IberdrolaConsumption[],
    }
  }, [id])

  const inv = data?.invoice
  const lines = data?.lines ?? []
  const consumption = data?.consumption ?? []
  const perKwh = inv?.consumption_kwh && inv.energy_amount != null ? inv.energy_amount / inv.consumption_kwh : null

  return (
    <>
      <Stack.Screen options={{ title: inv?.invoice_number ?? 'Factura' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !inv ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {inv.contract?.label ?? 'Factura'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {inv.contract?.contract_number ?? ''} {inv.tariff ? `· ${inv.tariff}` : ''}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Nº factura" value={inv.invoice_number} />
              <Row label="Emisión" value={dateOnly(inv.issue_date)} />
              <Row label="Periodo" value={`${dateOnly(inv.period_start)} → ${dateOnly(inv.period_end)}`} />
              <Row label="Consumo" value={kwh(inv.consumption_kwh)} />
              <Row label="Energía" value={eur(inv.energy_amount)} />
              <Row label="€/kWh" value={eurPerKwh(perKwh)} />
              <Row label="Total" value={eur(inv.total)} strong />
            </Card>

            <PdfButton pdfKey={inv.pdf_key} bucket="iberdrola" />

            {consumption.length ? (
              <>
                <SectionTitle>Consumo por tramo</SectionTitle>
                <Card>
                  {consumption.map((c) => (
                    <Row key={c.id} label={c.tramo} value={kwh(c.kwh)} />
                  ))}
                </Card>
              </>
            ) : null}

            <SectionTitle>Líneas ({lines.length})</SectionTitle>
            {lines.length === 0 ? <Empty message="Sin líneas" /> : lines.map((l) => (
              <Card key={l.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>
                      {l.concept ?? l.detail ?? '—'}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {[l.grp, l.tramo, l.detail].filter(Boolean).join(' · ')}
                    </Text>
                    <Text style={{ color: colors.faint, fontSize: 11, marginTop: 2 }}>
                      {num(l.quantity)} {l.unit ?? ''} × {eur(l.unit_price)}
                      {l.days ? ` · ${l.days} días` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{eur(l.amount)}</Text>
                </View>
              </Card>
            ))}
          </>
        )}
      </Screen>
    </>
  )
}

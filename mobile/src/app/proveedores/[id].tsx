import { Stack, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Row, Screen, SectionTitle } from '@/components/ui'
import { PdfButton } from '@/components/PdfButton'
import { dateOnly, eur, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { SupplierInvoice, SupplierInvoiceLine } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function ProveedorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading } = useAsync(async () => {
    const [inv, lines] = await Promise.all([
      insforge.database.from('supplier_invoices').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('supplier_invoice_lines').select('*').eq('invoice_id', id).order('line_no'),
    ])
    if (inv.error) throw new Error(inv.error.message)
    return { invoice: inv.data as SupplierInvoice | null, lines: (lines.data ?? []) as SupplierInvoiceLine[] }
  }, [id])

  const inv = data?.invoice
  const lines = data?.lines ?? []

  return (
    <>
      <Stack.Screen options={{ title: inv ? `${inv.supplier_name}` : 'Factura' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !inv ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {inv.supplier_name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Factura {inv.invoice_number} · NIF {inv.supplier_tax_id ?? '—'}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Fecha factura" value={dateOnly(inv.issue_date)} />
              <Row label="Fecha entrega" value={dateOnly(inv.delivery_date)} />
              <Row label="Nº albarán" value={inv.albaran ?? '—'} />
              <Row label="Nº pedido" value={inv.pedido ?? '—'} />
              <Row label="Producto" value={inv.product ?? '—'} />
              <Row label="Cantidad" value={inv.quantity != null ? `${num(inv.quantity)} ${inv.unit ?? ''}` : '—'} />
              <Row label="Precio" value={inv.unit_price != null ? `${num(inv.unit_price, 6)} €` : '—'} />
              <Row label="Base" value={eur(inv.base)} />
              <Row label={`IVA ${num(inv.vat_rate ?? 0, 0)}%`} value={eur(inv.vat_amount)} />
              <Row label="Total" value={eur(inv.total)} strong />
              <Row label="Forma de pago" value={inv.payment_method ?? '—'} />
              <Row label="Matrícula" value={inv.plate ?? '—'} />
              <Row label="Conductor" value={inv.driver ?? '—'} />
            </Card>

            {inv.pdf_key ? <PdfButton pdfKey={inv.pdf_key} bucket="suppliers" /> : null}
            {inv.responsibility_pdf_key ? (
              <PdfButton pdfKey={inv.responsibility_pdf_key} bucket="suppliers" label="Documento de responsabilidad" />
            ) : null}

            <SectionTitle>Líneas ({lines.length})</SectionTitle>
            {lines.length === 0 ? <Empty message="Sin líneas" /> : lines.map((l) => (
              <Card key={l.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{l.product_name ?? '—'}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {num(l.quantity)} {l.unit ?? ''} × {num(l.unit_price, 6)} €
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

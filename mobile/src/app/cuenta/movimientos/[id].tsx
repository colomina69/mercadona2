import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  Card,
  Empty,
  ErrorBox,
  Field,
  Loading,
  PrimaryButton,
  Row,
  Screen,
  SectionTitle,
} from '@/components/ui'
import { dateOnly, dateTime, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { BankCategory, BankTransaction } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

type LinkRow = { id: string; target_type: 'ticket' | 'invoice' | 'waylet'; target_id: string }
type Candidate = { id: string; label: string; sub: string; total: number | null; linked: boolean }
type LinkedDetail = { link: LinkRow; label: string; sub: string; total: number | null }

export default function MovimientoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const [tx, cats, linksRes, ticketsRes, invoicesRes, wayletRes] = await Promise.all([
      insforge.database.from('bank_transactions').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('bank_categories').select('id, name, kind, color, sort_order').order('kind').order('sort_order'),
      insforge.database.from('bank_transaction_links').select('id, target_type, target_id').eq('transaction_id', id),
      insforge.database.rpc('bank_match_tickets', { p_transaction_id: id }),
      insforge.database.rpc('bank_match_invoices', { p_transaction_id: id }),
      insforge.database.rpc('bank_match_waylet', { p_transaction_id: id }),
    ])
    if (tx.error) throw new Error(tx.error.message)

    const links = (linksRes.data ?? []) as LinkRow[]
    const linkedIds = new Set(links.map((l) => l.target_id))

    const toCandidate = (l: string, sub: string, total: number | null, recId: string): Candidate => ({
      id: recId,
      label: l,
      sub,
      total,
      linked: linkedIds.has(recId),
    })

    const tickets = ((ticketsRes.data ?? []) as Record<string, unknown>[]).map((t) =>
      toCandidate(String(t.store_name ?? 'Ticket'), dateTime(t.purchased_at as string), t.total as number, String(t.id)),
    )
    const invoices = ((invoicesRes.data ?? []) as Record<string, unknown>[]).map((t) =>
      toCandidate(String(t.invoice_number ?? 'Factura'), dateOnly(t.issue_date as string), t.total as number, String(t.id)),
    )
    const waylet = ((wayletRes.data ?? []) as Record<string, unknown>[]).map((t) =>
      toCandidate(String(t.station_name ?? 'Repostaje'), dateOnly(t.purchased_at as string), t.total as number, String(t.id)),
    )

    const linkedDetails: LinkedDetail[] = await Promise.all(
      links.map(async (l) => {
        if (l.target_type === 'ticket') {
          const { data } = await insforge.database.from('mercadona_tickets').select('store_name, purchased_at, total').eq('id', l.target_id).maybeSingle()
          return { link: l, label: String(data?.store_name ?? 'Ticket'), sub: dateTime(data?.purchased_at), total: (data?.total ?? null) as number | null }
        }
        if (l.target_type === 'invoice') {
          const { data } = await insforge.database.from('iberdrola_invoices').select('invoice_number, issue_date, total').eq('id', l.target_id).maybeSingle()
          return { link: l, label: String(data?.invoice_number ?? 'Factura'), sub: dateOnly(data?.issue_date), total: (data?.total ?? null) as number | null }
        }
        const { data } = await insforge.database.from('waylet_tickets').select('station_name, purchased_at, total').eq('id', l.target_id).maybeSingle()
        return { link: l, label: String(data?.station_name ?? 'Repostaje'), sub: dateOnly(data?.purchased_at), total: (data?.total ?? null) as number | null }
      }),
    )

    return {
      tx: tx.data as BankTransaction | null,
      categories: (cats.data ?? []) as BankCategory[],
      linkedDetails,
      tickets,
      invoices,
      waylet,
    }
  }, [id])

  const tx = data?.tx
  const [concept, setConcept] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const currentConcept = concept ?? tx?.concept ?? ''
  const currentCategory = categoryId === undefined ? (tx?.category_id ?? null) : categoryId

  async function save() {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database
      .from('bank_transactions')
      .update({ concept: currentConcept.trim() || null, category_id: currentCategory })
      .eq('id', id)
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('Guardado')
    reload()
  }

  async function link(targetType: LinkRow['target_type'], targetId: string) {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database
      .from('bank_transaction_links')
      .insert([{ transaction_id: id, target_type: targetType, target_id: targetId }])
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    reload()
  }

  async function unlink(linkId: string) {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database.from('bank_transaction_links').delete().eq('id', linkId)
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    reload()
  }

  function Candidates({ title, items, type }: { title: string; items: Candidate[]; type: LinkRow['target_type'] }) {
    if (!items.length) return null
    return (
      <>
        <SectionTitle>{title}</SectionTitle>
        <Card>
          {items.map((c) => (
            <View key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{c.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{c.sub} · {eur(c.total)}</Text>
                </View>
                {c.linked ? (
                  <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: '600', alignSelf: 'center' }}>vinculado</Text>
                ) : (
                  <Pressable onPress={() => link(type, c.id)} disabled={busy} style={{ alignSelf: 'center' }}>
                    <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: '700' }}>Vincular</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </Card>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Movimiento' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data || !tx ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {tx.description ?? 'Movimiento'}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Fecha" value={dateOnly(tx.operation_date)} />
              <Row label="Fecha valor" value={dateOnly(tx.value_date)} />
              <Row label="Importe" value={eur(tx.amount)} strong />
              <Row label="Saldo" value={eur(tx.balance)} />
              <Row label="Referencia" value={tx.reference ?? '—'} />
            </Card>

            <SectionTitle>Editar</SectionTitle>
            <Card>
              <Field label="Concepto" value={currentConcept} onChangeText={setConcept} placeholder="Concepto…" />
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8 }}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                <Pressable
                  onPress={() => setCategoryId(null)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: currentCategory === null ? colors.emerald : '#eef2f6' }}
                >
                  <Text style={{ color: currentCategory === null ? '#fff' : colors.muted, fontSize: 12 }}>Sin categoría</Text>
                </Pressable>
                {data.categories.map((cat) => {
                  const active = currentCategory === cat.id
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(cat.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? colors.emerald : '#eef2f6' }}
                    >
                      <Text style={{ color: active ? '#fff' : colors.muted, fontSize: 12 }}>{cat.name}</Text>
                    </Pressable>
                  )
                })}
              </View>
              <View style={{ height: 12 }} />
              <PrimaryButton title="Guardar" onPress={save} loading={busy} />
              {msg ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{msg}</Text> : null}
            </Card>

            {data.linkedDetails.length ? (
              <>
                <SectionTitle>Vinculados</SectionTitle>
                <Card>
                  {data.linkedDetails.map((d) => (
                    <View key={d.link.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{d.label}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {d.link.target_type} · {d.sub} · {eur(d.total)}
                        </Text>
                      </View>
                      <Pressable onPress={() => unlink(d.link.id)} disabled={busy}>
                        <Text style={{ color: colors.danger, fontSize: 13 }}>Desvincular</Text>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <Candidates title="Tickets sugeridos" items={data.tickets} type="ticket" />
            <Candidates title="Facturas sugeridas" items={data.invoices} type="invoice" />
            <Candidates title="Repostajes sugeridos" items={data.waylet} type="waylet" />
          </>
        )}
      </Screen>
    </>
  )
}

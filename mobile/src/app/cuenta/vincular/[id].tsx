import { Stack, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Badge, Card, Empty, ErrorBox, Field, Loading, PrimaryButton, Row, Screen, SectionTitle } from '@/components/ui'
import { dateOnly, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { BankCategory, BankTransaction } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

type Sug = { type: 'ticket' | 'invoice' | 'waylet'; id: string; label: string; sub: string; amount: number | null; linked: boolean }
type LinkedItem = { id: string; target_type: string; target_id: string; label: string }

export default function VincularScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data, error, loading, reload } = useAsync(async () => {
    const [txRes, catsRes, linksRes, tRes, iRes, wRes, sugRes] = await Promise.all([
      insforge.database.from('bank_transactions').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('bank_categories').select('id, name, kind, color, sort_order').order('kind').order('sort_order'),
      insforge.database.from('bank_transaction_links').select('id, target_type, target_id').eq('transaction_id', id),
      insforge.database.rpc('bank_match_tickets', { p_transaction_id: id }),
      insforge.database.rpc('bank_match_invoices', { p_transaction_id: id }),
      insforge.database.rpc('bank_match_waylet', { p_transaction_id: id }),
      insforge.database.rpc('bank_suggest_category', { p_transaction_id: id }),
    ])
    if (txRes.error) throw new Error(txRes.error.message)

    const links = (linksRes.data ?? []) as { id: string; target_type: string; target_id: string }[]
    const linked: LinkedItem[] = await Promise.all(
      links.map(async (l) => {
        if (l.target_type === 'ticket') {
          const { data } = await insforge.database.from('mercadona_tickets').select('store_name').eq('id', l.target_id).maybeSingle()
          return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.store_name ?? 'Ticket') }
        }
        if (l.target_type === 'invoice') {
          const { data } = await insforge.database.from('iberdrola_invoices').select('invoice_number').eq('id', l.target_id).maybeSingle()
          return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.invoice_number ?? 'Factura') }
        }
        const { data } = await insforge.database.from('waylet_tickets').select('station_name').eq('id', l.target_id).maybeSingle()
        return { id: l.id, target_type: l.target_type, target_id: l.target_id, label: String(data?.station_name ?? 'Repostaje') }
      }),
    )
    const linkedIds = new Set(links.map((l) => l.target_id))
    const sugs: Sug[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (tRes.data ?? []) as any[])
      sugs.push({ type: 'ticket', id: String(t.id), label: String(t.store_name ?? 'Ticket'), sub: `${dateOnly(t.purchased_at)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (iRes.data ?? []) as any[])
      sugs.push({ type: 'invoice', id: String(t.id), label: `Factura ${t.invoice_number ?? ''}`, sub: `${dateOnly(t.issue_date)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (wRes.data ?? []) as any[])
      sugs.push({ type: 'waylet', id: String(t.id), label: String(t.station_name ?? 'Repostaje'), sub: `${dateOnly(t.purchased_at)} · ±${t.date_diff}d`, amount: t.total ?? null, linked: linkedIds.has(String(t.id)) })

    const sug = sugRes.data as { category_id: string; source: string } | null

    return {
      tx: txRes.data as BankTransaction | null,
      categories: (catsRes.data ?? []) as BankCategory[],
      linked,
      sugs,
      suggestion: sug?.category_id ? { id: sug.category_id, source: sug.source } : null,
    }
  }, [id])

  const tx = data?.tx
  const categories = data?.categories ?? []
  const [catOverride, setCatOverride] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<Sug[] | null>(null)
  const [searching, setSearching] = useState(false)

  const currentCat = catOverride === undefined ? (tx?.category_id ?? null) : catOverride
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const sugName = data?.suggestion ? catById.get(data.suggestion.id)?.name : null

  async function setCategory(categoryId: string | null) {
    setMsg(null)
    setCatOverride(categoryId)
    const { error } = await insforge.database.from('bank_transactions').update({ category_id: categoryId }).eq('id', id)
    if (error) setMsg(error.message)
  }

  async function doLink(type: Sug['type'], targetId: string) {
    setBusy(true)
    setMsg(null)
    const { error } = await insforge.database
      .from('bank_transaction_links')
      .insert([{ transaction_id: id, target_type: type, target_id: targetId }])
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    setSearchResults(null)
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

  async function search() {
    const term = searchText.trim()
    if (!term) return
    setSearching(true)
    setMsg(null)
    const [t, i, w] = await Promise.all([
      insforge.database.from('mercadona_tickets').select('id, store_name, purchased_at, total').ilike('store_name', `%${term}%`).order('purchased_at', { ascending: false }).limit(10),
      insforge.database.from('iberdrola_invoices').select('id, invoice_number, issue_date, total').ilike('invoice_number', `%${term}%`).order('issue_date', { ascending: false }).limit(10),
      insforge.database.from('waylet_tickets').select('id, station_name, purchased_at, total').ilike('station_name', `%${term}%`).order('purchased_at', { ascending: false }).limit(10),
    ])
    setSearching(false)
    const results: Sug[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (t.data ?? []) as any[]) results.push({ type: 'ticket', id: String(r.id), label: String(r.store_name ?? 'Ticket'), sub: dateOnly(r.purchased_at), amount: r.total ?? null, linked: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (i.data ?? []) as any[]) results.push({ type: 'invoice', id: String(r.id), label: `Factura ${r.invoice_number ?? ''}`, sub: dateOnly(r.issue_date), amount: r.total ?? null, linked: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (w.data ?? []) as any[]) results.push({ type: 'waylet', id: String(r.id), label: String(r.station_name ?? 'Repostaje'), sub: dateOnly(r.purchased_at), amount: r.total ?? null, linked: false })
    setSearchResults(results)
  }

  const expenses = categories.filter((c) => c.kind === 'expense')
  const incomes = categories.filter((c) => c.kind === 'income')

  function CategoryPill({ c }: { c: BankCategory }) {
    const active = currentCat === c.id
    return (
      <Pressable
        onPress={() => setCategory(c.id)}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? colors.emerald : '#eef2f6' }}
      >
        <Text style={{ color: active ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>{c.name}</Text>
      </Pressable>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Vincular y clasificar' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data || !tx ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {tx.concept?.trim() || tx.description || 'Movimiento'}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Fecha" value={dateOnly(tx.operation_date)} />
              <Row label="Importe" value={eur(tx.amount)} strong />
              <Row label="Referencia" value={tx.reference ?? '—'} />
            </Card>

            <SectionTitle>Categoría</SectionTitle>
            <Card>
              {data?.suggestion && sugName && data.suggestion.id !== currentCat ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <Text style={{ color: '#92400e', flex: 1, fontSize: 13 }}>
                    💡 Sugerida: <Text style={{ fontWeight: '700' }}>{sugName}</Text>{' '}
                    ({data.suggestion.source === 'historial' ? 'según tus movimientos' : 'por comercio'})
                  </Text>
                  <PrimaryButton title="Usar" onPress={() => setCategory(data.suggestion!.id)} />
                </View>
              ) : null}

              <Text style={{ color: colors.faint, fontSize: 12 }}>Sin categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                <Pressable
                  onPress={() => setCategory(null)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: currentCat === null ? colors.emerald : '#eef2f6' }}
                >
                  <Text style={{ color: currentCat === null ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>Ninguna</Text>
                </Pressable>
              </View>

              {expenses.length > 0 ? (
                <>
                  <Text style={{ color: colors.faint, fontSize: 12, marginTop: 12 }}>GASTOS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {expenses.map((c) => <CategoryPill key={c.id} c={c} />)}
                  </View>
                </>
              ) : null}
              {incomes.length > 0 ? (
                <>
                  <Text style={{ color: colors.faint, fontSize: 12, marginTop: 12 }}>INGRESOS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {incomes.map((c) => <CategoryPill key={c.id} c={c} />)}
                  </View>
                </>
              ) : null}
              {categories.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
                  No hay categorías. Créalas en Categorías.
                </Text>
              ) : null}
            </Card>

            <SectionTitle>Vinculados ({data.linked.length})</SectionTitle>
            <Card>
              {data.linked.length === 0 ? (
                <Text style={{ color: colors.faint, fontSize: 13 }}>Sin vínculos.</Text>
              ) : (
                data.linked.map((l) => (
                  <View key={l.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <Text style={{ color: colors.text, flex: 1 }}>
                      <Text style={{ color: colors.faint, fontSize: 11 }}>{l.target_type} </Text>
                      {l.label}
                    </Text>
                    <Pressable disabled={busy} onPress={() => unlink(l.id)}>
                      <Text style={{ color: colors.danger, fontSize: 13 }}>Desvincular</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </Card>

            <SectionTitle>Sugerencias</SectionTitle>
            <Card>
              {data.sugs.length === 0 ? (
                <Text style={{ color: colors.faint, fontSize: 13 }}>Sin coincidencias (±3 días, mismo importe).</Text>
              ) : (
                data.sugs.map((s) => (
                  <View key={`${s.type}-${s.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text }} numberOfLines={1}>
                        <Text style={{ color: colors.faint, fontSize: 11 }}>{s.type} </Text>
                        {s.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{s.sub} · {eur(s.amount)}</Text>
                    </View>
                    {s.linked ? (
                      <Badge text="vinculado" tone="green" />
                    ) : (
                      <Pressable disabled={busy} onPress={() => doLink(s.type, s.id)}>
                        <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: '700' }}>Vincular</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </Card>

            <SectionTitle>Buscar ticket o factura archivada</SectionTitle>
            <Card>
              <Field label="Buscar" value={searchText} onChangeText={setSearchText} placeholder="Tienda, nº de factura, estación…" autoCorrect={false} />
              <View style={{ height: 8 }} />
              <PrimaryButton title={searching ? 'Buscando…' : 'Buscar'} onPress={search} loading={searching} />
              {searchResults && (
                <View style={{ marginTop: 10 }}>
                  {searchResults.length === 0 ? (
                    <Text style={{ color: colors.faint, fontSize: 13 }}>Sin resultados.</Text>
                  ) : (
                    searchResults.map((s) => {
                      const alreadyLinked = data.linked.some((l) => l.target_id === s.id)
                      return (
                        <View key={`${s.type}-${s.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text }} numberOfLines={1}>
                              <Text style={{ color: colors.faint, fontSize: 11 }}>{s.type} </Text>
                              {s.label}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>{s.sub} · {eur(s.amount)}</Text>
                          </View>
                          {alreadyLinked ? (
                            <Badge text="vinculado" tone="green" />
                          ) : (
                            <Pressable disabled={busy} onPress={() => doLink(s.type, s.id)}>
                              <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: '700' }}>Vincular</Text>
                            </Pressable>
                          )}
                        </View>
                      )
                    })
                  )}
                </View>
              )}
            </Card>

            {msg ? <ErrorBox message={msg} /> : null}
          </>
        )}
      </Screen>
    </>
  )
}

import { Link, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  Loading,
  PrimaryButton,
  Row,
  Screen,
  SectionTitle,
  Stat,
} from '@/components/ui'
import { dateOnly, eur, num } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { Abonado, Grupo, Pago, Sorteo } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const METODOS = ['efectivo', 'bizum'] as const

function grupoDeSorteo(tipo: Sorteo['tipo']): Grupo {
  return tipo === 'especial' ? 'extraordinario' : 'mensual'
}

export default function SorteoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const [sorteoRes, abonadosRes, pagosRes] = await Promise.all([
      insforge.database.from('sorteos').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('abonados').select('*').order('nombre'),
      insforge.database.from('pagos').select('*').eq('sorteo_id', id),
    ])
    if (sorteoRes.error) throw new Error(sorteoRes.error.message)
    return {
      sorteo: sorteoRes.data as Sorteo | null,
      abonados: (abonadosRes.data ?? []) as Abonado[],
      pagos: (pagosRes.data ?? []) as Pago[],
    }
  }, [id])

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const sorteo = data?.sorteo
  const abonados = data?.abonados ?? []
  const pagos = data?.pagos ?? []
  const precio = sorteo ? Number(sorteo.precio) : 0
  const grupo: Grupo = sorteo ? grupoDeSorteo(sorteo.tipo) : 'mensual'

  const eligibles = abonados.filter((a) => (a.grupos ?? []).includes(grupo))
  const otros = abonados.filter((a) => !(a.grupos ?? []).includes(grupo))
  const pagoByAbonado = new Map(pagos.map((p) => [p.abonado_id, p]))

  const activosSinPago = eligibles.filter((a) => a.activo && !pagoByAbonado.has(a.id))
  const paid = pagos.filter((p) => p.estado === 'paid')
  const recaudado = paid.reduce((s, p) => s + p.cantidad, 0) * precio
  const decimosAsignados = pagos.reduce((s, p) => s + p.cantidad, 0)
  const decimosPagados = paid.reduce((s, p) => s + p.cantidad, 0)
  const disponibles = sorteo?.decimos_totales != null ? sorteo.decimos_totales - decimosAsignados : null

  function resumen(filter: (p: Pago) => boolean) {
    const list = pagos.filter(filter)
    const decimos = list.reduce((s, p) => s + p.cantidad, 0)
    return { count: list.length, decimos, amount: decimos * precio }
  }
  const cobroEfectivo = resumen((p) => p.estado === 'paid' && p.metodo_pago === 'efectivo')
  const cobroBizum = resumen((p) => p.estado === 'paid' && p.metodo_pago === 'bizum')
  const sinMetodo = resumen((p) => p.estado === 'paid' && p.metodo_pago !== 'efectivo' && p.metodo_pago !== 'bizum')
  const pendiente = resumen((p) => p.estado !== 'paid')

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    setMsg(null)
    const { error } = await fn()
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    reload()
  }

  function addPago(abonadoId: string, cantidad = 1) {
    run(() =>
      insforge.database
        .from('pagos')
        .insert([{ sorteo_id: id, abonado_id: abonadoId, cantidad, estado: 'pending' }]),
    )
  }

  function darDeAltaATodos() {
    if (activosSinPago.length === 0) {
      setMsg('No hay abonados pendientes de alta')
      return
    }
    run(() =>
      insforge.database
        .from('pagos')
        .insert(activosSinPago.map((a) => ({ sorteo_id: id, abonado_id: a.id, cantidad: 1, estado: 'pending' }))),
    )
  }

  function PagoRow({ abonado, pago }: { abonado: Abonado; pago: Pago }) {
    return (
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 10, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {abonado.nombre} {!abonado.activo ? '· inactivo' : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <Badge text={pago.estado === 'paid' ? 'pagado' : 'pendiente'} tone={pago.estado === 'paid' ? 'green' : 'amber'} />
              <Badge text={pago.metodo_pago ?? 'sin método'} />
              <Badge text={`${pago.cantidad} · ${eur(pago.cantidad * precio)}`} />
            </View>
            {pago.fecha_pago ? (
              <Text style={{ color: colors.faint, fontSize: 11, marginTop: 4 }}>pagado {dateOnly(pago.fecha_pago)}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <Pressable
            disabled={busy}
            onPress={() =>
              run(() => {
                const goingPaid = pago.estado !== 'paid'
                return insforge.database
                  .from('pagos')
                  .update({
                    estado: goingPaid ? 'paid' : 'pending',
                    fecha_pago: goingPaid ? new Date().toISOString() : null,
                    metodo_pago: goingPaid ? (pago.metodo_pago ?? 'efectivo') : pago.metodo_pago,
                  })
                  .eq('id', pago.id)
              })
            }
          >
            <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: '700' }}>
              {pago.estado === 'paid' ? 'Marcar pendiente' : 'Marcar pagado'}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable disabled={busy} onPress={() => run(() => insforge.database.from('pagos').update({ cantidad: Math.max(1, pago.cantidad - 1) }).eq('id', pago.id))}>
              <Text style={{ fontSize: 18, color: colors.muted }}>−</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', color: colors.text }}>{pago.cantidad}</Text>
            <Pressable disabled={busy} onPress={() => run(() => insforge.database.from('pagos').update({ cantidad: pago.cantidad + 1 }).eq('id', pago.id))}>
              <Text style={{ fontSize: 18, color: colors.muted }}>＋</Text>
            </Pressable>
          </View>
          <Pressable
            disabled={busy}
            onPress={() => {
              const idx = METODOS.indexOf((pago.metodo_pago ?? null) as (typeof METODOS)[number])
              const next = METODOS[(idx + 1) % METODOS.length]
              run(() => insforge.database.from('pagos').update({ metodo_pago: next }).eq('id', pago.id))
            }}
          >
            <Text style={{ color: colors.sky, fontSize: 12 }}>método</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={() => run(() => insforge.database.from('pagos').delete().eq('id', pago.id))}>
            <Text style={{ color: colors.danger, fontSize: 12 }}>Eliminar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  function AbonadoSinPago({ abonado }: { abonado: Abonado }) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <Text style={{ color: colors.text, flex: 1 }}>
          {abonado.nombre} {!abonado.activo ? '· inactivo' : ''}
        </Text>
        <Pressable disabled={busy} onPress={() => addPago(abonado.id)}>
          <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: '700' }}>Añadir</Text>
        </Pressable>
      </View>
    )
  }

  function Grupo({ title, entries }: { title: string; entries: { abonado: Abonado; pago?: Pago }[] }) {
    if (entries.length === 0) return null
    return (
      <>
        <SectionTitle>
          {title} ({entries.length})
        </SectionTitle>
        <Card>
          {entries.map(({ abonado, pago }) =>
            pago ? <PagoRow key={abonado.id} abonado={abonado} pago={pago} /> : <AbonadoSinPago key={abonado.id} abonado={abonado} />,
          )}
        </Card>
      </>
    )
  }

  const entriesFor = (filter: (p: Pago) => boolean) =>
    eligibles
      .map((a) => ({ abonado: a, pago: pagoByAbonado.get(a.id) }))
      .filter((x) => x.pago != null && filter(x.pago as Pago))

  const sinAlta = eligibles
    .filter((a) => !pagoByAbonado.has(a.id))
    .map((a) => ({ abonado: a }))

  return (
    <>
      <Stack.Screen options={{ title: sorteo?.nombre ?? 'Sorteo' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !sorteo ? <Empty /> : (
          <>
            <Card>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{sorteo.nombre}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {dateOnly(sorteo.fecha)} · {sorteo.tipo === 'especial' ? 'extraordinario' : 'mensual'} · {eur(precio)}
              </Text>
              <View style={{ height: 6 }} />
              <Row label="Décimos para vender" value={sorteo.decimos_totales != null ? num(sorteo.decimos_totales, 0) : '—'} />
              <Row label="Décimos asignados" value={num(decimosAsignados, 0)} />
              <Row label="Disponibles" value={disponibles != null ? num(disponibles, 0) : '—'} strong />
              <Row label="Recaudado" value={eur(recaudado)} strong />
              <View style={{ height: 8 }} />
              <Link href={`/sorteos/editar/${sorteo.id}`} asChild>
                <Pressable
                  style={({ pressed }) => [
                    { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>✏️ Editar sorteo</Text>
                </Pressable>
              </Link>
            </Card>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Stat label="Abonados" value={num(eligibles.length, 0)} />
              <Stat label="Pagados" value={num(paid.length, 0)} />
              <Stat label="Pendientes" value={num(pendiente.count, 0)} />
              <Stat label="Décimos cobrados" value={num(decimosPagados, 0)} />
            </View>

            <SectionTitle>Cobros</SectionTitle>
            <Card>
              <Row label={`Efectivo · ${cobroEfectivo.count} abon. · ${cobroEfectivo.decimos} déc.`} value={eur(cobroEfectivo.amount)} />
              <Row label={`Bizum · ${cobroBizum.count} abon. · ${cobroBizum.decimos} déc.`} value={eur(cobroBizum.amount)} />
              {sinMetodo.count > 0 ? (
                <Row label={`Sin método · ${sinMetodo.count} abon. · ${sinMetodo.decimos} déc.`} value={eur(sinMetodo.amount)} />
              ) : null}
              <View style={{ height: 6, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }} />
              <Row label="Total cobrado" value={eur(recaudado)} strong />
              {pendiente.count > 0 ? (
                <Row label={`Pendiente · ${pendiente.count} abon. · ${pendiente.decimos} déc.`} value={eur(pendiente.amount)} />
              ) : null}
            </Card>

            {activosSinPago.length > 0 ? (
              <PrimaryButton title={`Dar de alta a los ${activosSinPago.length} activos`} onPress={darDeAltaATodos} loading={busy} />
            ) : null}

            <Grupo title="Cobrado en efectivo" entries={entriesFor((p) => p.estado === 'paid' && p.metodo_pago === 'efectivo')} />
            <Grupo title="Cobrado en bizum" entries={entriesFor((p) => p.estado === 'paid' && p.metodo_pago === 'bizum')} />
            <Grupo title="Pagados sin método" entries={entriesFor((p) => p.estado === 'paid' && p.metodo_pago !== 'efectivo' && p.metodo_pago !== 'bizum')} />
            <Grupo title="Pendientes de pago" entries={entriesFor((p) => p.estado !== 'paid')} />
            <Grupo title="Sin alta en este sorteo" entries={sinAlta} />

            {eligibles.length === 0 ? <Empty message="No hay abonados en este grupo. Créalos en Abonados." /> : null}

            <Link href="/sorteos/abonados" asChild>
              <Pressable style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: colors.emerald, fontWeight: '600', fontSize: 13 }}>Gestionar abonados →</Text>
              </Pressable>
            </Link>

            {otros.length > 0 ? (
              <>
                <SectionTitle>Otros abonados ({otros.length})</SectionTitle>
                <Card>
                  {otros.map((a) => (
                    <AbonadoSinPago key={a.id} abonado={a} />
                  ))}
                </Card>
              </>
            ) : null}

            {msg ? <ErrorBox message={msg} /> : null}
          </>
        )}
      </Screen>
    </>
  )
}

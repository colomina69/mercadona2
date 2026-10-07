import { Link, Stack } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Card, Empty, ErrorBox, Loading, Screen } from '@/components/ui'
import { dateOnly, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { Pago, Sorteo } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function SorteosScreen() {
  const { data, error, loading } = useAsync(async () => {
    const [sorteosRes, pagosRes] = await Promise.all([
      insforge.database.from('sorteos').select('*').order('fecha', { ascending: false }),
      insforge.database.from('pagos').select('id, sorteo_id, estado, cantidad, metodo_pago'),
    ])
    if (sorteosRes.error) throw new Error(sorteosRes.error.message)
    return {
      sorteos: (sorteosRes.data ?? []) as Sorteo[],
      pagos: (pagosRes.data ?? []) as Pago[],
    }
  })

  const agg = new Map<string, { total: number; paid: number; pending: number; recaudado: number }>()
  for (const p of data?.pagos ?? []) {
    const a = agg.get(p.sorteo_id) ?? { total: 0, paid: 0, pending: 0, recaudado: 0 }
    a.total += 1
    if (p.estado === 'paid') {
      a.paid += 1
      a.recaudado += p.cantidad
    } else {
      a.pending += 1
    }
    agg.set(p.sorteo_id, a)
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sorteos' }} />
      <Screen>
        <Link href="/sorteos/nuevo" asChild>
          <Pressable>
            <Card style={{ backgroundColor: colors.emerald }}>
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 15 }}>
                ➕ Nuevo sorteo
              </Text>
            </Card>
          </Pressable>
        </Link>

        <Link href="/sorteos/abonados" asChild>
          <Pressable>
            <Card>
              <Text style={{ fontWeight: '700', textAlign: 'center', fontSize: 15, color: colors.text }}>
                👥 Abonados
              </Text>
            </Card>
          </Pressable>
        </Link>

        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.sorteos.length ? <Empty message="Sin sorteos" /> : (
          data.sorteos.map((s) => {
            const a = agg.get(s.id) ?? { total: 0, paid: 0, pending: 0, recaudado: 0 }
            const importe = a.recaudado * Number(s.precio)
            return (
              <Link key={s.id} href={`/sorteos/${s.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: colors.text }}>{s.nombre}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {dateOnly(s.fecha)} · {s.tipo === 'especial' ? 'extraordinario' : 'mensual'} · {eur(Number(s.precio))}
                          {s.decimos_totales != null ? ` · ${s.decimos_totales} décimos` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '700', color: colors.text }}>{a.paid}/{a.total}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{eur(importe)}</Text>
                      </View>
                    </View>
                    {a.pending > 0 ? (
                      <Text style={{ color: colors.amber, fontSize: 12, marginTop: 4 }}>
                        {a.pending} pendiente{a.pending > 1 ? 's' : ''}
                      </Text>
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

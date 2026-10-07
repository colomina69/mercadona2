import { Link, Stack, router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { Badge, Card, Empty, ErrorBox, Loading, Screen } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import type { Abonado, Grupo } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const GRUPO_LABEL: Record<Grupo, string> = { mensual: 'Mensual', extraordinario: 'Extraordinario' }

export default function AbonadosScreen() {
  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await insforge.database.from('abonados').select('*').order('nombre')
    if (error) throw new Error(error.message)
    return (data ?? []) as Abonado[]
  })

  return (
    <>
      <Stack.Screen options={{ title: 'Abonados' }} />
      <Screen>
        <Pressable onPress={() => router.push('/sorteos/abonados/nuevo')}>
          <Card style={{ backgroundColor: colors.emerald }}>
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 15 }}>
              ➕ Nuevo abonado
            </Text>
          </Card>
        </Pressable>

        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty message="Sin abonados" /> : (
          <>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
              {data.length} abonados · {data.filter((a) => a.activo).length} activos
            </Text>
            {data.map((a) => (
              <Link key={a.id} href={`/sorteos/abonados/${a.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: colors.text }}>{a.nombre}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {(a.grupos ?? []).map((g) => (
                            <Badge key={g} text={GRUPO_LABEL[g] ?? g} tone={g === 'extraordinario' ? 'amber' : 'green'} />
                          ))}
                          {!a.activo ? <Badge text="Inactivo" tone="slate" /> : null}
                        </View>
                      </View>
                      <Text style={{ color: colors.faint }}>›</Text>
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </>
        )}
        <Text style={{ color: colors.faint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Desliza y toca un abonado para editar.
        </Text>
      </Screen>
    </>
  )
}

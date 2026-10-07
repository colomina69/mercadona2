import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { AbonadoForm } from '@/components/AbonadoForm'
import { Badge, Card, Empty, ErrorBox, Loading, PrimaryButton, Screen, SectionTitle } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import type { Abonado, Pago } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

export default function EditarAbonadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const [abonadoRes, pagosRes] = await Promise.all([
      insforge.database.from('abonados').select('*').eq('id', id).maybeSingle(),
      insforge.database.from('pagos').select('*').eq('abonado_id', id),
    ])
    if (abonadoRes.error) throw new Error(abonadoRes.error.message)
    return { abonado: abonadoRes.data as Abonado | null, pagos: (pagosRes.data ?? []) as Pago[] }
  }, [id])

  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setDelError(null)
    const { error } = await insforge.database.from('abonados').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      setDelError(error.message)
      return
    }
    router.replace('/sorteos/abonados')
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar abonado' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.abonado ? <Empty message="No encontrado" /> : (
          <>
            <SectionTitle>Datos del abonado</SectionTitle>
            <AbonadoForm
              initial={data.abonado}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                const { error } = await insforge.database.from('abonados').update(values).eq('id', id)
                if (error) return { error: error.message }
                reload()
                router.back()
                return {}
              }}
            />

            <SectionTitle>Pagos ({data.pagos.length})</SectionTitle>
            {data.pagos.length === 0 ? <Empty message="Sin pagos" /> : (
              <Card>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {data.pagos.map((p) => (
                    <Badge key={p.id} text={`${p.estado === 'paid' ? 'pagado' : 'pendiente'} · ${p.cantidad}`} tone={p.estado === 'paid' ? 'green' : 'amber'} />
                  ))}
                </View>
              </Card>
            )}

            <SectionTitle>Zona peligrosa</SectionTitle>
            <PrimaryButton title="Eliminar abonado" tone="danger" onPress={remove} loading={deleting} />
            {delError ? <ErrorBox message={delError} /> : null}
            <Text style={{ color: colors.faint, fontSize: 12 }}>
              Eliminar un abonado borra también sus pagos.
            </Text>
          </>
        )}
      </Screen>
    </>
  )
}

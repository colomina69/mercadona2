import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { SorteoForm } from '@/components/SorteoForm'
import { ErrorBox, Loading, PrimaryButton, Screen, SectionTitle } from '@/components/ui'
import { insforge } from '@/lib/insforge'
import type { Sorteo } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'

export default function EditarSorteoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, reload } = useAsync(async () => {
    const { data, error } = await insforge.database.from('sorteos').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data as Sorteo | null
  }, [id])
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)

  async function remove() {
    setDeleting(true)
    setDelError(null)
    const { error } = await insforge.database.from('sorteos').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      setDelError(error.message)
      return
    }
    router.replace('/sorteos')
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar sorteo' }} />
      <Screen>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data ? <ErrorBox message="No encontrado" /> : (
          <>
            <SectionTitle>Datos del sorteo</SectionTitle>
            <SorteoForm
              initial={data}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                const { error } = await insforge.database.from('sorteos').update(values).eq('id', id)
                if (error) return { error: error.message }
                reload()
                router.back()
                return {}
              }}
            />
            <SectionTitle>Zona peligrosa</SectionTitle>
            <PrimaryButton title="Eliminar sorteo" tone="danger" onPress={remove} loading={deleting} />
            {delError ? <ErrorBox message={delError} /> : null}
          </>
        )}
      </Screen>
    </>
  )
}

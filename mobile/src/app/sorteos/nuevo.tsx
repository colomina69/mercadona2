import { Stack, router } from 'expo-router'
import { Screen, SectionTitle } from '@/components/ui'
import { SorteoForm } from '@/components/SorteoForm'
import { insforge } from '@/lib/insforge'

export default function NuevoSorteoScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo sorteo' }} />
      <Screen>
        <SectionTitle>Datos del sorteo</SectionTitle>
        <SorteoForm
          submitLabel="Crear sorteo"
          onSubmit={async (values) => {
            const { data, error } = await insforge.database.from('sorteos').insert([values]).select('id')
            if (error) return { error: error.message }
            const id = (data?.[0] as { id: string } | undefined)?.id
            if (id) router.replace(`/sorteos/${id}`)
            else router.back()
            return {}
          }}
        />
      </Screen>
    </>
  )
}

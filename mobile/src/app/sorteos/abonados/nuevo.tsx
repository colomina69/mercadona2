import { Stack, router } from 'expo-router'
import { AbonadoForm } from '@/components/AbonadoForm'
import { Screen, SectionTitle } from '@/components/ui'
import { insforge } from '@/lib/insforge'

export default function NuevoAbonadoScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo abonado' }} />
      <Screen>
        <SectionTitle>Datos del abonado</SectionTitle>
        <AbonadoForm
          submitLabel="Crear abonado"
          onSubmit={async (values) => {
            const { error } = await insforge.database.from('abonados').insert([values])
            if (error) return { error: error.message }
            router.back()
            return {}
          }}
        />
      </Screen>
    </>
  )
}

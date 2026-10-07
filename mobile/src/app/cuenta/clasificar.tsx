import { Stack, router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Badge, Card, Empty, ErrorBox, Loading, Screen, SectionMenu } from '@/components/ui'
import { YearFilter } from '@/components/YearFilter'
import { dateOnly, eur } from '@/lib/format'
import { insforge } from '@/lib/insforge'
import type { BankCategory } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { colors } from '@/lib/theme'

const MENU = [
  { label: 'Movimientos', href: '/cuenta/movimientos' },
  { label: 'Clasificar', href: '/cuenta/clasificar' },
  { label: 'Categorías', href: '/cuenta/categorias' },
]

type Move = {
  id: string
  operation_date: string | null
  description: string | null
  concept: string | null
  amount: number | null
  category_id: string | null
}

export default function ClasificarScreen() {
  const { data, error, loading } = useAsync(async () => {
    const [movsRes, catsRes] = await Promise.all([
      insforge.database
        .from('bank_transactions')
        .select('id, operation_date, description, concept, amount, category_id')
        .order('operation_date', { ascending: false })
        .limit(1000),
      insforge.database.from('bank_categories').select('id, name, kind, color, sort_order').order('kind').order('sort_order'),
    ])
    if (movsRes.error) throw new Error(movsRes.error.message)
    return { movements: (movsRes.data ?? []) as Move[], categories: (catsRes.data ?? []) as BankCategory[] }
  })

  const [year, setYear] = useState<number | null>(null)
  const [onlyUncat, setOnlyUncat] = useState(true)

  const movements = data?.movements ?? []
  const categories = data?.categories ?? []
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const r of movements) if (r.operation_date) set.add(Number(String(r.operation_date).slice(0, 4)))
    return Array.from(set).filter((y) => !Number.isNaN(y)).sort((a, b) => b - a)
  }, [movements])

  const filtered = useMemo(
    () =>
      movements.filter((r) => {
        if (onlyUncat && r.category_id) return false
        if (year && String(r.operation_date ?? '').slice(0, 4) !== String(year)) return false
        return true
      }),
    [movements, onlyUncat, year],
  )

  return (
    <>
      <Stack.Screen options={{ title: 'Clasificar' }} />
      <Screen>
        <SectionMenu items={MENU} active="/cuenta/clasificar" />
        <YearFilter years={years} value={year} onChange={setYear} />
        <Pressable
          onPress={() => setOnlyUncat((v) => !v)}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: onlyUncat ? colors.emerald : '#eef2f6' }}
        >
          <Text style={{ color: onlyUncat ? '#fff' : colors.muted, fontSize: 13, fontWeight: '600' }}>
            Solo sin categoría ({movements.filter((m) => !m.category_id).length})
          </Text>
        </Pressable>

        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <>
            <Text style={{ color: colors.muted, fontSize: 13 }}>{filtered.length} movimientos · toca para clasificar y vincular</Text>
            {filtered.length === 0 ? (
              <Empty message={onlyUncat ? 'No quedan movimientos sin categoría 🎉' : 'Sin movimientos'} />
            ) : (
              filtered.map((r) => {
                const cat = r.category_id ? catById.get(r.category_id) : null
                return (
                  <Pressable key={r.id} onPress={() => router.push(`/cuenta/vincular/${r.id}`)}>
                    <Card>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={2}>
                            {r.concept?.trim() || r.description || '—'}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{dateOnly(r.operation_date)}</Text>
                          <View style={{ marginTop: 6 }}>
                            <Badge text={cat?.name ?? 'Sin categoría'} tone={cat ? 'green' : 'amber'} />
                          </View>
                        </View>
                        <Text style={{ fontWeight: '700', color: (r.amount ?? 0) < 0 ? colors.danger : colors.emerald }}>
                          {eur(r.amount)}
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                )
              })
            )}
          </>
        )}
      </Screen>
    </>
  )
}

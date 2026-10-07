import { Pressable, ScrollView, Text } from 'react-native'
import { colors } from '@/lib/theme'

export function YearFilter({
  years,
  value,
  onChange,
}: {
  years: number[]
  value: number | null
  onChange: (year: number | null) => void
}) {
  const options: { label: string; v: number | null }[] = [
    { label: 'Todos', v: null },
    ...years.map((y) => ({ label: String(y), v: y })),
  ]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 16 }}
    >
      {options.map((o) => {
        const active = o.v === value
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.v)}
            style={{
              paddingHorizontal: 16,
              minHeight: 40,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: active ? colors.emerald : '#eef2f6',
            }}
          >
            <Text style={{ color: active ? '#fff' : colors.muted, fontWeight: '600', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

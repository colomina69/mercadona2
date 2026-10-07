import { StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '@/lib/theme'

export type Point = { label: string; value: number }

export function BarChart({
  data,
  format,
  color = colors.emerald,
  height = 150,
}: {
  data: Point[]
  format?: (v: number) => string
  color?: string
  height?: number
}) {
  if (!data.length) {
    return <Text style={styles.empty}>Sin datos</Text>
  }
  const max = Math.max(...data.map((d) => d.value), 0) || 1
  const barMax = Math.max(...data.map((d) => d.value), 0) || 1
  return (
    <View>
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(4, Math.round((d.value / barMax) * (height - 28)))
          return (
            <View key={`${d.label}-${i}`} style={styles.barWrap}>
              <Text style={styles.barValue}>{format ? format(d.value) : compact(d.value)}</Text>
              <View style={[styles.bar, { height: h, backgroundColor: color }]} />
            </View>
          )
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={`${d.label}-${i}`} style={styles.barLabel} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
      <Text style={styles.axis}>máx. {max.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</Text>
    </View>
  )
}

export function RankBars({
  data,
  format,
  color = colors.emerald,
}: {
  data: Point[]
  format?: (v: number) => string
  color?: string
}) {
  if (!data.length) return <Text style={styles.empty}>Sin datos</Text>
  const max = Math.max(...data.map((d) => d.value), 0) || 1
  return (
    <View style={styles.rankWrap}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.rankRow}>
          <View style={styles.rankHead}>
            <Text style={styles.rankLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.rankValue}>{format ? format(d.value) : d.value.toLocaleString('es-ES')}</Text>
          </View>
          <View style={styles.rankTrack}>
            <View style={[styles.rankFill, { width: `${(d.value / max) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  )
}

function compact(v: number): string {
  return v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 4 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm },
  barValue: { fontSize: 9, color: colors.faint },
  labels: { flexDirection: 'row', gap: 6, marginTop: 4 },
  barLabel: { flex: 1, fontSize: 9, color: colors.muted, textAlign: 'center' },
  axis: { fontSize: 10, color: colors.faint, marginTop: 4, textAlign: 'right' },
  empty: { color: colors.faint, fontSize: 13, paddingVertical: 12 },
  rankWrap: { gap: 10 },
  rankRow: { gap: 4 },
  rankHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rankLabel: { color: colors.text, fontSize: 13, flexShrink: 1 },
  rankValue: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  rankTrack: { height: 8, borderRadius: 999, backgroundColor: '#eef2f6', overflow: 'hidden' },
  rankFill: { height: 8, borderRadius: 999 },
})

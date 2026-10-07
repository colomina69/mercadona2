import { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors, radius } from '@/lib/theme'

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  )
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  )
}

export function Badge({ text, tone = 'slate' }: { text: string; tone?: 'slate' | 'green' | 'amber' | 'red' }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    slate: { bg: '#f1f5f9', fg: '#475569' },
    green: { bg: '#ecfdf5', fg: '#047857' },
    amber: { bg: '#fffbeb', fg: '#b45309' },
    red: { bg: '#fef2f2', fg: '#b91c1c' },
  }
  const t = tones[tone]
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{text}</Text>
    </View>
  )
}

export function BigButton({
  emoji,
  title,
  description,
  href,
  accent = colors.emeraldSoft,
  onPress,
}: {
  emoji: string
  title: string
  description?: string
  href?: string
  accent?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => href && router.push(href as never))}
      style={({ pressed }) => [styles.bigButton, pressed && styles.pressed]}
    >
      <View style={[styles.bigIcon, { backgroundColor: accent }]}>
        <Text style={styles.bigIconText}>{emoji}</Text>
      </View>
      <View style={styles.bigMain}>
        <Text style={styles.bigTitle}>{title}</Text>
        {description ? <Text style={styles.bigDesc}>{description}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

export function SectionMenu({
  items,
  active,
}: {
  items: { label: string; href: string }[]
  active: string
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.menu}
    >
      {items.map((item) => {
        const isActive = item.href === active
        return (
          <Pressable
            key={item.href}
            onPress={() => !isActive && router.push(item.href as never)}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export function PrimaryButton({
  title,
  onPress,
  tone = 'emerald',
  disabled,
  loading,
}: {
  title: string
  onPress: () => void
  tone?: 'emerald' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
}) {
  const bg = tone === 'emerald' ? colors.emerald : tone === 'danger' ? colors.danger : '#fff'
  const fg = tone === 'ghost' ? colors.text : '#fff'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: bg, borderColor: tone === 'ghost' ? colors.border : bg },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.primaryText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  )
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        style={styles.input}
        {...props}
      />
    </View>
  )
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.emerald} />
    </View>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

export function Empty({ message = 'Sin datos' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

export function LinkButton({ title, href }: { title: string; href: string }) {
  return (
    <Pressable onPress={() => router.push(href as never)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  stat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.faint },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statHint: { fontSize: 11, color: colors.muted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  rowValue: { color: colors.text, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  rowValueStrong: { fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 92,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  bigIcon: { width: 56, height: 56, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  bigIconText: { fontSize: 28 },
  bigMain: { flex: 1, gap: 2 },
  bigTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  bigDesc: { fontSize: 13, color: colors.muted },
  chevron: { fontSize: 22, color: colors.faint },
  menu: { gap: 8, paddingVertical: 2, paddingRight: 16 },
  pill: {
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#eef2f6',
  },
  pillActive: { backgroundColor: colors.emerald },
  pillText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#fff' },
  primary: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  center: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.faint, fontSize: 14 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 14 },
  errorText: { color: colors.danger, fontSize: 14 },
  link: { paddingVertical: 8 },
  linkText: { color: colors.emerald, fontWeight: '600', fontSize: 14 },
})

export function resolveRange(year?: string, from?: string, to?: string): { from: string; to: string } {
  if (year && /^\d{4}$/.test(year)) return { from: `${year}-01-01`, to: `${year}-12-31` }
  return { from: from ?? '', to: to ?? '' }
}

export function yearsFromMonthly(monthly: { month: string }[] | null | undefined): number[] {
  const set = new Set<number>()
  for (const m of monthly ?? []) {
    const y = Number(String(m.month).slice(0, 4))
    if (!Number.isNaN(y)) set.add(y)
  }
  return Array.from(set).sort((a, b) => b - a)
}

export type YearRange = { p_from: string | null; p_to: string | null }

export function yearRange(year: number | null): YearRange {
  if (year == null) return { p_from: null, p_to: null }
  return { p_from: `${year}-01-01`, p_to: `${year}-12-31` }
}

export function yearsFromMonthly(monthly: { month: string }[] | null | undefined): number[] {
  const set = new Set<number>()
  for (const m of monthly ?? []) {
    const y = Number(String(m.month).slice(0, 4))
    if (!Number.isNaN(y)) set.add(y)
  }
  return Array.from(set).sort((a, b) => b - a)
}

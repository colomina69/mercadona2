export function eur(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

export function num(value: number | null | undefined, maxFrac = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: maxFrac }).format(value)
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function pricePer(unit: string | null | undefined, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const suffix = unit === 'kg' ? '€/kg' : '€/ud'
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${suffix}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const idx = Number(m) - 1
  return `${names[idx] ?? m} ${y?.slice(2) ?? ''}`.trim()
}

export function fixed(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function kwh(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)} kWh`
}

export function eurPerKwh(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : `${fixed(value, 5)} €/kWh`
}

export function eurPerKwDay(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : `${fixed(value, 6)} €/kW·día`
}

'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'
import { eur, monthLabel, dateOnly } from '@/lib/format'

export function MonthlySpendChart({ data }: { data: { month: string; total: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" fontSize={11} interval="preserveStartEnd" tickLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function StoreSpendChart({ data }: { data: { store: string | null; city: string | null; total: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.store ?? '—' }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" fontSize={11} tickLine={false} />
        <YAxis type="category" dataKey="label" fontSize={11} width={140} tickLine={false} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Bar dataKey="total" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TopProductsChart({ data }: { data: { product: string; total: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.product }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 28)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" fontSize={11} tickLine={false} />
        <YAxis type="category" dataKey="label" fontSize={11} width={160} tickLine={false} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PriceHistoryChart({
  data,
}: {
  data: { purchased_at: string | null; unit_price_eff: number | null }[]
}) {
  const rows = data
    .filter((d) => d.unit_price_eff != null)
    .map((d) => ({ date: dateOnly(d.purchased_at), price: d.unit_price_eff }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={rows} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="date" fontSize={11} interval="preserveStartEnd" tickLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
        <Tooltip formatter={(v) => eur(Number(v))} />
        <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

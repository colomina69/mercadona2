export type Ticket = {
  id: string
  message_id: string
  ticket_number: string | null
  purchased_at: string | null
  store_name: string | null
  store_cif: string | null
  store_address: string | null
  store_postal_code: string | null
  store_city: string | null
  store_phone: string | null
  operator_code: string | null
  entry_time: string | null
  exit_time: string | null
  item_count: number | null
  subtotal: number | null
  total: number | null
  payment_method: string | null
  card_last4: string | null
  nc: string | null
  auth_code: string | null
  vat_summary: { rate: number; base: number; amount: number }[] | null
  pdf_key: string | null
  pdf_url: string | null
}

export type TicketItem = {
  id: string
  ticket_id: string
  line_no: number | null
  product_name: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  weight_kg: number | null
  amount: number | null
  vat_rate: number | null
}

export type ProductRow = {
  product_name: string
  purchases: number
  last_date: string | null
  last_price: number | null
  avg_price: number | null
}

export type HistoryRow = {
  purchased_at: string | null
  store_name: string | null
  store_city: string | null
  quantity: number | null
  unit: string | null
  unit_price_eff: number | null
  price_kg: number | null
  amount: number | null
}

export type SpendSummary = {
  totals: { tickets: number; total: number; avg_ticket: number }
  monthly: { month: string; total: number; count: number }[]
  by_store: { store: string | null; city: string | null; total: number; count: number }[]
  top_products: { product: string; total: number; count: number }[]
}

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

export type BankTransaction = {
  id: string
  operation_date: string | null
  value_date: string | null
  description: string | null
  concept: string | null
  amount: number | null
  balance: number | null
  counterparty_tax_id: string | null
  reference: string | null
  source_file: string | null
  raw_key: string | null
  category_id: string | null
  category?: { name: string; kind: 'expense' | 'income' } | null
}

export type BankCategory = {
  id: string
  name: string
  kind: 'expense' | 'income'
  color: string | null
  sort_order: number
}

export type BankLink = {
  id: string
  transaction_id: string
  target_type: 'ticket' | 'invoice'
  target_id: string
}

export type LinkedTicket = {
  id: string
  ticket_number: string | null
  purchased_at: string | null
  store_name: string | null
  store_city: string | null
  total: number | null
}

export type TicketCandidate = {
  id: string
  ticket_number: string | null
  purchased_at: string | null
  store_name: string | null
  store_city: string | null
  total: number | null
  date_diff: number
  linked: boolean
}

export type BankSummary = {
  totals: {
    transactions: number
    inflow: number
    outflow: number
    net: number
    last_balance: number | null
  }
  monthly: { month: string; inflow: number; outflow: number }[]
  by_category: { category: string; kind: 'expense' | 'income'; total: number; count: number }[]
}

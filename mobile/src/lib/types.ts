export type Ticket = {
  id: string
  ticket_number: string | null
  purchased_at: string | null
  store_name: string | null
  store_city: string | null
  store_address?: string | null
  total: number | null
  item_count: number | null
  payment_method: string | null
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

export type BankAccountBalance = {
  account_iban: string
  account_name: string | null
  balance: number | null
  currency: string | null
  as_of: string | null
}

export type IberdrolaContract = {
  id: string
  contract_number: string
  label: string | null
  cups: string | null
  supply_address: string | null
  city: string | null
  titular: string | null
  tariff: string | null
  market: string | null
  plan: string | null
  contracted_power_punta: number | null
  contracted_power_valle: number | null
}

export type IberdrolaInvoice = {
  id: string
  contract_id: string | null
  contract_number: string | null
  invoice_number: string
  issue_date: string | null
  period_start: string | null
  period_end: string | null
  tariff: string | null
  total: number | null
  energy_amount: number | null
  consumption_kwh: number | null
  pdf_key: string | null
  pdf_url: string | null
  contract?: { label: string | null; contract_number: string } | null
}

export type IberdrolaInvoiceLine = {
  id: string
  invoice_id: string
  line_no: number
  grp: string | null
  line_type: string | null
  tramo: string | null
  concept: string | null
  detail: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  days: number | null
  amount: number | null
  vat_rate: number | null
}

export type IberdrolaConsumption = {
  id: string
  invoice_id: string
  tramo: string
  kwh: number | null
}

export type IberdrolaSummary = {
  totals: {
    invoices: number
    kwh: number
    total: number
    energy: number
    eur_per_kwh: number | null
  }
  by_contract: {
    contract_id: string | null
    contract_number: string | null
    label: string
    tariff: string | null
    invoices: number
    kwh: number
    total: number
    energy: number
    eur_per_kwh: number | null
  }[]
  monthly: { month: string; kwh: number; total: number; energy: number }[]
  consumption_by_tramo: { tramo: string; kwh: number }[]
}

export type WayletTicket = {
  id: string
  ticket_number: string
  purchased_at: string | null
  station_name: string | null
  address: string | null
  locality: string | null
  fuel_type: string | null
  liters: number | null
  unit_price: number | null
  gross_amount: number | null
  discount_amount: number | null
  total: number | null
  payment_method: string | null
  card_last4: string | null
  pdf_key: string | null
  pdf_url: string | null
}

export type WayletLine = {
  id: string
  ticket_id: string
  line_no: number
  product_name: string | null
  unit_price: number | null
  amount: number | null
}

export type WayletSummary = {
  totals: {
    tickets: number
    liters: number
    total: number
    gross: number
    discount: number
    eur_per_l: number | null
    eur_per_l_paid: number | null
  }
  monthly: { month: string; liters: number; total: number; eur_per_l: number | null }[]
  by_station: { station: string; locality: string | null; tickets: number; liters: number; total: number }[]
  by_fuel: { fuel: string; tickets: number; liters: number; total: number }[]
}

export type Sorteo = {
  id: string
  nombre: string
  fecha: string
  precio: number
  created_at: string | null
  tipo: 'mensual' | 'especial'
  decimos_totales: number | null
}

export type Pago = {
  id: string
  abonado_id: string
  sorteo_id: string
  estado: 'pending' | 'paid' | string
  fecha_pago: string | null
  created_at: string | null
  metodo_pago: string | null
  cantidad: number
}

export type Grupo = 'mensual' | 'extraordinario'

export type Abonado = {
  id: string
  nombre: string
  grupos: Grupo[]
  activo: boolean
  created_at: string | null
}

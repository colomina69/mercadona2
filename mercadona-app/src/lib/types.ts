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
  target_type: 'ticket' | 'invoice' | 'waylet'
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

export type BankAccountBalance = {
  account_iban: string
  account_name: string | null
  balance: number | null
  currency: string | null
  as_of: string | null
  source: string | null
}

export type IberdrolaContract = {
  id: string
  contract_number: string
  label: string | null
  cups: string | null
  supply_address: string | null
  city: string | null
  titular: string | null
  nif: string | null
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
  due_date: string | null
  tariff: string | null
  days_billed: number | null
  total: number | null
  subtotal: number | null
  energy_amount: number | null
  charges_amount: number | null
  services_amount: number | null
  tax_amount: number | null
  consumption_kwh: number | null
  cups: string | null
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
  period: string | null
  concept: string | null
  detail: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  days: number | null
  amount: number | null
  tax_base: number | null
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
    first_invoice: string | null
    last_invoice: string | null
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
  power_by_contract: {
    contract_id: string | null
    avg_eur_per_kw_day: number | null
    punta: number | null
    valle: number | null
  }[]
  monthly: { month: string; kwh: number; total: number; energy: number }[]
  consumption_by_tramo: { tramo: string; kwh: number }[]
}

export type InvoiceCandidate = {
  id: string
  invoice_number: string
  issue_date: string | null
  period_start: string | null
  period_end: string | null
  total: number | null
  consumption_kwh: number | null
  contract_number: string | null
  date_diff: number
  linked: boolean
}

export type IberdrolaPricePoint = {
  contract_id: string | null
  label: string
  issue_date: string
  energy_eur_kwh: number | null
  power_punta: number | null
  power_valle: number | null
}

export type WayletTicket = {
  id: string
  ticket_number: string
  purchased_at: string | null
  station_name: string | null
  address: string | null
  postal_code: string | null
  locality: string | null
  fuel_type: string | null
  liters: number | null
  unit_price: number | null
  gross_amount: number | null
  discount_amount: number | null
  total: number | null
  payment_method: string | null
  card_last4: string | null
  vehicle_plate: string | null
  points: number | null
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
    first_ticket: string | null
    last_ticket: string | null
  }
  monthly: { month: string; liters: number; total: number; eur_per_l: number | null }[]
  by_station: { station: string; locality: string | null; tickets: number; liters: number; total: number }[]
  by_fuel: { fuel: string; tickets: number; liters: number; total: number }[]
}

export type WayletCandidate = {
  id: string
  ticket_number: string
  purchased_at: string | null
  station_name: string | null
  locality: string | null
  fuel_type: string | null
  liters: number | null
  unit_price: number | null
  total: number | null
  date_diff: number
  linked: boolean
}

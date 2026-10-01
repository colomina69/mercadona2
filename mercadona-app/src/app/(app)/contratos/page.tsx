import Link from 'next/link'
import { createInsForgeServerClient } from '@/lib/insforge/server'
import type { IberdrolaContract, IberdrolaSummary } from '@/lib/types'
import { eur, num, kwh, eurPerKwh, eurPerKwDay } from '@/lib/format'

export default async function ContratosPage() {
  const insforge = createInsForgeServerClient()
  const [summaryRes, contractsRes] = await Promise.all([
    insforge.database.rpc('iberdrola_summary', {}),
    insforge.database.from('iberdrola_contracts').select('*').order('contract_number'),
  ])

  const summary = (summaryRes.data ?? null) as IberdrolaSummary | null
  const contracts = (contractsRes.data ?? []) as IberdrolaContract[]
  const power = new Map((summary?.power_by_contract ?? []).map((p) => [p.contract_id ?? '', p]))
  const byContract = new Map((summary?.by_contract ?? []).map((b) => [b.contract_id ?? '', b]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contratos Iberdrola</h1>
        <Link href="/facturas" className="text-sm text-sky-700 hover:underline">
          Facturas →
        </Link>
      </div>
      <p className="text-sm text-slate-500">Comparativa de consumo, €/kWh de energía y €/kW·día de potencia por contrato.</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {contracts.map((c) => {
          const s = byContract.get(c.id)
          const p = power.get(c.id)
          return (
            <section key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{c.label ?? c.contract_number}</h2>
                  <p className="text-xs text-slate-400">
                    Contrato {c.contract_number} · {c.tariff ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{c.supply_address ?? ''}</p>
                </div>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {c.contracted_power_punta ?? '—'} kW
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Facturas</p>
                  <p className="font-medium">{num(s?.invoices ?? 0, 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Consumo</p>
                  <p className="font-medium">{kwh(s?.kwh ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="font-medium">{eur(s?.total ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Energía €/kWh</p>
                  <p className="font-medium">{eurPerKwh(s?.eur_per_kwh ?? null)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Potencia punta</p>
                  <p className="font-medium">{eurPerKwDay(p?.punta ?? null)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">Potencia valle</p>
                  <p className="font-medium">{eurPerKwDay(p?.valle ?? null)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 text-xs text-slate-400">
                <Link href={`/contratos/${c.id}`} className="text-sky-700 hover:underline">
                  Detalle
                </Link>
                <Link href={`/facturas?contract=${c.id}`} className="text-sky-700 hover:underline">
                  Facturas
                </Link>
              </div>
            </section>
          )
        })}
        {contracts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            Todavía no hay contratos. Importa facturas de Iberdrola para verlos.
          </p>
        )}
      </div>
    </div>
  )
}

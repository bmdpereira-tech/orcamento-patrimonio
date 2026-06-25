import { Plus } from "lucide-react";
import { getActiveInvestmentAssets, INITIAL_INVESTMENT_ASSETS } from "@/domain/budget/accounts";
import { FIRST_MONTH, formatMonthLabel } from "@/domain/budget/months";

export default function InvestmentsPage() {
  const assets = getActiveInvestmentAssets(INITIAL_INVESTMENT_ASSETS, FIRST_MONTH);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">Investimentos</p>
          <h1 className="text-2xl font-semibold text-slate-950">Activos</h1>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Activo
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{asset.name}</td>
                <td className="px-4 py-3 text-slate-700">{formatMonthLabel(asset.startMonth)}</td>
                <td className="px-4 py-3 text-slate-700">Activo</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

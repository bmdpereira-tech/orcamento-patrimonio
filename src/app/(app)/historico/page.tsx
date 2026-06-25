import { formatEuroCents } from "@/domain/budget/money";
import { formatMonthLabel } from "@/domain/budget/months";
import { getSupabaseMonthlyHistory } from "@/server/budget/monthly-history";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const historyResult = await getSupabaseMonthlyHistory()
    .then((rows) => ({ rows, error: null }))
    .catch((error: unknown) => ({
      rows: [],
      error: error instanceof Error ? error.message : "Não foi possível carregar o histórico.",
    }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Histórico</p>
        <h1 className="text-2xl font-semibold text-slate-950">Evolução mensal</h1>
      </div>

      {historyResult.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {historyResult.error}
        </div>
      ) : null}

      {!historyResult.error ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {historyResult.rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-700">Ainda não existem meses fechados para apresentar.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mês</th>
                  <th className="px-4 py-3 text-right">Variação de liquidez</th>
                  <th className="px-4 py-3 text-right">Variação de investimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyResult.rows.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMonthLabel(row.month)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatEuroCents(row.liquidityVariationCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatEuroCents(row.investmentVariationCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}

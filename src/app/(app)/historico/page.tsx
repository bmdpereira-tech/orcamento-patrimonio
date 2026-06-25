import { LineChart } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Histórico</p>
        <h1 className="text-2xl font-semibold text-slate-950">Evolução mensal</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-700">
          <LineChart className="h-5 w-5 text-brand-700" aria-hidden="true" />
          <p className="text-sm">Os gráficos mensais serão ligados ao motor financeiro na fase de histórico.</p>
        </div>
      </section>
    </div>
  );
}

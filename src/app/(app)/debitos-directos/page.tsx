import { Plus } from "lucide-react";

export default function RecurringPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">Débitos directos</p>
          <h1 className="text-2xl font-semibold text-slate-950">Despesas recorrentes</h1>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Regra
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">Sem regras recorrentes configuradas.</p>
      </section>
    </div>
  );
}

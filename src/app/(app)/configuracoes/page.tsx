import { FIRST_MONTH, formatMonthLabel } from "@/domain/budget/months";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Configurações</p>
        <h1 className="text-2xl font-semibold text-slate-950">Regras mensais</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Primeiro mês</h2>
          <p className="mt-2 text-sm text-slate-700">{formatMonthLabel(FIRST_MONTH)}</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Salário</h2>
          <p className="mt-2 text-sm text-slate-700">Sem versão configurada.</p>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">Day to day</h2>
          <p className="mt-2 text-sm text-slate-700">Sem versão configurada.</p>
        </section>
      </div>
    </div>
  );
}

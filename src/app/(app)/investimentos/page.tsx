import { Plus } from "lucide-react";
import { InvestmentManagement } from "@/components/investment-management";
import { listInvestmentOverview } from "@/server/budget/investments";
import {
  archiveInvestmentAssetAction,
  createInvestmentAssetAction,
  createInvestmentCashFlowAction,
  createInvestmentValuationAction,
  deleteInvestmentAssetAction,
  deleteInvestmentCashFlowAction,
  deleteInvestmentValuationAction,
  reactivateInvestmentAssetAction,
  updateInvestmentAssetAction,
  updateInvestmentCashFlowAction,
  updateInvestmentValuationAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const investmentsResult = await listInvestmentOverview()
    .then((overview) => ({ overview, error: null }))
    .catch((error: unknown) => ({
      overview: null,
      error: error instanceof Error ? error.message : "Não foi possível carregar os investimentos.",
    }));

  return (
    <div className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1800px] -translate-x-1/2 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">Investimentos</p>
          <h1 className="text-2xl font-semibold text-slate-950">Activos</h1>
        </div>
        <a
          href="#new-investment-name"
          className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Investimento
        </a>
      </div>

      {investmentsResult.error || !investmentsResult.overview ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {investmentsResult.error ?? "Não foi possível carregar os investimentos."}
        </div>
      ) : (
        <InvestmentManagement
          overview={investmentsResult.overview}
          createAssetAction={createInvestmentAssetAction}
          updateAssetAction={updateInvestmentAssetAction}
          archiveAssetAction={archiveInvestmentAssetAction}
          reactivateAssetAction={reactivateInvestmentAssetAction}
          deleteAssetAction={deleteInvestmentAssetAction}
          createCashFlowAction={createInvestmentCashFlowAction}
          updateCashFlowAction={updateInvestmentCashFlowAction}
          deleteCashFlowAction={deleteInvestmentCashFlowAction}
          createValuationAction={createInvestmentValuationAction}
          updateValuationAction={updateInvestmentValuationAction}
          deleteValuationAction={deleteInvestmentValuationAction}
        />
      )}
    </div>
  );
}

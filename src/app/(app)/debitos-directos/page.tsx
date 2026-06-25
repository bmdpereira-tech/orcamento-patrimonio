import { RecurringRulesManagement } from "@/components/recurring-rules-management";
import { listManagedAccounts } from "@/server/budget/accounts";
import { listRecurringRules } from "@/server/budget/recurring-rules";
import {
  archiveRecurringRuleAction,
  createRecurringRuleAction,
  deleteRecurringRuleAction,
  reactivateRecurringRuleAction,
  setRecurringRuleActiveAction,
  updateRecurringRuleAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [accounts, recurringRules] = await Promise.all([listManagedAccounts(), listRecurringRules()]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-32px)] max-w-[1500px] -translate-x-1/2 space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-700">Débitos directos</p>
        <h1 className="text-2xl font-semibold text-slate-950">Despesas recorrentes</h1>
      </div>

      <RecurringRulesManagement
        accounts={accounts}
        rules={recurringRules}
        createAction={createRecurringRuleAction}
        updateAction={updateRecurringRuleAction}
        setActiveAction={setRecurringRuleActiveAction}
        archiveAction={archiveRecurringRuleAction}
        reactivateAction={reactivateRecurringRuleAction}
        deleteAction={deleteRecurringRuleAction}
      />
    </div>
  );
}

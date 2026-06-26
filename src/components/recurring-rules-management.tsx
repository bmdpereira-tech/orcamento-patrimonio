"use client";

import { Archive, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccountDisplayName } from "@/domain/budget/accounts";
import {
  isHistoricalImpactActionResult,
  type HistoricalActionResult,
  type HistoricalImpactRequiredActionResult,
} from "@/domain/budget/historical-impact";
import { formatEditableEuroCents, formatEuroCents } from "@/domain/budget/money";
import type { RecurringRule } from "@/domain/budget/recurring-rules";
import type { ManagedAccount } from "@/server/budget/accounts";
import { cn } from "@/lib/cn";
import {
  HistoricalImpactModal,
  type HistoricalImpactPrompt,
  withHistoricalImpactConfirmation,
} from "./historical-impact-modal";

type RuleActionResult = HistoricalActionResult<{ rule: RecurringRule }>;
type DeleteActionResult = HistoricalActionResult;

type RecurringRulesManagementProps = {
  accounts: ManagedAccount[];
  rules: RecurringRule[];
  createAction: (formData: FormData) => Promise<RuleActionResult>;
  updateAction: (formData: FormData) => Promise<RuleActionResult>;
  setActiveAction: (formData: FormData) => Promise<RuleActionResult>;
  archiveAction: (formData: FormData) => Promise<RuleActionResult>;
  reactivateAction: (formData: FormData) => Promise<RuleActionResult>;
  deleteAction: (formData: FormData) => Promise<DeleteActionResult>;
};

type LocalRecurringRule = Omit<RecurringRule, "amountCents" | "chargeDay" | "sortOrder" | "startMonth" | "endMonth"> & {
  amountCents: number;
  amount: string;
  chargeDay: string;
  sortOrder: string;
  startMonth: string;
  endMonth: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 650;

function inputClassName(className = "") {
  return `h-8 w-full rounded-md border-slate-300 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:ring-brand-600 ${className}`;
}

function actionButtonClassName(tone: "primary" | "muted" | "danger" = "muted") {
  const tones = {
    primary: "bg-brand-700 text-white hover:bg-brand-900",
    muted: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };

  return `inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold shadow-sm disabled:cursor-wait disabled:opacity-60 ${tones[tone]}`;
}

function checkboxClassName() {
  return "h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600";
}

function toLocalRule(rule: RecurringRule): LocalRecurringRule {
  return {
    id: rule.id,
    description: rule.description,
    accountId: rule.accountId,
    amountCents: rule.amountCents,
    amount: formatEditableEuroCents(rule.amountCents),
    chargeDay: String(rule.chargeDay),
    frequency: rule.frequency,
    startMonth: rule.startMonth,
    endMonth: rule.endMonth ?? "",
    active: rule.active,
    archivedAt: rule.archivedAt,
    sortOrder: String(rule.sortOrder),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function buildRuleFormData(rule: LocalRecurringRule) {
  const formData = new FormData();
  formData.set("id", rule.id);
  formData.set("description", rule.description);
  formData.set("accountId", rule.accountId);
  formData.set("amount", rule.amount);
  formData.set("chargeDay", rule.chargeDay);
  formData.set("startMonth", rule.startMonth);
  formData.set("endMonth", rule.endMonth);
  formData.set("active", String(rule.active));
  formData.set("sortOrder", rule.sortOrder);

  return formData;
}

function simpleFormData(id: string, values?: Record<string, string>) {
  const formData = new FormData();
  formData.set("id", id);

  for (const [key, value] of Object.entries(values ?? {})) {
    formData.set(key, value);
  }

  return formData;
}

function accountNameById(accounts: readonly ManagedAccount[]) {
  return new Map(accounts.map((account) => [account.id, getAccountDisplayName(account)]));
}

function statusLabel(status: SaveStatus) {
  if (status === "saving") {
    return "A guardar…";
  }

  if (status === "saved") {
    return "Guardado";
  }

  if (status === "error") {
    return "Erro ao guardar";
  }

  return null;
}

export function RecurringRulesManagement({
  accounts,
  rules,
  createAction,
  updateAction,
  setActiveAction,
  archiveAction,
  reactivateAction,
  deleteAction,
}: RecurringRulesManagementProps) {
  const [localRules, setLocalRules] = useState(() => rules.map(toLocalRule));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [historicalPrompt, setHistoricalPrompt] = useState<HistoricalImpactPrompt | null>(null);
  const rulesRef = useRef(localRules);
  const lastSavedRulesRef = useRef(localRules);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveVersionRef = useRef(new Map<string, number>());
  const dirtyRuleIdsRef = useRef(new Set<string>());
  const namesByAccountId = useMemo(() => accountNameById(accounts), [accounts]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const activeAccountOptions = useMemo(() => accounts.filter((account) => !account.archivedFromMonth), [accounts]);
  const activeAccountOptionIds = useMemo(
    () => new Set(activeAccountOptions.map((account) => account.id)),
    [activeAccountOptions],
  );
  const activeRules = localRules.filter((rule) => !rule.archivedAt);
  const archivedRules = localRules.filter((rule) => rule.archivedAt);
  const nextSortOrder =
    localRules.length > 0
      ? Math.max(...localRules.map((rule) => Number(rule.sortOrder) || 0)) + 10
      : 10;
  const currentStatusLabel = statusLabel(saveStatus);

  const getAccountOptionsForRule = useCallback(
    (rule: LocalRecurringRule) => {
      if (activeAccountOptionIds.has(rule.accountId)) {
        return activeAccountOptions;
      }

      const currentAccount = accountsById.get(rule.accountId);

      return currentAccount ? [...activeAccountOptions, currentAccount] : activeAccountOptions;
    },
    [accountsById, activeAccountOptionIds, activeAccountOptions],
  );

  const updateLocalRules = useCallback((updater: (current: LocalRecurringRule[]) => LocalRecurringRule[]) => {
    setLocalRules((current) => {
      const next = updater(current);
      rulesRef.current = next;

      return next;
    });
  }, []);

  const replaceRule = useCallback(
    (rule: RecurringRule) => {
      const nextRule = toLocalRule(rule);
      lastSavedRulesRef.current = lastSavedRulesRef.current.some((item) => item.id === nextRule.id)
        ? lastSavedRulesRef.current.map((item) => (item.id === nextRule.id ? nextRule : item))
        : [...lastSavedRulesRef.current, nextRule];

      updateLocalRules((current) =>
        current.some((item) => item.id === nextRule.id)
          ? current.map((item) => (item.id === nextRule.id ? nextRule : item))
          : [...current, nextRule],
      );
    },
    [updateLocalRules],
  );

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);

    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const restoreSavedRule = useCallback(
    (id: string) => {
      const savedRule = lastSavedRulesRef.current.find((rule) => rule.id === id);

      if (!savedRule) {
        return;
      }

      dirtyRuleIdsRef.current.delete(id);
      updateLocalRules((current) => current.map((rule) => (rule.id === id ? savedRule : rule)));
    },
    [updateLocalRules],
  );

  const openHistoricalConfirmation = useCallback(
    (
      impact: HistoricalImpactRequiredActionResult,
      handlers: {
        onCancel: () => void;
        onConfirm: () => Promise<void>;
      },
    ) => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }

      timersRef.current.clear();
      setHistoricalPrompt({
        firstAffectedMonth: impact.firstAffectedMonth,
        message: impact.message,
        onCancel: () => {
          handlers.onCancel();
          setHistoricalPrompt(null);
        },
        onConfirm: () => {
          setHistoricalPrompt((current) => (current ? { ...current, isApplying: true } : current));
          void handlers.onConfirm().finally(() => {
            setHistoricalPrompt(null);
          });
        },
      });
    },
    [],
  );

  const flushRule = useCallback(
    async (id: string) => {
      clearTimer(id);
      const rule = rulesRef.current.find((item) => item.id === id);

      if (!rule || rule.archivedAt) {
        dirtyRuleIdsRef.current.delete(id);
        return;
      }

      const version = (saveVersionRef.current.get(id) ?? 0) + 1;
      saveVersionRef.current.set(id, version);
      setSaveStatus("saving");
      setMessage(null);

      const formData = buildRuleFormData(rule);
      const result = await updateAction(formData);

      if (saveVersionRef.current.get(id) !== version) {
        return;
      }

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            restoreSavedRule(id);
            setSaveStatus("idle");
            setMessage(null);
          },
          onConfirm: async () => {
            setSaveStatus("saving");
            setMessage(null);
            const confirmedResult = await updateAction(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              restoreSavedRule(id);
              setSaveStatus("error");
              setMessage(confirmedResult.message);
              return;
            }

            if (!confirmedResult.ok) {
              restoreSavedRule(id);
              setSaveStatus("error");
              setMessage(confirmedResult.error);
              return;
            }

            dirtyRuleIdsRef.current.delete(id);
            replaceRule(confirmedResult.rule);
            setSaveStatus("saved");
            setMessage(null);
          },
        });
        return;
      }

      if (!result.ok) {
        setSaveStatus("error");
        setMessage(result.error);
        return;
      }

      dirtyRuleIdsRef.current.delete(id);
      replaceRule(result.rule);
      setSaveStatus("saved");
      setMessage(null);
    },
    [clearTimer, openHistoricalConfirmation, replaceRule, restoreSavedRule, updateAction],
  );

  const scheduleSave = useCallback(
    (id: string) => {
      dirtyRuleIdsRef.current.add(id);
      setSaveStatus("saving");
      setMessage(null);
      clearTimer(id);
      timersRef.current.set(
        id,
        setTimeout(() => {
          void flushRule(id);
        }, AUTOSAVE_DELAY_MS),
      );
    },
    [clearTimer, flushRule],
  );

  const changeRule = useCallback(
    (id: string, updater: (rule: LocalRecurringRule) => LocalRecurringRule) => {
      updateLocalRules((current) => current.map((rule) => (rule.id === id ? updater(rule) : rule)));
      scheduleSave(id);
    },
    [scheduleSave, updateLocalRules],
  );

  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);

      setIsCreating(true);
      setSaveStatus("saving");
      setMessage(null);

      const result = await createAction(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setIsCreating(false);
            setSaveStatus("idle");
            setMessage(null);
          },
          onConfirm: async () => {
            setSaveStatus("saving");
            setMessage(null);
            const confirmedResult = await createAction(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setSaveStatus("error");
              setMessage(confirmedResult.message);
              setIsCreating(false);
              return;
            }

            if (!confirmedResult.ok) {
              setSaveStatus("error");
              setMessage(confirmedResult.error);
              setIsCreating(false);
              return;
            }

            replaceRule(confirmedResult.rule);
            form.reset();
            setSaveStatus("saved");
            setMessage(null);
            setIsCreating(false);
          },
        });
        return;
      }

      if (!result.ok) {
        setSaveStatus("error");
        setMessage(result.error);
        setIsCreating(false);
        return;
      }

      replaceRule(result.rule);
      form.reset();
      setSaveStatus("saved");
      setMessage(null);
      setIsCreating(false);
    },
    [createAction, openHistoricalConfirmation, replaceRule],
  );

  const runRuleAction = useCallback(
    async (id: string, action: (formData: FormData) => Promise<RuleActionResult>, values?: Record<string, string>) => {
      await flushRule(id);
      setPendingActionId(id);
      setSaveStatus("saving");
      setMessage(null);

      const formData = simpleFormData(id, values);
      const result = await action(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setSaveStatus("idle");
            setMessage(null);
            setPendingActionId(null);
          },
          onConfirm: async () => {
            setSaveStatus("saving");
            setMessage(null);
            const confirmedResult = await action(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setSaveStatus("error");
              setMessage(confirmedResult.message);
              setPendingActionId(null);
              return;
            }

            if (!confirmedResult.ok) {
              setSaveStatus("error");
              setMessage(confirmedResult.error);
              setPendingActionId(null);
              return;
            }

            replaceRule(confirmedResult.rule);
            setSaveStatus("saved");
            setPendingActionId(null);
          },
        });
        return;
      }

      if (!result.ok) {
        setSaveStatus("error");
        setMessage(result.error);
        setPendingActionId(null);
        return;
      }

      replaceRule(result.rule);
      setSaveStatus("saved");
      setPendingActionId(null);
    },
    [flushRule, openHistoricalConfirmation, replaceRule],
  );

  const handleDelete = useCallback(
    async (rule: LocalRecurringRule) => {
      await flushRule(rule.id);
      setPendingActionId(rule.id);
      setSaveStatus("saving");
      setMessage(null);

      const formData = simpleFormData(rule.id);
      const result = await deleteAction(formData);

      if (isHistoricalImpactActionResult(result)) {
        openHistoricalConfirmation(result, {
          onCancel: () => {
            setSaveStatus("idle");
            setMessage(null);
            setPendingActionId(null);
          },
          onConfirm: async () => {
            setSaveStatus("saving");
            setMessage(null);
            const confirmedResult = await deleteAction(withHistoricalImpactConfirmation(formData));

            if (isHistoricalImpactActionResult(confirmedResult)) {
              setSaveStatus("error");
              setMessage(confirmedResult.message);
              setPendingActionId(null);
              return;
            }

            if (!confirmedResult.ok) {
              setSaveStatus("error");
              setMessage(confirmedResult.error);
              setPendingActionId(null);
              return;
            }

            updateLocalRules((current) => current.filter((item) => item.id !== rule.id));
            lastSavedRulesRef.current = lastSavedRulesRef.current.filter((item) => item.id !== rule.id);
            setSaveStatus("saved");
            setPendingActionId(null);
          },
        });
        return;
      }

      if (!result.ok) {
        setSaveStatus("error");
        setMessage(result.error);
        setPendingActionId(null);
        return;
      }

      updateLocalRules((current) => current.filter((item) => item.id !== rule.id));
      lastSavedRulesRef.current = lastSavedRulesRef.current.filter((item) => item.id !== rule.id);
      setSaveStatus("saved");
      setPendingActionId(null);
    },
    [deleteAction, flushRule, openHistoricalConfirmation, updateLocalRules],
  );

  useEffect(() => {
    const nextRules = rules.map(toLocalRule);
    setLocalRules(nextRules);
    rulesRef.current = nextRules;
    lastSavedRulesRef.current = nextRules;
    setHistoricalPrompt(null);
  }, [rules]);

  useEffect(() => {
    const timers = timersRef.current;
    const handleBeforeUnload = () => {
      for (const id of dirtyRuleIdsRef.current) {
        void flushRule(id);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [flushRule]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form
          key={nextSortOrder}
          onSubmit={handleCreate}
          className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.7fr_0.55fr_0.8fr_0.8fr_auto] lg:items-end"
        >
          <div>
            <label htmlFor="new-recurring-description" className="text-xs font-semibold uppercase text-slate-500">
              Descrição
            </label>
            <input id="new-recurring-description" name="description" required className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-recurring-account" className="text-xs font-semibold uppercase text-slate-500">
              Conta
            </label>
            <select id="new-recurring-account" name="accountId" required className={inputClassName("mt-1")}>
              <option value="">Seleccionar</option>
              {activeAccountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountDisplayName(account)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-recurring-amount" className="text-xs font-semibold uppercase text-slate-500">
              Montante
            </label>
            <input
              id="new-recurring-amount"
              name="amount"
              inputMode="decimal"
              required
              className={inputClassName("mt-1 text-right tabular-nums")}
            />
          </div>
          <div>
            <label htmlFor="new-recurring-day" className="text-xs font-semibold uppercase text-slate-500">
              Dia
            </label>
            <input
              id="new-recurring-day"
              name="chargeDay"
              type="number"
              min={1}
              max={31}
              defaultValue={1}
              required
              className={inputClassName("mt-1")}
            />
          </div>
          <div>
            <label htmlFor="new-recurring-start" className="text-xs font-semibold uppercase text-slate-500">
              Início
            </label>
            <input id="new-recurring-start" name="startMonth" type="month" required className={inputClassName("mt-1")} />
          </div>
          <div>
            <label htmlFor="new-recurring-end" className="text-xs font-semibold uppercase text-slate-500">
              Fim
            </label>
            <input id="new-recurring-end" name="endMonth" type="month" className={inputClassName("mt-1")} />
          </div>
          <div className="flex flex-col gap-2">
            <input type="hidden" name="active" value="true" />
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 disabled:cursor-wait disabled:opacity-60"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar débito directo
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-950">Regras configuradas</h2>
          {currentStatusLabel ? (
            <p
              aria-live="polite"
              title={message ?? undefined}
              className={cn("text-xs font-medium", saveStatus === "error" ? "text-red-700" : "text-slate-500")}
            >
              {currentStatusLabel}
            </p>
          ) : null}
        </div>

        {message && saveStatus === "error" ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{message}</div>
        ) : null}

        <div className="overflow-x-auto">
          {activeRules.length === 0 ? (
            <p className="p-4 text-sm text-slate-700">Ainda não existem débitos directos activos.</p>
          ) : (
            <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Conta</th>
                  <th className="px-3 py-2 text-right">Montante</th>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Ordem</th>
                  <th className="px-3 py-2 text-right">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        value={rule.description}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, description: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        aria-label={`Descrição de ${rule.description}`}
                        className={inputClassName()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.accountId}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, accountId: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        aria-label={`Conta de ${rule.description}`}
                        className={inputClassName()}
                      >
                        {getAccountOptionsForRule(rule).map((account) => (
                          <option key={account.id} value={account.id}>
                            {getAccountDisplayName(account)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.amount}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, amount: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        inputMode="decimal"
                        aria-label={`Montante de ${rule.description}`}
                        className={inputClassName("text-right tabular-nums")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.chargeDay}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, chargeDay: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        type="number"
                        min={1}
                        max={31}
                        aria-label={`Dia de cobrança de ${rule.description}`}
                        className={inputClassName("w-20")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.startMonth}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, startMonth: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        type="month"
                        aria-label={`Início de ${rule.description}`}
                        className={inputClassName("w-36")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.endMonth}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, endMonth: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        type="month"
                        aria-label={`Fim de ${rule.description}`}
                        className={inputClassName("w-36")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={rule.active}
                          onChange={(event) =>
                            void runRuleAction(rule.id, setActiveAction, { active: String(event.target.checked) })
                          }
                          className={checkboxClassName()}
                        />
                        {rule.active ? "Activo" : "Inactivo"}
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.sortOrder}
                        onChange={(event) =>
                          changeRule(rule.id, (current) => ({ ...current, sortOrder: event.target.value }))
                        }
                        onBlur={() => void flushRule(rule.id)}
                        type="number"
                        aria-label={`Ordem de ${rule.description}`}
                        className={inputClassName("w-20")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={pendingActionId === rule.id}
                          onClick={() => void runRuleAction(rule.id, archiveAction)}
                          className={actionButtonClassName()}
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          Arquivar
                        </button>
                        <button
                          type="button"
                          disabled={pendingActionId === rule.id}
                          onClick={() => void handleDelete(rule)}
                          className={actionButtonClassName("danger")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-2">
          <h2 className="text-base font-semibold text-slate-950">Arquivados</h2>
        </div>
        {archivedRules.length === 0 ? (
          <p className="p-4 text-sm text-slate-700">Não existem débitos directos arquivados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Conta</th>
                  <th className="px-3 py-2 text-right">Montante</th>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Período</th>
                  <th className="px-3 py-2 text-right">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivedRules.map((rule) => (
                  <tr key={rule.id} className="text-slate-700">
                    <td className="px-3 py-2 font-medium text-slate-900">{rule.description}</td>
                    <td className="px-3 py-2">{namesByAccountId.get(rule.accountId) ?? "Conta arquivada"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEuroCents(rule.amountCents)}
                    </td>
                    <td className="px-3 py-2">{rule.chargeDay}</td>
                    <td className="px-3 py-2">
                      {rule.startMonth}
                      {rule.endMonth ? ` a ${rule.endMonth}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={pendingActionId === rule.id}
                          onClick={() => void runRuleAction(rule.id, reactivateAction)}
                          className={actionButtonClassName("primary")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Reactivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <HistoricalImpactModal prompt={historicalPrompt} />
    </div>
  );
}

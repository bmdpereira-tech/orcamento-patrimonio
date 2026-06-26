import "server-only";

import {
  evaluateHistoricalImpact,
  toHistoricalImpactActionResult,
  type HistoricalImpactRequiredActionResult,
} from "@/domain/budget/historical-impact";
import type { MonthId } from "@/domain/budget/months";

export function hasHistoricalImpactConfirmation(formData: FormData) {
  return String(formData.get("confirmHistoricalImpact") ?? "false") === "true";
}

export function getHistoricalImpactActionResult({
  firstAffectedMonth,
  formData,
}: {
  firstAffectedMonth?: MonthId | null;
  formData: FormData;
}): HistoricalImpactRequiredActionResult | null {
  return toHistoricalImpactActionResult(
    evaluateHistoricalImpact({
      firstAffectedMonth,
      confirmHistoricalImpact: hasHistoricalImpactConfirmation(formData),
    }),
  );
}

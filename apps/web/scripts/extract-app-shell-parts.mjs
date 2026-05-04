import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeShell = path.join(__dirname, "../src/ui/RouteShell.tsx");
const lines = fs.readFileSync(routeShell, "utf8").split(/\r?\n/);

function slice1(startLine, endLineInclusive) {
  return lines.slice(startLine - 1, endLineInclusive).join("\n");
}

function dedentBlock(text) {
  const bl = text.split("\n");
  const nonempty = bl.filter((l) => l.trim().length > 0);
  if (!nonempty.length) return text;
  const minIndent = Math.min(...nonempty.map((l) => l.match(/^\s*/)[0].length));
  return bl.map((l) => (l.trim() ? l.slice(minIndent) : l)).join("\n");
}

let mainBody = dedentBlock(slice1(1482, 1984));
const scheduleClickRe =
  /onClick=\{\(\) => \{\s*const full = \(scheduleData\?\.items \?\? \[\]\)\.find\(\(s\) => s\.id === it\.id\);\s*if \(!full\) return;\s*setScheduleDetailOpen\(full\);\s*\}\}/;
if (!scheduleClickRe.test(mainBody)) {
  throw new Error("schedule click pattern not found for main home extract");
}
mainBody = mainBody.replace(scheduleClickRe, `onClick={() => {
                  onOpenScheduleId(it.id);
                }}`);
mainBody = mainBody.replaceAll("setExpenseDetailOpen(resolveOriginalExpense(e))", "onOpenExpense(resolveOriginalExpense(e))");
mainBody = mainBody.replaceAll("setExpenseDetailOpen(e)", "onOpenExpense(e)");

const composeBody = dedentBlock(slice1(2121, 2926));

const mainOut = `import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { ClockIcon, UsersIcon } from "@/components/icons";
import { UserIcon } from "@/components/icons/UserIcon";
import ExpenseCard from "@/components/ExpenseCard";
import { cn } from "@/components/cn";
import {
  ALL_CATEGORIES,
  CATEGORY_GROUPS,
  emojiForCategory,
  normalizeCategory,
  parseEmojiPrefixedTitle
} from "@/domain/categoryUi";
import { tintForCategory } from "@/domain/categoryTint";
import { stripTransitRoutePrefix } from "@/domain/expenseTransitText";
import { expenseTimeLabel, timeRangeLabel, yyyyMmLocal } from "@/domain/date";
import { PAYMENT_TYPE_LABEL, chipClass } from "@/domain/expensePaymentUi";
import {
  companionsExcludingPayerLabel,
  formatWon,
  participantsCount,
  settlementLineForExpense
} from "@/domain/settlement";
import { monthIndexDiff } from "@/domain/monthKeyDiff";
import type { TimelineItem } from "@/domain/timelineTypes";
import { isUsageDayDifferent } from "@/domain/expenseDayUsage";
import type { AggregateMode } from "@/domain/installment";

export type MainBudgetUi = {
  todayTotal: number;
  dailyBudget: number;
  monthTotal: number;
  monthPctText: number;
  paceUi: { emoji: string; message: string; bubble: string };
  message: string;
};

export type MainHomeViewProps = {
  showCategoryPreview: boolean;
  expensesError: unknown;
  scheduleError: unknown;
  budgetUi: MainBudgetUi;
  monthlyBudgetWon: number;
  timeline: TimelineItem[];
  aggregateMode: AggregateMode;
  dayKey: string;
  dayLocal00: Date;
  onOpenScheduleId: (_id: string) => void;
  onOpenExpense: (_e: Expense) => void;
  resolveOriginalExpense: (_e: Expense) => Expense;
  isExpenseNetSettledForDay: (_day: string, _e: Expense, _me: string) => boolean;
};

export default function MainHomeView(props: MainHomeViewProps) {
  const {
    showCategoryPreview,
    expensesError,
    scheduleError,
    budgetUi,
    monthlyBudgetWon,
    timeline,
    aggregateMode,
    dayKey,
    dayLocal00,
    onOpenScheduleId,
    onOpenExpense,
    resolveOriginalExpense,
    isExpenseNetSettledForDay
  } = props;

  return (
${mainBody
  .split("\n")
  .map((l) => (l ? `    ${l}` : ""))
  .join("\n")}
  );
}
`;

const composeOut = `import type { Dispatch, SetStateAction } from "react";
import { ClockIcon, UsersIcon } from "@/components/icons";
import { UserIcon } from "@/components/icons/UserIcon";
import { WalletIcon } from "@/components/icons/WalletIcon";
import DateMonthInput from "@/components/DateMonthInput";
import Transit1Fields from "@/components/transit/Transit1Fields";
import Transit2Fields from "@/components/transit/Transit2Fields";
import CardInstallmentFields from "@/components/CardInstallmentFields";
import CategoryCardPreview from "@/components/CategoryCardPreview";
import { cn } from "@/components/cn";
import {
  NATIVE_SELECT_CHEVRON_CLASS_REQUIRED,
  NATIVE_SELECT_CHEVRON_STYLE
} from "@/components/nativeSelectChevron";
import { fieldBorderClass } from "@/components/inputFieldClasses";
import { pad2 } from "@/domain/date";
import { normalizeFourDigitTimeInput } from "@/domain/time";
import { formatAmountInputWithCommas } from "@/domain/parseAmountInput";
import {
  ALL_CATEGORIES,
  CATEGORY_GROUPS,
  normalizeCategory
} from "@/domain/categoryUi";
import { PAYMENT_TYPE_OPTIONS } from "@/domain/expensePaymentUi";
import type { TransitLeg, Transit2SegmentDraft } from "@/domain/transitPayload";

const CATEGORY_SELECT_CLASS = cn("flex-1", NATIVE_SELECT_CHEVRON_CLASS_REQUIRED);
const CATEGORY_SELECT_ARROW_STYLE = NATIVE_SELECT_CHEVRON_STYLE;

export type ComposeFormProps = {
  composeKind: "expense" | "schedule";
  setComposeKind: Dispatch<SetStateAction<"expense" | "schedule">>;
  composeEditExpenseId: string | null;
  setComposeEditExpenseId: Dispatch<SetStateAction<string | null>>;
  composeEditScheduleId: string | null;
  setComposeEditScheduleId: Dispatch<SetStateAction<string | null>>;
  composeConvertFromExpenseId: string | null;
  setComposeConvertFromExpenseId: Dispatch<SetStateAction<string | null>>;
  composeConvertFromScheduleId: string | null;
  setComposeConvertFromScheduleId: Dispatch<SetStateAction<string | null>>;
  composeDayKey: string;
  setComposeDayKey: Dispatch<SetStateAction<string>>;
  isTransit1: boolean;
  isTransit2: boolean;
  isTransitCategory: boolean;
  entryStartText: string;
  setEntryStartText: Dispatch<SetStateAction<string>>;
  entryEndText: string;
  setEntryEndText: Dispatch<SetStateAction<string>>;
  entryCategory: string;
  setEntryCategory: Dispatch<SetStateAction<string>>;
  entryTitle: string;
  setEntryTitle: Dispatch<SetStateAction<string>>;
  entryNote: string;
  setEntryNote: Dispatch<SetStateAction<string>>;
  exMerchant: string;
  setExMerchant: Dispatch<SetStateAction<string>>;
  exDetail: string;
  setExDetail: Dispatch<SetStateAction<string>>;
  exAmount: string;
  setExAmount: Dispatch<SetStateAction<string>>;
  exPaymentType: import("../features/expenses/api").Expense["paymentType"];
  setExPaymentType: Dispatch<SetStateAction<import("../features/expenses/api").Expense["paymentType"]>>;
  exPaymentLabel: string;
  setExPaymentLabel: Dispatch<SetStateAction<string>>;
  payerPreset: "나" | "기타";
  setPayerPreset: Dispatch<SetStateAction<"나" | "기타">>;
  payerOther: string;
  setPayerOther: Dispatch<SetStateAction<string>>;
  expenseScope: "PERSONAL" | "SHARED";
  setExpenseScope: Dispatch<SetStateAction<"PERSONAL" | "SHARED">>;
  sharedNamesText: string;
  setSharedNamesText: Dispatch<SetStateAction<string>>;
  expenseCompanionsText: string;
  setExpenseCompanionsText: Dispatch<SetStateAction<string>>;
  exInstallment: boolean;
  setExInstallment: Dispatch<SetStateAction<boolean>>;
  exInstallmentMonths: number;
  setExInstallmentMonths: Dispatch<SetStateAction<number>>;
  exInstallmentNoInterest: boolean;
  setExInstallmentNoInterest: Dispatch<SetStateAction<boolean>>;
  plannedAtEnabled: boolean;
  setPlannedAtEnabled: Dispatch<SetStateAction<boolean>>;
  plannedAtLocal: string;
  setPlannedAtLocal: Dispatch<SetStateAction<string>>;
  scheduleWithExpense: boolean;
  setScheduleWithExpense: Dispatch<SetStateAction<boolean>>;
  schedulePayTimeText: string;
  setSchedulePayTimeText: Dispatch<SetStateAction<string>>;
  schedulePeopleText: string;
  setSchedulePeopleText: Dispatch<SetStateAction<string>>;
  scheduleShowOnCalendar: boolean;
  setScheduleShowOnCalendar: Dispatch<SetStateAction<boolean>>;
  scheduleRepeatYearly: boolean;
  setScheduleRepeatYearly: Dispatch<SetStateAction<boolean>>;
  scheduleExpenseTitle: string;
  setScheduleExpenseTitle: Dispatch<SetStateAction<string>>;
  transitLegs: TransitLeg[];
  setTransitLegs: Dispatch<SetStateAction<TransitLeg[]>>;
  transit2SegmentsDraft: Transit2SegmentDraft[];
  setTransit2SegmentsDraft: Dispatch<SetStateAction<Transit2SegmentDraft[]>>;
  setExTransitMode: Dispatch<SetStateAction<string>>;
  setExTransitFromText: Dispatch<SetStateAction<string>>;
  setExTransitToText: Dispatch<SetStateAction<string>>;
  requestConfirm: (_message: string, _action: () => void | Promise<void>) => void;
  onOpenStationSearch: (_legIndex: number, _field: "from" | "to") => void;
  onOpenBusStopSearch: (_legIndex: number, _field: "from" | "to") => void;
};

export function ComposeForm(props: ComposeFormProps) {
  const {
    composeKind,
    setComposeKind,
    composeEditExpenseId,
    setComposeEditExpenseId,
    composeEditScheduleId,
    setComposeEditScheduleId,
    composeConvertFromExpenseId,
    setComposeConvertFromExpenseId,
    composeConvertFromScheduleId,
    setComposeConvertFromScheduleId,
    composeDayKey,
    setComposeDayKey,
    isTransit1,
    isTransit2,
    isTransitCategory,
    entryStartText,
    setEntryStartText,
    entryEndText,
    setEntryEndText,
    entryCategory,
    setEntryCategory,
    entryTitle,
    setEntryTitle,
    entryNote,
    setEntryNote,
    exMerchant,
    setExMerchant,
    exDetail,
    setExDetail,
    exAmount,
    setExAmount,
    exPaymentType,
    setExPaymentType,
    exPaymentLabel,
    setExPaymentLabel,
    payerPreset,
    setPayerPreset,
    payerOther,
    setPayerOther,
    expenseScope,
    setExpenseScope,
    sharedNamesText,
    setSharedNamesText,
    expenseCompanionsText,
    setExpenseCompanionsText,
    exInstallment,
    setExInstallment,
    exInstallmentMonths,
    setExInstallmentMonths,
    exInstallmentNoInterest,
    setExInstallmentNoInterest,
    plannedAtEnabled,
    setPlannedAtEnabled,
    plannedAtLocal,
    setPlannedAtLocal,
    scheduleWithExpense,
    setScheduleWithExpense,
    schedulePayTimeText,
    setSchedulePayTimeText,
    schedulePeopleText,
    setSchedulePeopleText,
    scheduleShowOnCalendar,
    setScheduleShowOnCalendar,
    scheduleRepeatYearly,
    setScheduleRepeatYearly,
    scheduleExpenseTitle,
    setScheduleExpenseTitle,
    transitLegs,
    setTransitLegs,
    transit2SegmentsDraft,
    setTransit2SegmentsDraft,
    setExTransitMode,
    setExTransitFromText,
    setExTransitToText,
    requestConfirm,
    onOpenStationSearch,
    onOpenBusStopSearch
  } = props;

  return (
${composeBody
  .split("\n")
  .map((l) => (l ? `    ${l}` : ""))
  .join("\n")}
  );
}
`;

fs.writeFileSync(path.join(__dirname, "../src/ui/views/MainHome/MainHomeView.tsx"), mainOut);
fs.writeFileSync(path.join(__dirname, "../src/ui/sheets/ComposeForm.tsx"), composeOut);
console.log("Wrote ui/views/MainHome/MainHomeView.tsx and ui/sheets/ComposeForm.tsx");

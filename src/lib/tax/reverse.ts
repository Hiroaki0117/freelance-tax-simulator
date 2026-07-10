// 逆算モード:ほしい手取りから、必要な売上を求める(UX案 1-2)
//
// takeHome は売上に対して単調増加(売上が増えれば手取りも増える)なので、
// 税制の逆関数を解かなくても、二分探索で「必要な売上」を数十回の試算で当てられる。

import { calculateTax } from './calculator';
import { ASSUMED_EXPENSE_RATE, assumedExpenses } from './defaults';
import type { TaxInput } from './types';

export interface ReverseSolution {
  /** 目標の手取りに必要な年間売上(円) */
  revenue: number;
  /** その売上での経費(円)。仮置き中なら売上連動、実額入力済みなら固定 */
  expenses: number;
  /** その売上で実際に達成される年間手取り(円) */
  takeHome: number;
  /** 実用上限内で目標に届いたか(false なら非現実的な目標) */
  reachable: boolean;
}

/** 逆算で探索する売上の上限(10億円。これで届かない手取りは非現実的とみなす) */
export const REVERSE_MAX_REVENUE = 1_000_000_000;

/**
 * 目標の年間手取りから、必要な年間売上を二分探索で逆算する。
 *
 * @param targetTakeHome 目標の年間手取り(円)
 * @param base いまの入力。売上・経費以外の前提(申告区分・保険・扶養など)を固定して使う
 * @param expensesAssumed 経費が仮置き(売上の20%)なら true。true のときは経費も売上に
 *   連動させ、false なら base.expenses を実額で固定する(フォワードの setRevenue と同じ扱い)。
 */
export function solveRevenueForTakeHome(
  targetTakeHome: number,
  base: TaxInput,
  expensesAssumed: boolean
): ReverseSolution {
  const target = Math.max(0, Math.round(targetTakeHome));

  // 探索中は経費を「丸めない」比例経費で使い、takeHome を厳密に単調増加に保つ。
  // (仮置き経費を1万円単位に丸めると小さな段差ができ、二分探索の前提が崩れるため)
  const takeHomeAt = (revenue: number): number => {
    const expenses = expensesAssumed
      ? revenue * ASSUMED_EXPENSE_RATE
      : base.expenses;
    return calculateTax({ ...base, revenue, expenses }).takeHome;
  };

  // 目標が0以下なら売上0でよい
  if (target <= takeHomeAt(0)) {
    const expenses = expensesAssumed ? assumedExpenses(0) : base.expenses;
    return {
      revenue: 0,
      expenses,
      takeHome: calculateTax({ ...base, revenue: 0, expenses }).takeHome,
      reachable: true,
    };
  }

  // 上限でも届かないなら非現実的な目標
  if (takeHomeAt(REVERSE_MAX_REVENUE) < target) {
    const expenses = expensesAssumed
      ? assumedExpenses(REVERSE_MAX_REVENUE)
      : base.expenses;
    return {
      revenue: REVERSE_MAX_REVENUE,
      expenses,
      takeHome: calculateTax({ ...base, revenue: REVERSE_MAX_REVENUE, expenses })
        .takeHome,
      reachable: false,
    };
  }

  // 二分探索:takeHome >= target となる最小の売上を、1,000円精度で詰める
  let lo = 0;
  let hi = REVERSE_MAX_REVENUE;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (takeHomeAt(mid) >= target) hi = mid;
    else lo = mid;
  }

  // 必要売上は1万円単位に丸めて「見やすい額」にする(例: 626.6万 → 627万)。
  // 表示・適用・その売上での手取りを、すべてこの丸めた売上に揃える
  // (「この売上で試算する」で本体に入れたとき、入力欄も 627 と表示される)。
  const revenue = Math.round(hi / 10000) * 10000;
  const expenses = expensesAssumed ? assumedExpenses(revenue) : base.expenses;
  const takeHome = calculateTax({ ...base, revenue, expenses }).takeHome;
  return { revenue, expenses, takeHome, reachable: true };
}

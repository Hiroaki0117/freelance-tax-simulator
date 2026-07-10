import type { TaxInput } from './types';

/** 経費を自分で触るまでの仮置き比率(売上の何割を経費とみなすか) */
export const ASSUMED_EXPENSE_RATE = 0.2;

/**
 * 経費を触っていないときの仮置き経費(売上の20%・1万円単位に丸め)。
 * フォワード(売上を動かしたとき)と逆算(必要売上を出すとき)で同じ扱いにするため、
 * この一箇所に丸めルールを集約する。
 */
export function assumedExpenses(revenue: number): number {
  return Math.round((revenue * ASSUMED_EXPENSE_RATE) / 10000) * 10000;
}

/** UI の初期値(ITフリーランスのよくある一例) */
export const DEFAULT_INPUT: TaxInput = {
  revenue: 6_000_000,
  expenses: 1_200_000,
  filingType: 'blue65',
  hasSpouse: false,
  dependents: 0,
  consumptionTax: 'special2wari',
  insurance: 'kokuho',
  healthInsuranceManual: 0,
  businessTaxApplicable: true,
  age40OrOver: false,
  furusatoDonation: 0,
  idecoMonthly: 0,
};

import type { TaxInput } from './types';

/** UI の初期値(ITフリーランスのよくある一例) */
export const DEFAULT_INPUT: TaxInput = {
  revenue: 6_000_000,
  expenses: 1_200_000,
  filingType: 'blue65',
  hasSpouse: false,
  dependents: 0,
  consumptionTax: 'special2wari',
  insurance: 'kokuho',
  age40OrOver: false,
};

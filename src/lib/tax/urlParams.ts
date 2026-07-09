// 結果をリンクで再現するためのURLパラメータ(共有用の最小セット)。
// 家族構成寄りの項目(配偶者・扶養・年齢・保険の手入力額)は個人属性色が強いため含めず、
// デフォルト値で近似する(裏取り: docs/research/2026-07-09-dynamic-ogp-url-share-research.md)。

import { DEFAULT_INPUT } from './defaults';
import type { ConsumptionTaxMode, FilingType, TaxInput } from './types';

const FILING_TYPES: FilingType[] = ['blue65', 'blue55', 'blue10', 'white'];
const CONSUMPTION_MODES: ConsumptionTaxMode[] = [
  'exempt',
  'special2wari',
  'simplified',
  'general',
];

const MAX_YEN = 10_000_000_000;

function parseYen(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(MAX_YEN, Math.max(0, n));
}

/** 共有URLのクエリから、シェア対象の項目だけを TaxInput の部分オブジェクトとして復元する */
export function parseShareParams(
  searchParams: URLSearchParams
): Partial<TaxInput> {
  const result: Partial<TaxInput> = {};

  const revenue = parseYen(searchParams.get('r'));
  if (revenue !== undefined) result.revenue = revenue;

  const expenses = parseYen(searchParams.get('e'));
  if (expenses !== undefined) result.expenses = expenses;

  const filingType = searchParams.get('f');
  if (FILING_TYPES.includes(filingType as FilingType)) {
    result.filingType = filingType as FilingType;
  }

  const consumptionTax = searchParams.get('c');
  if (CONSUMPTION_MODES.includes(consumptionTax as ConsumptionTaxMode)) {
    result.consumptionTax = consumptionTax as ConsumptionTaxMode;
  }

  const furusatoDonation = parseYen(searchParams.get('fn'));
  if (furusatoDonation !== undefined)
    result.furusatoDonation = furusatoDonation;

  const idecoMonthly = parseYen(searchParams.get('id'));
  if (idecoMonthly !== undefined) result.idecoMonthly = idecoMonthly;

  return result;
}

/** シェア用のクエリ文字列を組み立てる(値がデフォルトと同じ項目は省略してURLを短く保つ) */
export function buildShareParams(input: TaxInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('r', String(Math.round(input.revenue)));
  params.set('e', String(Math.round(input.expenses)));
  params.set('f', input.filingType);
  if (input.consumptionTax !== DEFAULT_INPUT.consumptionTax) {
    params.set('c', input.consumptionTax);
  }
  if (input.furusatoDonation > 0) {
    params.set('fn', String(Math.round(input.furusatoDonation)));
  }
  if (input.idecoMonthly > 0) {
    params.set('id', String(Math.round(input.idecoMonthly)));
  }
  return params;
}

/** 共有パラメータを適用したフル入力(未指定項目はデフォルトで近似) */
export function applyShareParams(partial: Partial<TaxInput>): TaxInput {
  return { ...DEFAULT_INPUT, ...partial };
}

/** クエリに共有パラメータ(r/e など)が1つでも含まれるか */
export function hasShareParams(searchParams: URLSearchParams): boolean {
  return searchParams.has('r') || searchParams.has('e');
}

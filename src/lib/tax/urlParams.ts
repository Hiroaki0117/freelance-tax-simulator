// 共有URL(/s?r=…)のクエリ ⇔ TaxInput の変換
//
// 方針(裏取り: start-up-note2 docs/research/2026-07-09-url-share-dynamic-ogp-research.md):
// - 結果の再現に必要な入力を全部載せる(近似でシェア画像と数字がズレるのを防ぐ)
// - DEFAULT_INPUT と同じ値は省略して短く保つ
// - 読み取りは壊れたURLでも例外を出さない(クランプ+ホワイトリスト+フォールバック)

import { DEFAULT_INPUT } from './defaults';
import type {
  ConsumptionTaxMode,
  FilingType,
  InsuranceType,
  TaxInput,
} from './types';

const FILING_TYPES = ['blue65', 'blue55', 'blue10', 'white'] as const;
const CONSUMPTION_MODES = [
  'exempt',
  'special2wari',
  'simplified',
  'general',
] as const;
const INSURANCE_TYPES = ['kokuho', 'voluntary', 'other', 'dependent'] as const;

/** 金額のクランプ上限(99億円。UIの想定を大きく超える値は黙って丸める) */
const MAX_YEN = 9_999_999_999;
const MAX_DEPENDENTS = 20;

/** searchParams(Next.jsのページ引数)と URLSearchParams の両方を受ける */
export type ShareParamsSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function readParam(source: ShareParamsSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseYen(raw: string | null, fallback: number): number {
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 0), MAX_YEN);
}

function parseEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function parseFlag(raw: string | null, fallback: boolean): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return fallback;
}

/**
 * 入力を共有URL用のクエリ文字列にする(例: "r=6000000&e=1200000&sp=1")。
 * デフォルト値と同じ項目は出力しない。
 */
export function encodeShareParams(input: TaxInput): string {
  const params = new URLSearchParams();
  const d = DEFAULT_INPUT;

  // 売上・経費は結果を直接決める2大項目なので、デフォルトと同値でも必ず載せる
  // (将来 DEFAULT_INPUT が変わっても、過去に共有されたリンクの数字が動かないように)
  params.set('r', String(Math.floor(input.revenue)));
  params.set('e', String(Math.floor(input.expenses)));
  if (input.filingType !== d.filingType) params.set('f', input.filingType);
  if (input.consumptionTax !== d.consumptionTax)
    params.set('c', input.consumptionTax);
  if (input.insurance !== d.insurance) params.set('i', input.insurance);
  if (
    (input.insurance === 'voluntary' || input.insurance === 'other') &&
    input.healthInsuranceManual !== d.healthInsuranceManual
  ) {
    params.set('hi', String(Math.floor(input.healthInsuranceManual)));
  }
  if (input.hasSpouse !== d.hasSpouse) params.set('sp', input.hasSpouse ? '1' : '0');
  if (input.dependents !== d.dependents)
    params.set('dep', String(input.dependents));
  if (input.businessTaxApplicable !== d.businessTaxApplicable)
    params.set('bt', input.businessTaxApplicable ? '1' : '0');
  if (input.age40OrOver !== d.age40OrOver)
    params.set('a40', input.age40OrOver ? '1' : '0');
  if (input.furusatoDonation !== d.furusatoDonation)
    params.set('fur', String(Math.floor(input.furusatoDonation)));
  if (input.idecoMonthly !== d.idecoMonthly)
    params.set('ide', String(Math.floor(input.idecoMonthly)));

  return params.toString();
}

/**
 * 共有URLのクエリを TaxInput に戻す。
 * 売上(r)が無い・不正・0円のURLは共有として不成立なので null を返す。
 * それ以外の項目は壊れていてもデフォルト値へフォールバックする。
 */
export function decodeShareParams(source: ShareParamsSource): TaxInput | null {
  const revenue = parseYen(readParam(source, 'r'), 0);
  if (revenue <= 0) return null;

  const d = DEFAULT_INPUT;
  const insurance = parseEnum<InsuranceType>(
    readParam(source, 'i'),
    INSURANCE_TYPES,
    d.insurance
  );

  return {
    revenue,
    expenses: parseYen(readParam(source, 'e'), d.expenses),
    filingType: parseEnum<FilingType>(
      readParam(source, 'f'),
      FILING_TYPES,
      d.filingType
    ),
    consumptionTax: parseEnum<ConsumptionTaxMode>(
      readParam(source, 'c'),
      CONSUMPTION_MODES,
      d.consumptionTax
    ),
    insurance,
    healthInsuranceManual:
      insurance === 'voluntary' || insurance === 'other'
        ? parseYen(readParam(source, 'hi'), d.healthInsuranceManual)
        : d.healthInsuranceManual,
    hasSpouse: parseFlag(readParam(source, 'sp'), d.hasSpouse),
    dependents: Math.min(
      parseYen(readParam(source, 'dep'), d.dependents),
      MAX_DEPENDENTS
    ),
    businessTaxApplicable: parseFlag(
      readParam(source, 'bt'),
      d.businessTaxApplicable
    ),
    age40OrOver: parseFlag(readParam(source, 'a40'), d.age40OrOver),
    furusatoDonation: parseYen(readParam(source, 'fur'), d.furusatoDonation),
    idecoMonthly: parseYen(readParam(source, 'ide'), d.idecoMonthly),
  };
}

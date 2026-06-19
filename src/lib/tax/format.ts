// 表示用のフォーマットとラベル

import type {
  ConsumptionTaxMode,
  FilingType,
  InsuranceType,
  TaxInput,
} from './types';

/** 円表記(1,234,567円) */
export function formatYen(value: number): string {
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

/** パーセント表記(21.8%) */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export const FILING_LABELS: Record<FilingType, string> = {
  blue65: '青色申告(65万円控除)',
  blue10: '青色申告(10万円控除)',
  white: '白色申告',
};

export const CONSUMPTION_LABELS: Record<ConsumptionTaxMode, string> = {
  exempt: '免税事業者',
  special2wari: 'インボイス・2割特例',
  simplified: '簡易課税(サービス業)',
  general: '本則課税',
};

export const INSURANCE_LABELS: Record<InsuranceType, string> = {
  kokuho: '国民健康保険 + 国民年金',
  voluntary: '任意継続(健保)+ 国民年金',
  other: 'その他の健康保険 + 国民年金',
  dependent: '家族の社会保険の扶養内',
};

/** AI への文脈共有や保存用に、入力を日本語の短い説明にする */
export function describeInput(input: TaxInput): string {
  const parts = [
    `年間売上 ${formatYen(input.revenue)}`,
    `経費 ${formatYen(input.expenses)}`,
    FILING_LABELS[input.filingType],
    CONSUMPTION_LABELS[input.consumptionTax],
    INSURANCE_LABELS[input.insurance],
  ];
  if (input.insurance === 'voluntary' || input.insurance === 'other') {
    parts.push(`健康保険料(手入力) ${formatYen(input.healthInsuranceManual)}`);
  }
  parts.push(
    input.businessTaxApplicable ? '個人事業税の対象' : '個人事業税の対象外',
    input.age40OrOver ? '40歳以上' : '40歳未満',
    input.hasSpouse ? '配偶者あり(扶養)' : '配偶者なし',
    `扶養親族 ${input.dependents}人`
  );
  return parts.join(' / ');
}

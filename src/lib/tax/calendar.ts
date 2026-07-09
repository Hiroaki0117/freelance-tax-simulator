// 納税・社会保険の支払いカレンダー(「稼ぐ年」の所得が翌年どの月にいくら出ていくか)
//
// 画面の PaymentTimeline(ResultPanel)と同じルールで、月ごとの支払い総額だけを
// 純関数として切り出したもの。シェア画像の「備え型」(山のミニ棒グラフ)で使う。
//   - 払う年(翌年3月〜翌々年2月の12ヶ月)
//   - まとめて来る税: 3月=所得税+消費税(確定申告)/ 6・8・10・1月=住民税4期 /
//     8・11月=個人事業税2期
//   - 毎月もの: 国民年金は毎月。国保は6月〜翌3月(4・5月だけおやすみ)
//   ※任意継続・その他の健保は「稼ぐ年」に毎月払う想定なので、この払う年カレンダーには載せない

import { NATIONAL_PENSION_MONTHLY } from './constants';
import type { TaxResult } from './types';

export interface PaymentMonth {
  /** 月ラベル(例: '3月') */
  label: string;
  /** 翌年 / 翌々年 のヒント(年をまたぐ最初の月にだけ付く) */
  yearHint?: string;
  /** まとめて来る税(確定申告・住民税・事業税) */
  lump: number;
  /** 毎月もの(国保 + 国民年金) */
  base: number;
  /** その月に出ていく合計 */
  total: number;
  /** 確定申告など、強調する山か */
  big: boolean;
}

export interface PaymentSchedule {
  months: PaymentMonth[];
  /** 合計がいちばん大きい月のインデックス */
  peakIndex: number;
  peak: PaymentMonth;
  /** 12ヶ月の最大の total(棒グラフの高さの基準) */
  maxTotal: number;
  /** 3月の確定申告でまとめて来る額(所得税+消費税)。0なら大きな山なし */
  marchLump: number;
}

/** 今年の所得にかかる支払いを、翌年3月〜翌々年2月の12ヶ月に割り付ける */
export function buildPaymentSchedule(result: TaxResult): PaymentSchedule {
  const r = result;
  const isKokuho = r.input.insurance === 'kokuho';
  const healthMonthly = isKokuho ? Math.round(r.healthInsurance / 12) : 0;
  const pensionMonthly =
    r.input.insurance !== 'dependent' ? NATIONAL_PENSION_MONTHLY : 0;

  const marchLump = r.incomeTax + r.consumptionTax;
  const juminInst = r.residentTax > 0 ? Math.round(r.residentTax / 4) : 0;
  const jigyoInst = r.businessTax > 0 ? Math.round(r.businessTax / 2) : 0;

  // [ラベル, 年ヒント, まとめて来る税, 国保の請求があるか]
  const spec: [string, string | undefined, number, boolean][] = [
    ['3月', '翌年', marchLump, isKokuho],
    ['4月', undefined, 0, false], // 国保は新年度切替。請求は6月〜
    ['5月', undefined, 0, false],
    ['6月', undefined, juminInst, isKokuho],
    ['7月', undefined, 0, isKokuho],
    ['8月', undefined, juminInst + jigyoInst, isKokuho],
    ['9月', undefined, 0, isKokuho],
    ['10月', undefined, juminInst, isKokuho],
    ['11月', undefined, jigyoInst, isKokuho],
    ['12月', undefined, 0, isKokuho],
    ['1月', '翌々年', juminInst, isKokuho],
    ['2月', undefined, 0, isKokuho],
  ];

  const months: PaymentMonth[] = spec.map(([label, yearHint, lump, kokuho]) => {
    const base = (kokuho ? healthMonthly : 0) + pensionMonthly;
    return {
      label,
      yearHint,
      lump,
      base,
      total: lump + base,
      big: label === '3月' && marchLump > 0,
    };
  });

  const peakIndex = months.reduce(
    (best, m, i) => (m.total > months[best].total ? i : best),
    0
  );
  const maxTotal = Math.max(1, ...months.map((m) => m.total));

  return {
    months,
    peakIndex,
    peak: months[peakIndex],
    maxTotal,
    marchLump,
  };
}

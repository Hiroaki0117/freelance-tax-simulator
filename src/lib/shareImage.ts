// シェア画像(1080×1080)を感情別に3種つくる純関数モジュール(UX案 4-6)
//
//   1. brag    自慢型 — 手取り◯万・手取り率◯%(現行の型)
//   2. empathy 共感型 — 税・保険で◯万持っていかれた(取られる側が主役)
//   3. prepare 備え型 — 来年の納税カレンダーの山(3月に◯万の山が来る)
//
// クライアントで SVG→canvas→PNG にラスタライズして共有・ダウンロードする。
// 絵文字は端末差でトーフ化しうるので画像には入れず、投稿本文(share.ts)側に置く。

import { TAX_YEAR } from './tax/constants';
import { buildPaymentSchedule } from './tax/calendar';
import type { TaxResult } from './tax/types';

export type ShareVariant = 'brag' | 'empathy' | 'prepare';

export const SHARE_VARIANTS: {
  key: ShareVariant;
  label: string;
  hint: string;
}[] = [
  { key: 'brag', label: '自慢', hint: '手取りが主役' },
  { key: 'empathy', label: '共感', hint: '取られた額が主役' },
  { key: 'prepare', label: '備え', hint: '来年の納税の山' },
];

const HANDLE = '@freelance_hiro';

const C = {
  bg: '#faf5ec',
  card: '#ffffff',
  ink900: '#3e3a33',
  ink600: '#6f685c',
  ink500: '#8a8377',
  ink400: '#a79e8c',
  emerald: '#059669',
  emerald700: '#047857',
  burden: '#d97706', // 取られた側の主役色(amber-600)
  prepare: '#0284c7', // 備えの落ち着いた框(sky-600)
  expense: '#e0d6bf',
  tax: '#fbbf24',
  taxSoft: '#fde9bf', // 備え型の非ピーク月の棒
  insurance: '#0ea5e9',
  takeHome: '#059669',
};

const FONT =
  "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";

function man(v: number): string {
  return Math.round(v / 10000).toLocaleString('ja-JP');
}

/** カードの外枠・ヘッダー・フッター(全種共通)。middle に中身のSVG断片を差し込む */
function frame(middle: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="${FONT}">
    <rect width="1080" height="1080" fill="${C.bg}"/>
    <rect x="48" y="48" width="984" height="984" rx="56" fill="${C.card}"/>
    <text x="108" y="150" font-size="32" font-weight="700" fill="${C.ink500}">フリーランスの手取りざっくりシミュレーター</text>
    <text x="108" y="196" font-size="26" fill="${C.ink400}">令和7年(${TAX_YEAR}年)分</text>
    ${middle}
    <text x="108" y="958" font-size="30" fill="${C.ink400}">freelance-tedori.com</text>
    <text x="972" y="958" font-size="34" font-weight="700" fill="${C.emerald700}" text-anchor="end">${HANDLE}</text>
  </svg>`;
}

/** 内訳の積み上げバー+凡例(自慢型・共感型で共通) */
function breakdownBar(r: TaxResult): string {
  const segs = [
    { label: '経費', value: r.input.expenses, color: C.expense },
    { label: '税金', value: r.taxTotal, color: C.tax },
    { label: '保険', value: r.socialInsuranceTotal, color: C.insurance },
    { label: '手取り', value: r.takeHome, color: C.takeHome },
  ];
  const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const barX = 108;
  const barW = 864;
  const barY = 690;
  const barH = 60;
  let cx = barX;
  const bars = segs
    .map((s) => {
      const w = (Math.max(0, s.value) / total) * barW;
      const rect = `<rect x="${cx.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" fill="${s.color}"/>`;
      cx += w;
      return rect;
    })
    .join('');
  const legend = segs
    .map((s, i) => {
      const x = barX + i * 216;
      return `
        <rect x="${x}" y="800" width="22" height="22" rx="5" fill="${s.color}"/>
        <text x="${x + 34}" y="818" font-size="30" fill="${C.ink500}">${s.label}</text>
        <text x="${x}" y="866" font-size="44" font-weight="700" fill="${C.ink900}">${man(s.value)}万</text>`;
    })
    .join('');
  return `
    <clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="18"/></clipPath>
    <g clip-path="url(#bar)">${bars}</g>
    ${legend}`;
}

/** 自慢型:手取りが主役 */
function bragMiddle(r: TaxResult): string {
  const takeRate = Math.round((r.takeHome / r.input.revenue) * 100);
  const rate = Math.round((r.burdenTotal / r.input.revenue) * 100);
  return `
    <text x="108" y="300" font-size="44" font-weight="700" fill="${C.ink900}">手取り(年)</text>
    <text x="108" y="530">
      <tspan font-size="220" font-weight="800" fill="${C.emerald}">${man(r.takeHome)}</tspan><tspan font-size="84" font-weight="700" fill="${C.emerald}" dx="10">万円</tspan>
    </text>
    <text x="972" y="452" font-size="34" fill="${C.ink500}" text-anchor="end">手取り率</text>
    <text x="972" y="520" font-size="72" font-weight="800" fill="${C.emerald700}" text-anchor="end">${takeRate}%</text>
    <text x="108" y="628" font-size="38" fill="${C.ink500}">売上${man(r.input.revenue)}万円のうち、税・保険で ${man(r.burdenTotal)}万円(${rate}%)</text>
    ${breakdownBar(r)}`;
}

/** 共感型:税・保険で持っていかれた額が主役 */
function empathyMiddle(r: TaxResult): string {
  const takeRate = Math.round((r.takeHome / r.input.revenue) * 100);
  const rate = Math.round((r.burdenTotal / r.input.revenue) * 100);
  return `
    <text x="108" y="300" font-size="44" font-weight="700" fill="${C.ink900}">税・保険で、持っていかれた</text>
    <text x="108" y="530">
      <tspan font-size="220" font-weight="800" fill="${C.burden}">${man(r.burdenTotal)}</tspan><tspan font-size="84" font-weight="700" fill="${C.burden}" dx="10">万円</tspan>
    </text>
    <text x="972" y="452" font-size="34" fill="${C.ink500}" text-anchor="end">売上の</text>
    <text x="972" y="520" font-size="72" font-weight="800" fill="${C.burden}" text-anchor="end">${rate}%</text>
    <text x="108" y="628" font-size="38" fill="${C.ink500}">売上${man(r.input.revenue)}万円、手取りは ${man(r.takeHome)}万円(${takeRate}%)でした</text>
    ${breakdownBar(r)}`;
}

/** 備え型:来年の納税カレンダーの山(3月に◯万の山) */
function prepareMiddle(r: TaxResult): string {
  const sched = buildPaymentSchedule(r);
  const peak = sched.peak;
  const monthlyReserve = r.monthlyTaxReserve;

  // 12ヶ月のミニ棒グラフ(ピーク月=確定申告の山を濃いamberで強調)
  const barsX = 108;
  const barsW = 864;
  const baseline = 806;
  const maxBarH = 150;
  const slot = barsW / 12;
  const barW = slot * 0.6;
  const bars = sched.months
    .map((m, i) => {
      const h = Math.max(4, (m.total / sched.maxTotal) * maxBarH);
      const x = barsX + i * slot + (slot - barW) / 2;
      const y = baseline - h;
      const color = m.big ? C.tax : C.taxSoft;
      const monthLabel = `<text x="${(x + barW / 2).toFixed(1)}" y="${baseline + 32}" font-size="24" fill="${C.ink400}" text-anchor="middle">${m.label.replace('月', '')}</text>`;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${color}"/>${monthLabel}`;
    })
    .join('');

  return `
    <text x="108" y="280" font-size="38" font-weight="700" fill="${C.prepare}">来年、いちばん大きい支払いは</text>
    <text x="108" y="360" font-size="38" font-weight="700" fill="${C.ink600}">${peak.label}${peak.big ? '・確定申告' : ''}に</text>
    <text x="108" y="550">
      <tspan font-size="150" font-weight="800" fill="${C.burden}">${man(peak.total)}</tspan><tspan font-size="60" font-weight="700" fill="${C.burden}" dx="8">万円の山</tspan>
    </text>
    ${bars}
    <line x1="${barsX}" y1="${baseline}" x2="${barsX + barsW}" y2="${baseline}" stroke="${C.expense}" stroke-width="2"/>
    <text x="108" y="892" font-size="34" fill="${C.ink500}">毎月 <tspan font-weight="800" fill="${C.ink900}">${man(monthlyReserve)}万円</tspan>ずつよけておけば、慌てません</text>`;
}

const MIDDLE: Record<ShareVariant, (r: TaxResult) => string> = {
  brag: bragMiddle,
  empathy: empathyMiddle,
  prepare: prepareMiddle,
};

/** 結果を、指定した感情別バリアントの 1080×1080 シェア画像(SVG文字列)にする */
export function buildShareSvg(r: TaxResult, variant: ShareVariant): string {
  return frame(MIDDLE[variant](r));
}

/** プレビュー用の data URL(<img src> に差せる) */
export function shareSvgDataUrl(r: TaxResult, variant: ShareVariant): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(buildShareSvg(r, variant))}`;
}

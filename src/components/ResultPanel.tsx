'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaxResult } from '@/lib/tax/types';
import { calculateTax } from '@/lib/tax/calculator';
import { CONSUMPTION_LABELS, formatPercent, formatYen } from '@/lib/tax/format';
import {
  IDECO_MONTHLY_MAX,
  IDECO_MONTHLY_MIN,
  INCOME_TAX_BRACKETS,
  NATIONAL_PENSION_MONTHLY,
} from '@/lib/tax/constants';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';
import { ShareImageButton } from './ShareImageButton';
import { ManInput } from './ManInput';

interface DetailRow {
  label: string;
  value?: string;
  highlight?: boolean; // 該当区分を強調
  heading?: boolean; // 小見出し
  note?: boolean; // ひとこと解説(この数字は何のお金か)
}

function man(value: number): string {
  return (value / 10000).toLocaleString('ja-JP', {
    maximumFractionDigits: 0,
  });
}

/** 万円表記(小数1桁)。狭いカードで円表記が収まらないところ用 */
function manShort(yen: number): string {
  return `${(yen / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万`;
}

/** 「50,000」のようなカンマ入り数字テキストを数値(円)に */
function numFromText(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function withCommas(value: number): string {
  return value ? value.toLocaleString('ja-JP') : '';
}

/** 数値の変化をなめらかに追いかける(初回は0からカウントアップ)。
    reduced-motion 設定なら即時反映 */
function useAnimatedNumber(target: number, duration = 450): number {
  const [display, setDisplay] = useState(0);
  // いま画面に出ている値。中断(StrictModeの二重実行含む)後の再開基点になる
  const displayRef = useRef(0);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    // reduced-motion なら1フレームで最終値へ(setState は必ず rAF 経由)
    const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : duration;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = dur === 0 ? 1 : Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = from + (target - from) * eased;
      displayRef.current = value;
      setDisplay(value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

/** 値が変わった瞬間の増減を返す(バッジ表示用。初回マウントでは出さない) */
function useDelta(value: number): { amount: number; id: number } | null {
  const prev = useRef<number | null>(null);
  const [delta, setDelta] = useState<{ amount: number; id: number } | null>(
    null
  );
  useEffect(() => {
    if (prev.current !== null && value !== prev.current) {
      setDelta({ amount: value - prev.current, id: Date.now() });
    }
    prev.current = value;
  }, [value]);
  return delta;
}

/** 増減バッジの表示テキスト(1万円未満は円、以上は万円) */
function fmtDelta(yen: number): string {
  const sign = yen > 0 ? '+' : '−';
  const abs = Math.abs(yen);
  if (abs >= 10000) {
    return `${sign}${(abs / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`;
  }
  return `${sign}${abs.toLocaleString('ja-JP')}円`;
}

/** 手取りの増減バッジ(CSSアニメーションで勝手に消える) */
function DeltaBadge({
  delta,
  small,
}: {
  delta: { amount: number; id: number } | null;
  small?: boolean;
}) {
  if (!delta || delta.amount === 0) return null;
  return (
    <span
      key={delta.id}
      className={`delta-pop tabular inline-block rounded-full bg-white/95 font-bold shadow-sm ${
        delta.amount > 0 ? 'text-emerald-700' : 'text-rose-600'
      } ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
      role="status"
    >
      {fmtDelta(delta.amount)}
    </span>
  );
}

/** ひとこと診断:結果を3行の言葉で(テンプレ生成) */
function Diagnosis({ result }: { result: TaxResult }) {
  const r = result;
  if (r.input.revenue <= 0) return null;

  const takeRate = Math.round((r.takeHome / r.input.revenue) * 100);

  // いちばん重い負担項目
  const heaviest = (
    [
      ['所得税', r.incomeTax],
      ['住民税', r.residentTax],
      ['個人事業税', r.businessTax],
      ['消費税', r.consumptionTax],
      [
        r.input.insurance === 'kokuho' ? '国民健康保険' : '健康保険',
        r.healthInsurance,
      ],
      ['国民年金', r.nationalPension],
    ] as [string, number][]
  ).reduce((a, b) => (b[1] > a[1] ? b : a));

  // 翌年3月の確定申告の山(所得税+消費税)
  const marchLump = r.incomeTax + r.consumptionTax;

  const lines: React.ReactNode[] = [];

  if (r.takeHome < 0) {
    lines.push(
      <>
        手取りは
        <strong className="tabular text-ink-900">
          マイナス{man(Math.abs(r.takeHome))}万円
        </strong>
        (経費と税・保険が売上を上回っています)
      </>
    );
  } else {
    lines.push(
      <>
        手取りは
        <strong className="tabular text-ink-900">{man(r.takeHome)}万円</strong>
        (売上{man(r.input.revenue)}万円の{takeRate}%)
      </>
    );
  }

  if (heaviest[1] > 0) {
    lines.push(
      <>
        いちばん重い負担は
        <strong className="tabular text-ink-900">
          {heaviest[0]}の{man(heaviest[1])}万円
        </strong>
      </>
    );
  }

  if (marchLump > 0) {
    lines.push(
      <>
        来年3月の確定申告で
        <strong className="tabular text-ink-900">
          約{man(marchLump)}万円の山
        </strong>{' '}
        → 毎月
        <strong className="tabular text-ink-900">
          {manShort(r.monthlyTaxReserve)}円
        </strong>
        よけておけば慌てません
      </>
    );
  } else if (r.residentTax > 0) {
    lines.push(
      <>
        3月の納付はなし。山は来年6月からの住民税(1期あたり 約
        <strong className="tabular text-ink-900">
          {man(Math.round(r.residentTax / 4))}万円
        </strong>
        )
      </>
    );
  } else if (r.burdenTotal <= 0) {
    lines.push(<>今回の条件では、税・保険の負担はほとんどありません</>);
  }

  return (
    <div className="mb-4 rounded-2xl bg-cream-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-cream-200 text-sm">
          🔎
        </span>
        ひとこと診断
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {lines.map((l, i) => (
          <li
            key={i}
            className="flex gap-2 text-[13px] leading-relaxed text-ink-600"
          >
            <span
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="mb-1.5 space-y-1 rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-600">
      {rows.map((r, i) =>
        r.note ? (
          <div
            key={i}
            className="rounded-lg bg-white/80 px-2 py-1.5 text-xs leading-relaxed text-ink-600"
          >
            💡 {r.label}
          </div>
        ) : r.heading ? (
          <div key={i} className="pt-1.5 font-semibold text-ink-900">
            {r.label}
          </div>
        ) : (
          <div
            key={i}
            className={`flex items-baseline justify-between gap-2 rounded px-1 ${
              r.highlight ? 'bg-emerald-100 font-medium text-emerald-800' : ''
            }`}
          >
            <span>{r.label}</span>
            {r.value !== undefined && (
              <span className="tabular shrink-0">{r.value}</span>
            )}
          </div>
        )
      )}
    </div>
  );
}

/** 所得税の速算表を行データ化し、該当区分をハイライトする */
function incomeTaxBracketRows(taxableIncome: number): DetailRow[] {
  const applicable = INCOME_TAX_BRACKETS.findIndex(
    (b) => taxableIncome <= b.limit
  );
  const manLabel = (n: number) => (n / 10000).toLocaleString('ja-JP');
  return INCOME_TAX_BRACKETS.map((b, i) => {
    const lower = i === 0 ? 0 : INCOME_TAX_BRACKETS[i - 1].limit;
    let range: string;
    if (i === 0) range = `〜${manLabel(b.limit)}万円`;
    else if (!Number.isFinite(b.limit)) range = `${manLabel(lower)}万円〜`;
    else range = `${manLabel(lower)}〜${manLabel(b.limit)}万円`;
    return {
      label: `${range}:税率${formatPercent(b.rate, 0)}`,
      value: `控除 ${formatYen(b.deduction)}`,
      highlight: i === applicable,
    };
  });
}

/** 結果の中で金額をその場調整するミニ入力(±ステッパー付き・万円単位) */
function InlineField({
  label,
  valueYen,
  onChangeYen,
  stepYen,
}: {
  label: string;
  valueYen: number;
  onChangeYen: (yen: number) => void;
  stepYen: number;
}) {
  const stepMan = stepYen / 10000;
  const stepBtn =
    'grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-cream-300 bg-white text-lg font-bold text-ink-600 transition-colors hover:border-emerald-400 hover:text-emerald-700 active:bg-emerald-50';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-ink-700">{label}</span>
        <span className="text-[10px] text-ink-400">±{stepMan}万</span>
      </div>
      <div className="mt-1 flex items-stretch gap-1.5">
        <button
          type="button"
          aria-label={`${label}を${stepMan}万円減らす`}
          className={stepBtn}
          onClick={() => onChangeYen(Math.max(0, valueYen - stepYen))}
        >
          −
        </button>
        <ManInput
          valueYen={valueYen}
          onChangeYen={onChangeYen}
          suffix="万"
          className="min-w-0 flex-1"
          inputClassName="tabular h-11 w-full rounded-xl border-[1.5px] border-cream-300 bg-white px-2 pr-7 text-center text-base font-bold text-ink-900 focus:border-emerald-500 focus:outline-none"
          suffixClassName="text-[10px] font-semibold text-ink-400"
        />
        <button
          type="button"
          aria-label={`${label}を${stepMan}万円増やす`}
          className={stepBtn}
          onClick={() => onChangeYen(valueYen + stepYen)}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
  detail,
  defaultOpen,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  detail?: DetailRow[];
  /** 最初から展開しておく(「行は開ける」ことを1行目で体験させる用) */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const labelClass = `text-sm ${strong ? 'font-semibold text-ink-900' : 'text-ink-600'}`;
  const valueClass = `tabular text-right ${strong ? 'text-base font-semibold' : 'text-sm'}`;

  if (!detail) {
    return (
      <div
        className={`flex items-baseline justify-between gap-3 px-2.5 py-1.5 ${
          strong ? 'rounded-lg bg-cream-100/70' : ''
        }`}
      >
        <span className={labelClass}>
          {label}
          {hint ? (
            <span className="ml-1 text-xs text-ink-400">{hint}</span>
          ) : null}
        </span>
        <span className={valueClass}>{value}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors ${
          open ? 'bg-emerald-50' : 'hover:bg-cream-50'
        }`}
      >
        <span className={labelClass}>
          {label}
          {hint ? (
            <span className="ml-1 text-xs text-ink-400">{hint}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={valueClass}>{value}</span>
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] leading-none transition-transform ${
              open
                ? 'rotate-180 bg-emerald-600 text-white'
                : 'bg-emerald-100 text-emerald-700'
            }`}
            aria-hidden
          >
            ▼
          </span>
        </span>
      </button>
      {open && <Detail rows={detail} />}
    </div>
  );
}

/** 売上がどう分かれるかの積み上げバー(各区分をバー内＋真下ラベルで一目に) */
function BreakdownBar({
  segments,
}: {
  segments: {
    label: string;
    value: number;
    color: string;
    text: string; // バー内・ドットの文字色に対する見やすさ用のテキスト色
  }[];
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total <= 0) return null;
  const pct = (v: number) => (Math.max(0, v) / total) * 100;
  return (
    <div>
      {/* バー本体:幅のある区分は中に「名前＋割合」を表示。
          区分の境目は白の細い隙間で(色の近さに頼らず判別できるように) */}
      <div className="flex h-12 gap-[2px] overflow-hidden rounded-xl">
        {segments.map((s) => {
          const p = pct(s.value);
          return (
            <div
              key={s.label}
              className={`${s.color} flex flex-col items-center justify-center overflow-hidden leading-none transition-[width] duration-500`}
              style={{ width: `${p}%` }}
              title={`${s.label} ${formatYen(s.value)}`}
            >
              {p >= 12 && (
                <>
                  <span
                    className={`truncate px-1 text-[11px] font-semibold ${s.text}`}
                  >
                    {s.label}
                  </span>
                  <span className={`text-[11px] font-bold ${s.text}`}>
                    {Math.round(p)}%
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* バーの真下に、区分ごとの金額を等幅で(狭い区分も切れない) */}
      <div className="mt-2.5 grid grid-cols-4 gap-1">
        {segments.map((s) => (
          <div key={s.label} className="text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] leading-tight text-ink-500">
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded ${s.color}`}
                aria-hidden
              />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="tabular whitespace-nowrap text-sm font-bold text-ink-900">
              {man(s.value)}万
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TimelineItem {
  label: string;
  amount: number;
}

interface TimelineMonth {
  lab: string; // 月ラベル(例: '3月')
  yr?: string; // 年のヒント(翌年 / 翌々年)
  items: TimelineItem[]; // その月に「まとめて来る税」
  kokuho: boolean; // 国保の請求がこの月にあるか(6月〜)
  tag?: string; // 金額のない出来事(国保 新年度切替 など)
  big: boolean; // 確定申告など、強調する山
  note: string; // ひとこと解説
}

/**
 * 支払いカレンダー(稼ぐ年 → 払う年 の2レーン)。
 * 「今年の所得」にかかる税・社会保険が、翌年どの時期に来るかを見せる。
 *  - 稼ぐ年(今年): 国民年金は毎月。任意継続などの健保も今年・毎月。手取りが積み上がる。
 *  - 払う年(翌年): 所得税・消費税は翌3月の確定申告、国保は翌4月〜(請求6月〜)、
 *    住民税は翌6月〜、個人事業税は翌8月・11月。
 */
function PaymentTimeline({ result }: { result: TaxResult }) {
  const r = result;
  const isKokuho = r.input.insurance === 'kokuho';
  const healthMonthly = Math.round(r.healthInsurance / 12);
  const paysPensionThisYear = r.input.insurance !== 'dependent';

  // 3月の確定申告でまとめて来るもの(所得税・消費税)
  const kakutei: TimelineItem[] = [];
  if (r.incomeTax > 0)
    kakutei.push({ label: '所得税(確定申告)', amount: r.incomeTax });
  if (r.consumptionTax > 0)
    kakutei.push({ label: '消費税(確定申告)', amount: r.consumptionTax });

  const juminInst = r.residentTax > 0 ? Math.round(r.residentTax / 4) : 0;
  const jigyoInst = r.businessTax > 0 ? Math.round(r.businessTax / 2) : 0;

  const months: TimelineMonth[] = [
    {
      lab: '3月',
      yr: '翌年',
      items: kakutei,
      // 国保の納付は6月〜翌3月(10期)が一般的。3月は前のサイクルの最終回が
      // 重なる(収入が同水準なら額もほぼ同じなので、毎月ものとして見せる)
      kokuho: isKokuho,
      big: kakutei.length > 0,
      note:
        kakutei.length > 0
          ? '確定申告。所得税と消費税をまとめて納める、1年でいちばん大きい山。'
          : '確定申告の時期。今回の条件では所得税・消費税の納付はなし。',
    },
    {
      lab: '4月',
      items: [],
      kokuho: false,
      tag: isKokuho ? '国保が新年度に切替' : undefined,
      big: false,
      note: isKokuho
        ? '国保が新年度(今年の所得ベース)に切替。実際の請求は6月ごろから届きます。'
        : 'この時期は大きな支払いなし。',
    },
    {
      lab: '5月',
      items: [],
      kokuho: false,
      big: false,
      note: '大きな支払いなし。',
    },
    {
      lab: '6月',
      items: juminInst > 0 ? [{ label: '住民税 1期', amount: juminInst }] : [],
      kokuho: isKokuho,
      big: false,
      note: isKokuho
        ? '住民税(1期)がスタート。国保の請求もこの月から始まります。'
        : '住民税(1期)がスタート。',
    },
    {
      lab: '7月',
      items: [],
      kokuho: isKokuho,
      big: false,
      note: isKokuho ? '国保のみ。' : '大きな支払いなし。',
    },
    {
      lab: '8月',
      items: [
        ...(juminInst > 0 ? [{ label: '住民税 2期', amount: juminInst }] : []),
        ...(jigyoInst > 0
          ? [{ label: '個人事業税 1期', amount: jigyoInst }]
          : []),
      ],
      kokuho: isKokuho,
      big: false,
      note: '住民税2期に個人事業税1期が重なりやすい月。',
    },
    {
      lab: '9月',
      items: [],
      kokuho: isKokuho,
      big: false,
      note: isKokuho ? '国保のみ。' : '大きな支払いなし。',
    },
    {
      lab: '10月',
      items: juminInst > 0 ? [{ label: '住民税 3期', amount: juminInst }] : [],
      kokuho: isKokuho,
      big: false,
      note: '住民税3期。',
    },
    {
      lab: '11月',
      items:
        jigyoInst > 0 ? [{ label: '個人事業税 2期', amount: jigyoInst }] : [],
      kokuho: isKokuho,
      big: false,
      note: '個人事業税2期。',
    },
    {
      lab: '12月',
      items: [],
      kokuho: isKokuho,
      big: false,
      note: isKokuho ? '国保のみ。' : '大きな支払いなし。',
    },
    {
      lab: '1月',
      yr: '翌々年',
      items:
        juminInst > 0 ? [{ label: '住民税 4期(最終)', amount: juminInst }] : [],
      kokuho: isKokuho,
      big: false,
      note: '住民税の最終回。ここで今年稼いだ分の精算がひと区切り。',
    },
    {
      lab: '2月',
      items: [],
      kokuho: isKokuho,
      big: false,
      note: '毎月の保険・年金のみ。3月にはまた次の年の確定申告が来て、1年がひと回りします。',
    },
  ];

  const lumpOf = (m: TimelineMonth) =>
    m.items.reduce((a, x) => a + x.amount, 0);
  // 毎月もの(国保・国民年金)。年金は所得と関係なく毎月定額なので常に入れる。
  // 棒グラフも「まとめて来る税+毎月もの」の積み上げにして、
  // 静かな月(4月・5月など)にも青い土台が見えるようにする
  const pensionMonthly = paysPensionThisYear ? NATIONAL_PENSION_MONTHLY : 0;
  const baseOf = (m: TimelineMonth) =>
    (m.kokuho ? healthMonthly : 0) + pensionMonthly;
  const totalOf = (m: TimelineMonth) => lumpOf(m) + baseOf(m);
  const maxTotal = Math.max(1, ...months.map(totalOf));
  const peak = months.reduce(
    (best, m, i) => (totalOf(m) > totalOf(months[best]) ? i : best),
    0
  );
  const [selected, setSelected] = useState(peak);
  const sel = months[selected];
  // 「この月に出ていくお金」= まとめて来る税 + 毎月もの
  const selTotal = totalOf(sel);

  return (
    <div className="mt-3">
      {/* レーン1:稼ぐ年(フラットな薄緑。グラデは白カード内で滲んで見えるためやめた) */}
      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50 p-3.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
            今年
          </span>
          <span className="text-sm font-bold text-emerald-800">稼ぐ年</span>
          <span className="text-xs text-ink-500">働いて所得が決まる年</span>
        </div>
        <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-emerald-950">
          働いて得た所得で、翌年の税額が決まる年。ふるさと納税をするなら、この年のうちに。
        </p>
      </div>

      {/* 受け渡し:稼ぐ(緑) → 払う(オレンジ)のズレを橋渡し */}
      <div className="relative flex justify-center py-2.5">
        <span
          className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-gradient-to-b from-emerald-300 to-amber-300"
          aria-hidden
        />
        <span className="relative flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 shadow-[0_3px_10px_rgba(180,83,9,0.18)]">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-600 text-white"
            aria-hidden
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 2v11M3.5 8.5 8 13l4.5-4.5" />
            </svg>
          </span>
          <span className="text-xs font-bold text-amber-800">
            この年の所得で、翌年の税額が決まる
          </span>
        </span>
      </div>

      {/* レーン2:払う年(レーン1に合わせてフラットに) */}
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50 p-3.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">
            翌年3月〜翌々2月
          </span>
          <span className="text-sm font-bold text-amber-800">払う年</span>
          <span className="text-xs text-ink-500">
            今年稼いだ分の税・保険を精算
          </span>
        </div>

        {/* 月バー(タップで内訳)。まとめて来る税(黄)+毎月の保険・年金(青)の積み上げ。
            3月〜翌々2月のちょうど12ヶ月で1サイクル */}
        <div className="mt-4 grid grid-cols-12 gap-1">
          {months.map((m, i) => {
            const isSel = i === selected;
            const l = lumpOf(m);
            const base = baseOf(m);
            const total = l + base;
            const lumpH = l > 0 ? Math.max((l / maxTotal) * 100, 8) : 0;
            const baseH = base > 0 ? Math.max((base / maxTotal) * 100, 7) : 0;
            return (
              <button
                type="button"
                key={m.lab}
                onClick={() => setSelected(i)}
                aria-pressed={isSel}
                aria-label={`${m.lab}の内訳`}
                className="flex flex-col items-center gap-1"
              >
                <div className="flex h-24 w-full flex-col items-center justify-end gap-0.5">
                  <span className="h-3.5 whitespace-nowrap text-[11px] font-bold leading-none text-ink-900">
                    {isSel && total > 0 ? manShort(total) : ''}
                  </span>
                  {l > 0 && (
                    <div
                      className={`w-full rounded-t-md transition-[height] duration-500 ${
                        isSel
                          ? 'bg-amber-600'
                          : m.big
                            ? 'bg-amber-500'
                            : 'bg-amber-300 hover:bg-amber-400'
                      }`}
                      style={{ height: `${lumpH}%` }}
                    />
                  )}
                  {base > 0 ? (
                    <div
                      className={`w-full transition-[height] duration-500 ${
                        l > 0 ? '' : 'rounded-t-md'
                      } ${isSel ? 'bg-sky-500' : 'bg-sky-300 hover:bg-sky-400'}`}
                      style={{ height: `${baseH}%` }}
                    />
                  ) : (
                    l <= 0 && (
                      <div
                        className="w-full rounded-t-md bg-cream-200"
                        style={{ height: '5%' }}
                      />
                    )
                  )}
                </div>
                <span
                  className={`text-[11px] leading-none ${
                    isSel ? 'font-bold text-amber-700' : 'text-ink-400'
                  }`}
                >
                  {m.lab}
                </span>
                <span className="text-[10px] leading-none text-ink-400">
                  {m.yr ?? ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* 選んだ月に払うもの */}
        <div className="mt-3 rounded-xl bg-cream-100 px-3.5 py-3">
          <p className="text-[13px] font-bold text-ink-900">
            {sel.lab}
            {sel.yr ? `(${sel.yr})` : ''} に払うもの
          </p>
          <div className="mt-1.5 space-y-1 text-xs">
            {sel.items.map((it) => (
              <div
                key={it.label}
                className="flex items-baseline justify-between gap-2 font-medium text-amber-700"
              >
                <span>{it.label}</span>
                <span className="tabular">{formatYen(it.amount)}</span>
              </div>
            ))}
            {sel.kokuho && (
              <div className="flex items-baseline justify-between gap-2 text-sky-700">
                <span>国民健康保険(毎月)</span>
                <span className="tabular">約 {formatYen(healthMonthly)}</span>
              </div>
            )}
            {pensionMonthly > 0 && (
              <div className="flex items-baseline justify-between gap-2 text-sky-700">
                <span>国民年金(毎月)</span>
                <span className="tabular">{formatYen(pensionMonthly)}</span>
              </div>
            )}
            {selTotal > 0 ? (
              <div className="flex items-baseline justify-between gap-2 border-t border-cream-300 pt-1 font-bold text-ink-900">
                <span>この月に出ていくお金</span>
                <span className="tabular">約 {formatYen(selTotal)}</span>
              </div>
            ) : (
              <p className="text-xs text-ink-400">大きな支払いはなし。</p>
            )}
          </div>
          {sel.tag && (
            <span className="mt-2 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
              {sel.tag}
            </span>
          )}
          <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs leading-relaxed text-ink-600">
            💡 {sel.note}
          </p>
        </div>

        {/* 凡例 */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-amber-500" />
            まとめて来る税
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-sky-400" />
            毎月の保険・年金(国保は4・5月おやすみ)
          </span>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel({
  result,
  expensesAssumed,
  onRevenueChange,
  onExpensesChange,
  onIdecoChange,
  onFurusatoChange,
}: {
  result: TaxResult;
  expensesAssumed?: boolean;
  onRevenueChange?: (yen: number) => void;
  onExpensesChange?: (yen: number) => void;
  onIdecoChange?: (monthlyYen: number) => void;
  onFurusatoChange?: (yen: number) => void;
}) {
  const r = result;
  const editable = Boolean(onRevenueChange && onExpensesChange);
  const ideco = r.input.idecoMonthly;
  // iDeCoの効き目 = 「掛金0円の自分」との差分。パネル表示用にだけ再計算する
  const idecoBase = useMemo(
    () => (ideco > 0 ? calculateTax({ ...r.input, idecoMonthly: 0 }) : null),
    [r.input, ideco]
  );
  const b = r.breakdown;
  const f = r.furusato;
  const paysPension = r.input.insurance !== 'dependent';
  const takeHomeRate = r.input.revenue > 0 ? r.takeHome / r.input.revenue : 0;

  // 手取りはカウントアップで追いかけ、変化した瞬間は増減バッジで見せる
  const takeHomeAnimated = useAnimatedNumber(r.takeHome);
  const monthlyAnimated = useAnimatedNumber(r.monthlyTakeHome);
  const takeHomeDelta = useDelta(r.takeHome);

  // ヒーローを上に通り過ぎたら、手取りのミニバーを貼り付ける。
  // IntersectionObserver は瞬間ジャンプ(非交差→非交差)で発火しないことが
  // あるため、スクロールごとに位置を見る(rAFで間引き)
  const heroRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const rect = heroRef.current?.getBoundingClientRect();
      setStuck(!!rect && rect.bottom <= 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function jumpTo(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-warm">
      {/* スティッキー手取りバー(長い結果のどこにいても主役が見える)。
          祖先の transform(rise-in)の影響で fixed の基準がずれないよう body 直下へ */}
      {stuck &&
        createPortal(
          <div className="slide-down fixed inset-x-0 top-0 z-40 bg-emerald-600/95 text-white shadow-[0_4px_14px_rgba(5,150,105,0.35)] backdrop-blur">
            <button
              type="button"
              aria-label="結果の先頭に戻る"
              onClick={() =>
                heroRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
              className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 py-2.5 text-left"
            >
              <span className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-emerald-50">
                  手取り(年)
                </span>
                <span className="tabular text-lg font-extrabold leading-none">
                  {man(takeHomeAnimated)}万円
                </span>
                {takeHomeRate > 0 && (
                  <span className="tabular text-xs text-emerald-50/90">
                    残る{formatPercent(takeHomeRate, 0)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <DeltaBadge delta={takeHomeDelta} small />
                <span className="text-xs text-emerald-50/80">▲ 先頭へ</span>
              </span>
            </button>
          </div>,
          document.body
        )}

      {/* 手取り(主役)— 色つきヒーローヘッダー */}
      <div
        ref={heroRef}
        className="relative scroll-mt-4 bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 pb-6 pt-7 text-white"
      >
        <p className="text-sm font-medium text-emerald-50">
          あなたの手取り(年)
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="tabular text-[3.25rem] font-extrabold leading-[0.9] tracking-tight">
            {man(takeHomeAnimated)}
          </span>
          <span className="text-xl font-bold">万円</span>
          <span className="tabular ml-1 text-sm font-normal text-white/95">
            ({formatYen(r.takeHome)})
          </span>
          <DeltaBadge delta={takeHomeDelta} />
        </p>

        {/* 月あたり・残る割合(自分ごとに響く2つ) */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
            <p className="text-xs text-emerald-50/90">月あたりの手取り</p>
            <p className="tabular mt-0.5 text-xl font-bold leading-none">
              約{man(monthlyAnimated)}
              <span className="ml-0.5 text-xs font-semibold">万円</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
            <p className="text-xs text-emerald-50/90">売上のうち残る割合</p>
            <p className="tabular mt-0.5 text-xl font-bold leading-none">
              {formatPercent(takeHomeRate, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 白ボディ(内訳・明細) */}
      <div className="px-6 pb-6 pt-5">
        {/* 結果内ジャンプ(長い結果の目次+この先の予告) */}
        <nav
          aria-label="結果内の移動"
          className="no-scrollbar -mx-6 mb-4 flex gap-2 overflow-x-auto px-6"
        >
          {(
            [
              ['sec-breakdown', '内訳'],
              ['sec-monthly', '毎月'],
              ['sec-calendar', 'カレンダー'],
              ['sec-savings', '節税'],
              ['sec-details', '明細'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => jumpTo(id)}
              className="shrink-0 rounded-full border-[1.5px] border-cream-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-emerald-400 hover:text-emerald-700"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ひとこと診断(数字の前に、言葉で結論) */}
        <Diagnosis result={r} />
        {/* 数字をその場で動かせるミニ入力(探索用。前提の変更は上のフォームで) */}
        {onRevenueChange && onExpensesChange && (
          <div className="mb-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink-900">
                数字を動かして、ためしてみる
              </p>
              <p className="text-[11px] text-ink-400">変えた瞬間に反映</p>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2.5">
              <InlineField
                label="売上"
                valueYen={r.input.revenue}
                onChangeYen={onRevenueChange}
                stepYen={500_000}
              />
              <InlineField
                label="経費"
                valueYen={r.input.expenses}
                onChangeYen={onExpensesChange}
                stepYen={100_000}
              />
            </div>
            {expensesAssumed && (
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                経費は売上の20%で仮置き中。直接入力すると固定されます。
              </p>
            )}
          </div>
        )}

        <p className="text-xs leading-relaxed text-ink-500">
          売上{man(r.input.revenue)}
          万円から、経費と税金・保険をぜんぶ引いて残る額です。
          {expensesAssumed && !editable && '(経費は売上の20%で仮置き中)'}
        </p>

        {/* 売上の分かれ方 */}
        <div className="mt-5 scroll-mt-14" id="sec-breakdown">
          <p className="mb-2 text-sm font-bold text-ink-900">
            売上{man(r.input.revenue)}万円は、こう分かれます
          </p>
          <BreakdownBar
            segments={[
              {
                label: '経費',
                value: r.input.expenses,
                color: 'bg-cream-300',
                text: 'text-ink-700',
              },
              {
                label: '税金',
                value: r.taxTotal,
                color: 'bg-amber-400',
                text: 'text-amber-900',
              },
              {
                // 税金(amber)と色相が近いと色覚によっては区別できないため、
                // 保険・年金は青系に(iDeCoパネルのskyと同系統)
                label: '保険・年金',
                value: r.socialInsuranceTotal,
                color: 'bg-sky-500',
                text: 'text-white',
              },
              {
                label: '手取り',
                value: r.takeHome,
                color: 'bg-emerald-600',
                text: 'text-white',
              },
            ]}
          />
          <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
            税金と保険をあわせて{' '}
            <span className="tabular font-semibold text-ink-900">
              {man(r.burdenTotal)}万円
            </span>
            (売上の
            <span className="tabular font-semibold text-ink-900">
              {formatPercent(r.effectiveRateOnRevenue)}
            </span>
            )が出ていきます。
          </p>
        </div>

        {/* 毎月のお金の3分解 */}
        <div
          className="mt-5 scroll-mt-14 rounded-2xl border border-cream-200 p-4"
          id="sec-monthly"
        >
          <p className="text-sm font-bold text-ink-900">
            毎月、自由に使えるのは？
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
            毎月の利益{' '}
            <span className="tabular font-semibold text-ink-700">
              {formatYen(
                r.monthlyFixedCost + r.monthlyTaxReserve + r.monthlyTakeHome
              )}
            </span>{' '}
            から、固定費と税をよけた残りが手取りです。
          </p>
          <div className="mt-3 grid grid-cols-3 items-stretch gap-1.5">
            {/* 固定費=保険・年金なので、内訳バーの「保険・年金」と同じ青系に揃える */}
            <div className="rounded-2xl bg-sky-50 px-2.5 py-3">
              <p className="text-[11px] font-semibold text-sky-700">固定費</p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-bold tracking-tight text-sky-900">
                {manShort(r.monthlyFixedCost)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-sky-700/70">
                <li>・国保</li>
                <li>・国民年金</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-amber-50 px-2.5 py-3">
              <p className="text-[11px] font-semibold text-amber-700">
                税の月割り
              </p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-bold tracking-tight text-amber-800">
                {manShort(r.monthlyTaxReserve)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-amber-600/80">
                <li>・所得税</li>
                <li>・住民税</li>
                <li>・個人事業税</li>
                <li>・消費税</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-emerald-600 px-2.5 py-3 text-white shadow-[0_6px_14px_rgba(5,150,105,0.25)]">
              <p className="text-[11px] font-bold text-emerald-50">手取り</p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-extrabold tracking-tight text-white">
                {manShort(r.monthlyTakeHome)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-emerald-50/85">
                <li>・生活費に</li>
                <li>・貯蓄に</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 税金・保険の支払いカレンダー(稼ぐ年 → 払う年) */}
        <div
          className="mt-4 scroll-mt-14 rounded-2xl border border-cream-200 p-4"
          id="sec-calendar"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-ink-900">
              税金・保険の支払いカレンダー
            </p>
            <p className="text-[11px] text-ink-400">月をタップで内訳</p>
          </div>
          <p className="mb-1 mt-0.5 text-xs leading-relaxed text-ink-500">
            今年稼いだ分の税・保険は、精算(支払い)が翌年から始まります。年金だけは今年から毎月。
          </p>
          <PaymentTimeline result={r} />
        </div>

        {/* ふるさと納税(ここから節税ゾーン) */}
        <div
          className="mt-4 scroll-mt-14 rounded-2xl bg-orange-50 px-4 py-3"
          id="sec-savings"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-orange-800">
              🍑 ふるさと納税の上限目安
            </span>
            <span className="tabular text-base font-semibold text-orange-800">
              {formatYen(r.furusatoNozeiLimit)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-orange-700/90">
            実質負担2,000円で済む寄附の、おおよその上限です(あくまで目安)。
          </p>

          {/* 寄附額をその場で入れて効果を見る */}
          {onFurusatoChange && (
            <div className="mt-3 border-t border-orange-200 pt-3">
              <label
                className="text-xs font-semibold text-orange-800"
                htmlFor="furusatoInline"
              >
                寄附額を入れて、効果をみる(年間)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="furusatoInline"
                  inputMode="numeric"
                  className="tabular w-full rounded-xl border-[1.5px] border-orange-200 bg-white px-3 py-2 text-sm font-bold text-ink-900 focus:border-orange-400 focus:outline-none"
                  value={withCommas(f.donation)}
                  onChange={(e) =>
                    onFurusatoChange(numFromText(e.target.value))
                  }
                  placeholder="0"
                />
                <span className="shrink-0 text-xs font-semibold text-orange-800">
                  円
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.furusatoNozeiLimit > 0 && (
                  <button
                    type="button"
                    className="rounded-full border border-orange-300 bg-white px-3 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                    onClick={() => onFurusatoChange(r.furusatoNozeiLimit)}
                  >
                    上限額を入れる({formatYen(r.furusatoNozeiLimit)})
                  </button>
                )}
                {f.donation > 0 && (
                  <button
                    type="button"
                    className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs text-orange-700/80 transition-colors hover:bg-orange-100"
                    onClick={() => onFurusatoChange(0)}
                  >
                    クリア
                  </button>
                )}
              </div>
            </div>
          )}

          {f.donation > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-orange-200 pt-3">
              <div className="flex items-baseline justify-between gap-2 text-sm text-orange-800">
                <span>寄附額</span>
                <span className="tabular">{formatYen(f.donation)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-xs text-orange-700/90">
                <span>
                  税の軽減(所得税 {formatYen(f.incomeTaxReduction)} + 住民税{' '}
                  {formatYen(f.residentReduction)})
                </span>
                <span className="tabular shrink-0">
                  − {formatYen(f.totalBenefit)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-orange-100 px-2 py-1.5 text-sm font-semibold text-orange-900">
                <span>実質の自己負担</span>
                <span className="tabular">{formatYen(f.outOfPocket)}</span>
              </div>
              {f.overLimit ? (
                <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs leading-relaxed text-red-700">
                  ⚠️ 上限(約{formatYen(r.furusatoNozeiLimit)}
                  )を超えています。超えた分は控除されず、実質負担は
                  {formatYen(f.outOfPocket)}に増えます。
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-orange-700/90">
                  上限内なので実質負担は2,000円。差額の
                  {formatYen(f.totalBenefit)}
                  は税が減って戻り、返礼品は別途もらえます。
                </p>
              )}
            </div>
          )}
        </div>

        {/* iDeCo(掛金スライダーで節税の効き目をその場で見る) */}
        {onIdecoChange && (
          <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-sky-900">
                🌱 iDeCoをやったら、どう変わる?
              </span>
              <span className="tabular shrink-0 whitespace-nowrap text-base font-semibold text-sky-900">
                月{formatYen(ideco)}
              </span>
            </div>
            {/* 実際の加入は月5,000円から。最初の1目盛り(4,000)を「なし」に
                割り当て、なし ↔ 5,000円 が1ステップで行き来できるようにする */}
            <input
              type="range"
              min={IDECO_MONTHLY_MIN - 1000}
              max={IDECO_MONTHLY_MAX}
              step={1000}
              value={ideco === 0 ? IDECO_MONTHLY_MIN - 1000 : ideco}
              onChange={(e) => {
                const v = Number(e.target.value);
                onIdecoChange(v < IDECO_MONTHLY_MIN ? 0 : v);
              }}
              aria-label="iDeCoの掛金(月額)"
              className="mt-3 h-2 w-full cursor-pointer accent-sky-700"
            />
            <div className="flex justify-between text-[11px] text-sky-800/70">
              <span>なし</span>
              <span>
                上限 月{(IDECO_MONTHLY_MAX / 10000).toLocaleString('ja-JP')}
                万円
              </span>
            </div>

            {ideco > 0 && idecoBase && (
              <div className="mt-3 space-y-1.5 border-t border-sky-200 pt-3">
                <div className="flex items-baseline justify-between gap-2 text-sm text-sky-900">
                  <span>掛金(年間)</span>
                  <span className="tabular">{formatYen(ideco * 12)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs text-sky-800/90">
                  <span>
                    税の軽減(所得税{' '}
                    {formatYen(idecoBase.incomeTax - r.incomeTax)} + 住民税{' '}
                    {formatYen(idecoBase.residentTax - r.residentTax)})
                  </span>
                  <span className="tabular shrink-0">
                    − {formatYen(idecoBase.taxTotal - r.taxTotal)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 rounded-lg bg-sky-100 px-2 py-1.5 text-sm font-semibold text-sky-900">
                  <span>手取りへの効果(年)</span>
                  <span className="tabular">
                    {r.takeHome >= idecoBase.takeHome ? '+' : '−'}
                    {formatYen(Math.abs(r.takeHome - idecoBase.takeHome))}
                  </span>
                </div>
                {idecoBase.taxTotal - r.taxTotal <= 0 ? (
                  <p className="rounded-lg bg-white/70 px-2 py-1.5 text-xs leading-relaxed text-sky-800/90">
                    💡 いまの条件では税金がほぼ0円のため、節税効果は出ません。
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-sky-800/90">
                    掛金は消える支出ではなく、60歳まで引き出せない自分の老後資産です。
                  </p>
                )}
                <ul className="space-y-0.5 text-xs leading-relaxed text-sky-800/80">
                  <li>・国保は下がりません</li>
                  {r.furusatoNozeiLimit !== idecoBase.furusatoNozeiLimit && (
                    <li>
                      ・ふるさと納税の上限も
                      {formatYen(
                        idecoBase.furusatoNozeiLimit - r.furusatoNozeiLimit
                      )}
                      下がります(上のパネルは反映済み)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ▼ ここから詳しい内訳 */}
        <div
          className="mt-6 flex scroll-mt-14 items-center justify-between border-t border-cream-200 pt-4"
          id="sec-details"
        >
          <p className="text-xs font-semibold text-ink-400">詳しい内訳</p>
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-[9px] text-emerald-700">
              ▼
            </span>
            の行をタップで計算とひとこと解説
          </span>
        </div>

        {/* 事業所得の計算 */}
        <div className="mt-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-cream-200 text-sm">
              🧮
            </span>
            事業所得の計算
          </h3>
          <div className="divide-y divide-cream-200">
            <Row label="売上" value={formatYen(r.input.revenue)} />
            <Row label="経費" value={`− ${formatYen(r.input.expenses)}`} />
            <Row
              label="青色申告特別控除"
              value={`− ${formatYen(r.blueDeductionApplied)}`}
            />
            <Row
              label="= 事業所得"
              value={formatYen(r.businessIncome)}
              strong
            />
            <Row
              label="所得控除の合計"
              hint={`(基礎・社会保険・配偶者・扶養${r.incomeTaxDeductions.ideco > 0 ? '・iDeCo' : ''})`}
              value={`− ${formatYen(r.incomeTaxDeductions.total)}`}
              detail={[
                {
                  label:
                    '所得から引いてもらえる「税金がかからない枠」。基礎控除は令和7年分から所得に応じて58万〜95万円に拡大されました。',
                  note: true,
                },
                {
                  label: '基礎控除',
                  value: formatYen(r.incomeTaxDeductions.basic),
                },
                {
                  label: '社会保険料控除',
                  value: formatYen(r.incomeTaxDeductions.socialInsurance),
                },
                ...(r.incomeTaxDeductions.ideco > 0
                  ? [
                      {
                        label: '小規模企業共済等掛金控除(iDeCo)',
                        value: formatYen(r.incomeTaxDeductions.ideco),
                      },
                    ]
                  : []),
                {
                  label: '配偶者控除',
                  value: formatYen(r.incomeTaxDeductions.spouse),
                },
                {
                  label: '扶養控除',
                  value: formatYen(r.incomeTaxDeductions.dependents),
                },
              ]}
            />
            <Row
              label="= 課税所得(所得税)"
              value={formatYen(r.taxableIncomeForIncomeTax)}
              strong
            />
          </div>
        </div>

        {/* 税金 */}
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-100 text-sm">
              🏛️
            </span>
            税金
          </h3>
          <div className="divide-y divide-cream-200">
            <Row
              label="所得税"
              hint="(復興税込)"
              value={formatYen(r.incomeTax)}
              defaultOpen
              detail={[
                {
                  label:
                    '国に払う税金。儲け(課税所得)が大きいほど税率が上がる累進課税。経費や控除を増やすと安くなります。',
                  note: true,
                },
                {
                  label: '課税所得',
                  value: formatYen(r.taxableIncomeForIncomeTax),
                },
                {
                  label: `× 税率 ${formatPercent(r.incomeTaxRate, 0)}`,
                  value: formatYen(
                    r.taxableIncomeForIncomeTax * r.incomeTaxRate
                  ),
                },
                {
                  label: `− 速算控除(税率${formatPercent(r.incomeTaxRate, 0)}の区分)`,
                  value: `− ${formatYen(r.incomeTaxRateDeduction)}`,
                },
                {
                  label: '= 所得税(100円未満切捨)',
                  value: formatYen(r.incomeTaxBase),
                },
                {
                  label: '+ 復興特別所得税 (×2.1%)',
                  value: formatYen(r.recoveryTax),
                },
                { label: '= 所得税', value: formatYen(r.incomeTax) },
                {
                  label: `所得税の速算表(あなたの区分は ${formatPercent(r.incomeTaxRate, 0)})`,
                  heading: true,
                },
                ...incomeTaxBracketRows(r.taxableIncomeForIncomeTax),
                {
                  label:
                    '※ 速算控除=累進課税を一回の掛け算で計算するための調整額',
                },
              ]}
            />
            <Row
              label="住民税"
              value={formatYen(r.residentTax)}
              detail={[
                {
                  label:
                    '住んでいる自治体に払う税金。ざっくり「課税所得の10%+固定額」。今年の所得ぶんを来年払うので、来年用によけておくのがコツ。',
                  note: true,
                },
                { label: '課税所得(住民税)を計算', heading: true },
                { label: '事業所得', value: formatYen(r.businessIncome) },
                {
                  label: '− 基礎控除',
                  value: `− ${formatYen(r.residentTaxDeductions.basic)}`,
                },
                {
                  label: '− 社会保険料控除',
                  value: `− ${formatYen(r.residentTaxDeductions.socialInsurance)}`,
                },
                ...(r.residentTaxDeductions.ideco > 0
                  ? [
                      {
                        label: '− iDeCo(小規模企業共済等掛金控除)',
                        value: `− ${formatYen(r.residentTaxDeductions.ideco)}`,
                      },
                    ]
                  : []),
                ...(r.residentTaxDeductions.spouse > 0
                  ? [
                      {
                        label: '− 配偶者控除',
                        value: `− ${formatYen(r.residentTaxDeductions.spouse)}`,
                      },
                    ]
                  : []),
                ...(r.residentTaxDeductions.dependents > 0
                  ? [
                      {
                        label: '− 扶養控除',
                        value: `− ${formatYen(r.residentTaxDeductions.dependents)}`,
                      },
                    ]
                  : []),
                {
                  label: '= 課税所得(1,000円未満切り捨て)',
                  value: formatYen(r.taxableIncomeForResidentTax),
                },
                { label: '住民税を計算', heading: true },
                {
                  label: '所得割(課税所得 × 10%)',
                  value: formatYen(b.residentIncomeLevy),
                },
                {
                  label: '+ 均等割・森林環境税',
                  value: formatYen(b.residentPerCapita),
                },
                { label: '= 住民税', value: formatYen(r.residentTax) },
              ]}
            />
            <Row
              label="個人事業税"
              value={formatYen(r.businessTax)}
              detail={
                r.input.businessTaxApplicable
                  ? [
                      {
                        label:
                          '都道府県に払う税金。利益が290万円を超えた分だけに5%。超えなければ0円です。',
                        note: true,
                      },
                      {
                        label: `(利益 ${formatYen(r.profit)} − 事業主控除 290万円)`,
                        value: formatYen(b.businessTaxBase),
                      },
                      { label: '× 5%', value: formatYen(r.businessTax) },
                    ]
                  : [{ label: '対象外の業種として 0 円' }]
              }
            />
            <Row
              label="消費税"
              value={formatYen(r.consumptionTax)}
              detail={
                b.consumption
                  ? [
                      {
                        label:
                          'お客さんから預かった消費税を、仕入れ分を引いて納める税金。インボイス登録の有無や特例で額が大きく変わります。',
                        note: true,
                      },
                      { label: '国税分を計算', heading: true },
                      {
                        label: '売上(税抜)= 課税標準額',
                        value: formatYen(b.consumption.salesBase),
                      },
                      {
                        label: '× 7.8% = 売上の消費税',
                        value: formatYen(b.consumption.salesNationalTax),
                      },
                      {
                        label:
                          r.input.consumptionTax === 'special2wari'
                            ? '− 2割特例(売上税額の80%を控除)'
                            : r.input.consumptionTax === 'simplified'
                              ? '− 簡易課税(みなし仕入率50%を控除)'
                              : '− 仕入の消費税(経費の税抜分)',
                        value: `− ${formatYen(b.consumption.salesNationalTax - b.consumption.national)}`,
                      },
                      {
                        label: '= 国税分',
                        value: formatYen(b.consumption.national),
                      },
                      { label: '地方消費税を計算', heading: true },
                      {
                        label: '国税分 × 22/78(地方分2.2%相当)',
                        value: formatYen(b.consumption.local),
                      },
                      { label: '合計', heading: true },
                      {
                        label: `国税分 + 地方消費税 = 消費税(${CONSUMPTION_LABELS[r.input.consumptionTax]})`,
                        value: formatYen(r.consumptionTax),
                      },
                    ]
                  : [{ label: '免税事業者のため 0 円' }]
              }
            />
            <Row label="税の合計" value={formatYen(r.taxTotal)} strong />
          </div>
        </div>

        {/* 社会保険 */}
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-sm">
              🛡️
            </span>
            社会保険
          </h3>
          <div className="divide-y divide-cream-200">
            <Row
              label="国民健康保険"
              value={formatYen(r.healthInsurance)}
              detail={
                b.kokuho
                  ? [
                      {
                        label:
                          'フリーランスの医療保険。前年の所得で決まり、自治体ごとに料率が違います。「高い」と感じる人がいちばん多い項目。',
                        note: true,
                      },
                      {
                        label: '所得割',
                        value: formatYen(b.kokuho.incomeLevy),
                      },
                      {
                        label: `+ 均等割 (被保険者 ${b.kokuho.insuredCount}人)`,
                        value: formatYen(b.kokuho.perCapita),
                      },
                      ...(b.kokuho.capped
                        ? [
                            {
                              label: `賦課限度額 ${formatYen(b.kokuho.cap)} でキャップ`,
                            },
                          ]
                        : []),
                      {
                        label: '= 国民健康保険',
                        value: formatYen(r.healthInsurance),
                      },
                    ]
                  : r.input.insurance === 'dependent'
                    ? [{ label: '扶養内のため 0 円' }]
                    : [
                        {
                          label: '手入力の保険料(年額)',
                          value: formatYen(r.healthInsurance),
                        },
                      ]
              }
            />
            <Row
              label="国民年金"
              hint="(本人分)"
              value={formatYen(r.nationalPension)}
              detail={
                paysPension
                  ? [
                      {
                        label:
                          '老後にもらう年金の基礎部分。所得に関係なく定額で、払った全額が社会保険料控除になります。',
                        note: true,
                      },
                      {
                        label: `月${NATIONAL_PENSION_MONTHLY.toLocaleString('ja-JP')}円 × 12(本人分)`,
                        value: formatYen(r.nationalPension),
                      },
                    ]
                  : [{ label: '扶養内(第3号)のため 0 円' }]
              }
            />
            <Row
              label="社会保険の合計"
              value={formatYen(r.socialInsuranceTotal)}
              strong
            />
          </div>
        </div>

        {/* 集計 */}
        <div className="mt-4 border-t border-cream-200 pt-3">
          <div className="divide-y divide-cream-200">
            <Row
              label="税 + 社会保険の合計"
              value={formatYen(r.burdenTotal)}
              strong
              detail={[
                { label: '税の合計', value: formatYen(r.taxTotal) },
                {
                  label: '+ 社会保険の合計',
                  value: formatYen(r.socialInsuranceTotal),
                },
              ]}
            />
            <Row
              label="手取り(年)"
              value={formatYen(r.takeHome)}
              strong
              detail={[
                { label: '売上', value: formatYen(r.input.revenue) },
                { label: '− 経費', value: formatYen(r.input.expenses) },
                { label: '− 税・社会保険', value: formatYen(r.burdenTotal) },
                ...(f.donation > 0
                  ? [
                      {
                        label: '− ふるさと納税の自己負担',
                        value: `− ${formatYen(f.outOfPocket)}`,
                      },
                    ]
                  : []),
                { label: '= 手取り', value: formatYen(r.takeHome) },
              ]}
            />
          </div>
        </div>

        {/* 結果を画像でシェア(バズ導線) */}
        <ShareImageButton result={r} />

        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          ⚠️ {DISCLAIMER_SHORT}
        </p>
      </div>
    </div>
  );
}

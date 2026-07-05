'use client';

import { useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import { CONSUMPTION_LABELS, formatPercent, formatYen } from '@/lib/tax/format';
import {
  INCOME_TAX_BRACKETS,
  NATIONAL_PENSION_MONTHLY,
} from '@/lib/tax/constants';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';
import { ShareImageButton } from './ShareImageButton';

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

function Detail({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="mb-1.5 space-y-1 rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-600">
      {rows.map((r, i) =>
        r.note ? (
          <div
            key={i}
            className="rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-ink-600"
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

function Row({
  label,
  value,
  hint,
  strong,
  detail,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  detail?: DetailRow[];
}) {
  const [open, setOpen] = useState(false);
  const labelClass = `text-sm ${strong ? 'font-semibold text-ink-900' : 'text-ink-600'}`;
  const valueClass = `tabular text-right ${strong ? 'text-base font-semibold' : 'text-sm'}`;

  if (!detail) {
    return (
      <div className="flex items-baseline justify-between gap-3 px-2 py-1.5">
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

/** 売上がどう分かれるかの積み上げバー */
function BreakdownBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total <= 0) return null;
  return (
    <div>
      <div className="flex h-9 overflow-hidden rounded-xl">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-[width] duration-500`}
            style={{ width: `${(Math.max(0, s.value) / total) * 100}%` }}
            title={`${s.label} ${formatYen(s.value)}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {segments.map((s) => (
          <div
            key={s.label}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="flex items-center gap-1.5 text-ink-600">
              <span
                className={`inline-block h-2.5 w-2.5 rounded ${s.color}`}
                aria-hidden
              />
              {s.label}
            </span>
            <span className="tabular font-semibold text-ink-900">
              {man(s.value)}万
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 表示は年度に合わせて4月始まり(index は 0=1月) */
const MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

interface DueItem {
  label: string;
  amount: number;
}

/** 税の納付スケジュールを棒グラフで見せ、月をタップで内訳を表示する(目安) */
function TaxCalendar({ result }: { result: TaxResult }) {
  const r = result;
  const monthlyFixed = (r.nationalPension + r.healthInsurance) / 12;

  // 月ごとの「まとめて来る税」の内訳(index 0 = 1月)
  const items: DueItem[][] = Array.from({ length: 12 }, () => []);
  if (r.incomeTax > 0) items[2].push({ label: '所得税', amount: r.incomeTax });
  if (r.consumptionTax > 0)
    items[2].push({ label: '消費税', amount: r.consumptionTax });
  if (r.residentTax > 0) {
    const inst: [number, string][] = [
      [5, '1期'],
      [7, '2期'],
      [9, '3期'],
      [0, '4期'],
    ];
    inst.forEach(([m, k]) =>
      items[m].push({ label: `住民税(${k})`, amount: r.residentTax / 4 })
    );
  }
  if (r.businessTax > 0) {
    const inst: [number, string][] = [
      [7, '1期'],
      [10, '2期'],
    ];
    inst.forEach(([m, k]) =>
      items[m].push({ label: `個人事業税(${k})`, amount: r.businessTax / 2 })
    );
  }

  const lump = items.map((ms) => ms.reduce((a, x) => a + x.amount, 0));
  const max = Math.max(...lump);
  const peak = lump.indexOf(max);
  const [selected, setSelected] = useState(peak);

  if (max <= 0) return null;
  const selItems = items[selected];
  const selTotal = monthlyFixed + lump[selected];

  return (
    <div>
      <div className="grid grid-cols-12 gap-1">
        {MONTH_ORDER.map((m) => {
          const d = lump[m];
          const isSel = m === selected;
          return (
            <button
              type="button"
              key={m}
              onClick={() => setSelected(m)}
              aria-label={`${m + 1}月の内訳`}
              aria-pressed={isSel}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex h-20 w-full items-end">
                <div
                  className={`w-full rounded-t transition-[height] duration-500 ${
                    d <= 0
                      ? 'bg-cream-200'
                      : isSel
                        ? 'bg-amber-500'
                        : 'bg-amber-300 hover:bg-amber-400'
                  }`}
                  style={{
                    height: d > 0 ? `${Math.max((d / max) * 100, 8)}%` : '4px',
                  }}
                />
              </div>
              <span
                className={`text-[9px] ${isSel ? 'font-bold text-amber-700' : 'text-ink-400'}`}
              >
                {m + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* 選んだ月に払うもの */}
      <div className="mt-3 rounded-xl bg-cream-100 px-3 py-2.5">
        <p className="text-xs font-bold text-ink-900">
          {selected + 1}月に払うもの
        </p>
        <div className="mt-1.5 space-y-1 text-xs text-ink-600">
          <div className="flex items-baseline justify-between gap-2">
            <span>
              国保・年金
              <span className="ml-1 text-[10px] text-ink-400">(毎月)</span>
            </span>
            <span className="tabular">{formatYen(monthlyFixed)}</span>
          </div>
          {selItems.map((x) => (
            <div
              key={x.label}
              className="flex items-baseline justify-between gap-2 font-medium text-amber-700"
            >
              <span>{x.label}</span>
              <span className="tabular">{formatYen(x.amount)}</span>
            </div>
          ))}
          {selItems.length > 0 && (
            <div className="flex items-baseline justify-between gap-2 border-t border-cream-300 pt-1 font-bold text-ink-900">
              <span>この月の合計</span>
              <span className="tabular">{formatYen(selTotal)}</span>
            </div>
          )}
        </div>
        {selItems.length === 0 && (
          <p className="mt-1 text-[11px] text-ink-400">
            この月は国保・年金だけ(まとめて来る税はなし)。
          </p>
        )}
      </div>
    </div>
  );
}

export function ResultPanel({
  result,
  expensesAssumed,
}: {
  result: TaxResult;
  expensesAssumed?: boolean;
}) {
  const r = result;
  const b = r.breakdown;
  const f = r.furusato;
  const paysPension = r.input.insurance !== 'dependent';
  const takeHomeRate = r.input.revenue > 0 ? r.takeHome / r.input.revenue : 0;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-warm">
      {/* 手取り(主役)— 色つきヒーローヘッダー */}
      <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 pb-6 pt-7 text-white">
        <p className="text-sm font-medium text-emerald-50">
          あなたの手取り(年)
        </p>
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="tabular text-[3.25rem] font-extrabold leading-[0.9] tracking-tight">
            {man(r.takeHome)}
          </span>
          <span className="text-xl font-bold">万円</span>
          <span className="tabular ml-1 text-sm font-normal text-emerald-50/80">
            ({formatYen(r.takeHome)})
          </span>
        </p>

        {/* 月あたり・残る割合(自分ごとに響く2つ) */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
            <p className="text-[11px] text-emerald-50/90">月あたりの手取り</p>
            <p className="tabular mt-0.5 text-xl font-bold leading-none">
              約{man(r.monthlyTakeHome)}
              <span className="ml-0.5 text-xs font-semibold">万円</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3.5 py-2.5">
            <p className="text-[11px] text-emerald-50/90">売上のうち残る割合</p>
            <p className="tabular mt-0.5 text-xl font-bold leading-none">
              {formatPercent(takeHomeRate, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 白ボディ(内訳・明細) */}
      <div className="px-6 pb-6 pt-5">
        <p className="text-xs leading-relaxed text-ink-500">
          売上{man(r.input.revenue)}
          万円から、経費と税金・保険をぜんぶ引いて残る額です。
          {expensesAssumed && '(経費は売上の20%で仮置き中)'}
        </p>

        {/* 売上の分かれ方 */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-ink-900">
            売上{man(r.input.revenue)}万円は、こう分かれます
          </p>
          <BreakdownBar
            segments={[
              { label: '経費', value: r.input.expenses, color: 'bg-cream-300' },
              { label: '税金', value: r.taxTotal, color: 'bg-amber-400' },
              {
                label: '保険・年金',
                value: r.socialInsuranceTotal,
                color: 'bg-orange-400',
              },
              { label: '手取り', value: r.takeHome, color: 'bg-emerald-600' },
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
        <div className="mt-5 rounded-2xl border border-cream-200 p-4">
          <p className="text-sm font-bold text-ink-900">
            毎月のお金、こう分かれます
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            毎月の利益(売上 − 経費 ÷ 12)の内訳です。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-cream-100 p-3">
              <p className="text-[11px] font-semibold text-ink-500">固定費</p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-bold tracking-tight text-ink-900">
                {formatYen(r.monthlyFixedCost)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-ink-400">
                <li>・国民健康保険</li>
                <li>・国民年金</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-[11px] font-semibold text-amber-700">
                税の月割り
              </p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-bold tracking-tight text-amber-800">
                {formatYen(r.monthlyTaxReserve)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-amber-600/80">
                <li>・所得税</li>
                <li>・住民税</li>
                <li>・個人事業税</li>
                <li>・消費税</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold text-emerald-700">
                手取り
              </p>
              <p className="tabular mt-0.5 whitespace-nowrap text-base font-bold tracking-tight text-emerald-700">
                {formatYen(r.monthlyTakeHome)}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[10px] leading-tight text-emerald-600/80">
                <li>・自由に使える</li>
              </ul>
            </div>
          </div>

          {/* 税金支払いスケジュール(納税カレンダー) */}
          <div className="mt-4 border-t border-cream-200 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink-900">
                税金支払いスケジュール
              </p>
              <p className="text-[10px] text-ink-400">月をタップで内訳</p>
            </div>
            <p className="mb-2.5 mt-0.5 text-xs text-ink-500">
              国保・年金は毎月。ほかの税はまとめて来ます。
            </p>
            <TaxCalendar result={r} />
          </div>
        </div>

        {/* ふるさと納税 */}
        <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-orange-800">
              🍑 ふるさと納税の上限目安
            </span>
            <span className="tabular text-base font-semibold text-orange-800">
              {formatYen(r.furusatoNozeiLimit)}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-orange-700/80">
            実質負担2,000円で済む寄附のおおよその上限(住民税所得割 × 20% ÷ (90%
            − 所得税率×1.021) + 2,000円)。あくまで目安です。
          </p>

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
                <p className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] leading-relaxed text-red-700">
                  ⚠️ 上限(約{formatYen(r.furusatoNozeiLimit)}
                  )を超えています。超えた分は控除しきれず、実質負担が2,000円より増えます(
                  {formatYen(f.outOfPocket)}
                  )。上限内に抑えると自己負担2,000円で済みます。
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-orange-700/80">
                  上限内なので実質2,000円の負担で寄附できます(差額の
                  {formatYen(f.totalBenefit)}
                  は税が減って戻ります)。手取りへの影響もこの自己負担分だけで、別途
                  返礼品がもらえます。
                </p>
              )}
            </div>
          )}
        </div>

        {/* ▼ ここから詳しい内訳 */}
        <div className="mt-6 flex items-center justify-between border-t border-cream-200 pt-4">
          <p className="text-xs font-semibold text-ink-400">詳しい内訳</p>
          <span className="flex items-center gap-1 text-[11px] text-ink-400">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-[9px] text-emerald-700">
              ▼
            </span>
            の行をタップで計算とひとこと解説
          </span>
        </div>

        {/* 事業所得の計算 */}
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold text-ink-900">
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
              hint="(基礎・社会保険・配偶者・扶養)"
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
          <h3 className="mb-1 text-sm font-semibold text-ink-900">税金</h3>
          <div className="divide-y divide-cream-200">
            <Row
              label="所得税"
              hint="(復興税込)"
              value={formatYen(r.incomeTax)}
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
          <h3 className="mb-1 text-sm font-semibold text-ink-900">社会保険</h3>
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

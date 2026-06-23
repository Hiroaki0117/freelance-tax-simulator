'use client';

import { useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import {
  CONSUMPTION_LABELS,
  formatPercent,
  formatYen,
} from '@/lib/tax/format';
import { INCOME_TAX_BRACKETS } from '@/lib/tax/constants';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';

interface DetailRow {
  label: string;
  value?: string;
  highlight?: boolean; // 該当区分を強調
  heading?: boolean; // 小見出し
}

function Detail({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="mb-1.5 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {rows.map((r, i) =>
        r.heading ? (
          <div key={i} className="pt-1.5 font-semibold text-slate-700">
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
  const man = (n: number) => (n / 10000).toLocaleString('ja-JP');
  return INCOME_TAX_BRACKETS.map((b, i) => {
    const lower = i === 0 ? 0 : INCOME_TAX_BRACKETS[i - 1].limit;
    let range: string;
    if (i === 0) range = `〜${man(b.limit)}万円`;
    else if (!Number.isFinite(b.limit)) range = `${man(lower)}万円〜`;
    else range = `${man(lower)}〜${man(b.limit)}万円`;
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
  const labelClass = `text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`;
  const valueClass = `tabular text-right ${strong ? 'text-base font-semibold' : 'text-sm'}`;

  if (!detail) {
    return (
      <div className="flex items-baseline justify-between gap-3 px-2 py-1.5">
        <span className={labelClass}>
          {label}
          {hint ? <span className="ml-1 text-xs text-slate-400">{hint}</span> : null}
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
        className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
          open ? 'bg-emerald-50' : 'hover:bg-slate-100/70'
        }`}
      >
        <span className={labelClass}>
          {label}
          {hint ? <span className="ml-1 text-xs text-slate-400">{hint}</span> : null}
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

export function ResultPanel({ result }: { result: TaxResult }) {
  const r = result;
  const b = r.breakdown;
  const f = r.furusato;
  const paysPension = r.input.insurance !== 'dependent';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">概算結果</h2>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-100 text-[9px] text-emerald-700">
            ▼
          </span>
          の行をタップで明細表示
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-xs text-emerald-700">手取り(年)</p>
          <p className="tabular mt-1 text-lg font-bold text-emerald-700">
            {formatYen(r.takeHome)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">引かれた合計</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatYen(r.burdenTotal)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">売上に対する負担率</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatPercent(r.effectiveRateOnRevenue)}
          </p>
        </div>
      </div>

      {/* 毎月のお金の3分解 */}
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700">
          毎月のお金、こう分かれます
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          毎月の利益(売上 − 経費 ÷ 12)の内訳です。
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-600">毎月の固定費</p>
            <p className="text-[10px] text-slate-400">国保・年金</p>
            <p className="tabular mt-1 text-base font-bold text-slate-800">
              {formatYen(r.monthlyFixedCost)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <p className="text-xs text-amber-700">税の月割り</p>
            <p className="text-[10px] text-amber-500">所得税・住民税・事業税・消費税</p>
            <p className="tabular mt-1 text-base font-bold text-amber-800">
              {formatYen(r.monthlyTaxReserve)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-700">毎月の手取り</p>
            <p className="text-[10px] text-emerald-500">自由に使える</p>
            <p className="tabular mt-1 text-base font-bold text-emerald-700">
              {formatYen(r.monthlyTakeHome)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          「税の月割り」は1年ぶんの税を12で割った額です。国保・年金は毎月払いですが、
          残りの税は来る時期がバラバラ(所得税・消費税は一括、住民税は年4回、事業税は年2回)。
          この月割りぶんを毎月よけておくと、納付の月も慌てません。
        </p>
      </div>

      {/* ふるさと納税 */}
      <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-orange-800">
            ふるさと納税の上限目安
          </span>
          <span className="tabular text-base font-semibold text-orange-800">
            {formatYen(r.furusatoNozeiLimit)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-orange-700/80">
          実質負担2,000円で済む寄附のおおよその上限(住民税所得割 × 20% ÷
          (90% − 所得税率×1.021) + 2,000円)。あくまで目安です。
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
            <div className="flex items-baseline justify-between gap-2 rounded-md bg-orange-100 px-2 py-1.5 text-sm font-semibold text-orange-900">
              <span>実質の自己負担</span>
              <span className="tabular">{formatYen(f.outOfPocket)}</span>
            </div>
            {f.overLimit ? (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] leading-relaxed text-red-700">
                ⚠️ 上限(約{formatYen(r.furusatoNozeiLimit)}
                )を超えています。超えた分は控除しきれず、実質負担が2,000円より増えます(
                {formatYen(f.outOfPocket)})。上限内に抑えると自己負担2,000円で済みます。
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
      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="text-xs font-medium text-slate-400">
          詳しい内訳(行をタップで計算を表示)
        </p>
      </div>

      {/* 事業所得の計算 */}
      <div className="mt-3">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">
          事業所得の計算
        </h3>
        <div className="divide-y divide-slate-100">
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
              { label: '基礎控除', value: formatYen(r.incomeTaxDeductions.basic) },
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
        <h3 className="mb-1 text-sm font-semibold text-slate-700">税金</h3>
        <div className="divide-y divide-slate-100">
          <Row
            label="所得税"
            hint="(復興税込)"
            value={formatYen(r.incomeTax)}
            detail={[
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
                label: '※ 速算控除=累進課税を一回の掛け算で計算するための調整額',
              },
            ]}
          />
          <Row
            label="住民税"
            value={formatYen(r.residentTax)}
            detail={[
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
                    { label: '= 国税分', value: formatYen(b.consumption.national) },
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
        <h3 className="mb-1 text-sm font-semibold text-slate-700">社会保険</h3>
        <div className="divide-y divide-slate-100">
          <Row
            label="国民健康保険"
            value={formatYen(r.healthInsurance)}
            detail={
              b.kokuho
                ? [
                    { label: '所得割', value: formatYen(b.kokuho.incomeLevy) },
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
                      label: '月16,980円 × 12(本人分)',
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
      <div className="mt-4 border-t border-slate-200 pt-3">
        <div className="divide-y divide-slate-100">
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

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        ⚠️ {DISCLAIMER_SHORT}
      </p>
    </div>
  );
}

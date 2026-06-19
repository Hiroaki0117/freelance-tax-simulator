'use client';

import { useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import {
  CONSUMPTION_LABELS,
  formatPercent,
  formatYen,
} from '@/lib/tax/format';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';

interface DetailRow {
  label: string;
  value?: string;
}

function Detail({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="mb-1.5 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2">
          <span>{r.label}</span>
          {r.value !== undefined && (
            <span className="tabular shrink-0">{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
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
      <div className="flex items-baseline justify-between gap-3 py-1.5">
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
        className="flex w-full items-baseline justify-between gap-3 py-1.5 text-left"
      >
        <span className={labelClass}>
          <span className="mr-1 inline-block text-[10px] text-slate-400">
            {open ? '▾' : '▸'}
          </span>
          <span className="underline decoration-dotted decoration-slate-300 underline-offset-2">
            {label}
          </span>
          {hint ? <span className="ml-1 text-xs text-slate-400">{hint}</span> : null}
        </span>
        <span className={valueClass}>{value}</span>
      </button>
      {open && <Detail rows={detail} />}
    </div>
  );
}

export function ResultPanel({ result }: { result: TaxResult }) {
  const r = result;
  const b = r.breakdown;
  const paysPension = r.input.insurance !== 'dependent';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">概算結果</h2>
        <span className="text-xs text-slate-400">タップで計算根拠を表示</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-xs text-emerald-700">手取り(年)</p>
          <p className="tabular mt-1 text-lg font-bold text-emerald-700">
            {formatYen(r.takeHome)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">毎月の積立目安</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatYen(r.monthlyReserve)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">売上に対する負担率</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatPercent(r.effectiveRateOnRevenue)}
          </p>
        </div>
      </div>

      {/* ふるさと納税の上限目安 */}
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
      </div>

      {/* 事業所得の計算 */}
      <div className="mt-5">
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
                label: `× 税率 ${formatPercent(r.incomeTaxRate, 0)} − 速算控除`,
                value: formatYen(r.incomeTaxBase),
              },
              {
                label: '+ 復興特別所得税 (×2.1%)',
                value: formatYen(r.recoveryTax),
              },
              { label: '= 所得税', value: formatYen(r.incomeTax) },
            ]}
          />
          <Row
            label="住民税"
            value={formatYen(r.residentTax)}
            detail={[
              {
                label: `所得割 (課税所得 ${formatYen(r.taxableIncomeForResidentTax)} × 10%)`,
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
                    { label: '国税分', value: formatYen(b.consumption.national) },
                    {
                      label: '+ 地方消費税',
                      value: formatYen(b.consumption.local),
                    },
                    {
                      label: `= 消費税 (${CONSUMPTION_LABELS[r.input.consumptionTax]})`,
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
            detail={[
              { label: '売上', value: formatYen(r.input.revenue) },
              { label: '− 経費', value: formatYen(r.input.expenses) },
              { label: '− 税・社会保険', value: formatYen(r.burdenTotal) },
              { label: '= 手取り', value: formatYen(r.takeHome) },
            ]}
          />
          <Row
            label="毎月の積立目安"
            value={formatYen(r.monthlyReserve)}
            detail={[
              {
                label: '税・社会保険の合計 ÷ 12(切り上げ)',
                value: formatYen(r.monthlyReserve),
              },
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

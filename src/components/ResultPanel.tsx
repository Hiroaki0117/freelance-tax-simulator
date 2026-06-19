'use client';

import type { TaxResult } from '@/lib/tax/types';
import { formatPercent, formatYen } from '@/lib/tax/format';
import { DISCLAIMER_SHORT } from '@/lib/disclaimer';

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span
        className={`text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-600'}`}
      >
        {label}
        {hint ? (
          <span className="ml-1 text-xs text-slate-400">{hint}</span>
        ) : null}
      </span>
      <span
        className={`tabular text-right ${strong ? 'text-base font-semibold' : 'text-sm'}`}
      >
        {value}
      </span>
    </div>
  );
}

export function ResultPanel({ result }: { result: TaxResult }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">概算結果</h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-xs text-emerald-700">手取り(年)</p>
          <p className="tabular mt-1 text-lg font-bold text-emerald-700">
            {formatYen(result.takeHome)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">毎月の積立目安</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatYen(result.monthlyReserve)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-600">売上に対する負担率</p>
          <p className="tabular mt-1 text-lg font-bold text-slate-800">
            {formatPercent(result.effectiveRateOnRevenue)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">税金</h3>
        <div className="divide-y divide-slate-100">
          <Row
            label="所得税"
            hint={`(復興税込・限界税率${formatPercent(result.incomeTaxRate, 0)})`}
            value={formatYen(result.incomeTax)}
          />
          <Row label="住民税" value={formatYen(result.residentTax)} />
          <Row label="個人事業税" value={formatYen(result.businessTax)} />
          <Row label="消費税" value={formatYen(result.consumptionTax)} />
          <Row label="税の合計" value={formatYen(result.taxTotal)} strong />
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">社会保険</h3>
        <div className="divide-y divide-slate-100">
          <Row
            label="国民健康保険"
            value={formatYen(result.healthInsurance)}
          />
          <Row
            label="国民年金"
            hint="(本人分)"
            value={formatYen(result.nationalPension)}
          />
          <Row
            label="社会保険の合計"
            value={formatYen(result.socialInsuranceTotal)}
            strong
          />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <Row
          label="税 + 社会保険の合計"
          value={formatYen(result.burdenTotal)}
          strong
        />
        <Row
          label="事業所得(青色控除後)"
          value={formatYen(result.businessIncome)}
        />
      </div>

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        ⚠️ {DISCLAIMER_SHORT}
      </p>
    </div>
  );
}

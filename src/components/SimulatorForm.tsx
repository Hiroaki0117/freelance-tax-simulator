'use client';

import type {
  ConsumptionTaxMode,
  FilingType,
  InsuranceType,
  TaxInput,
} from '@/lib/tax/types';
import {
  CONSUMPTION_LABELS,
  FILING_LABELS,
  INSURANCE_LABELS,
} from '@/lib/tax/format';

interface Props {
  input: TaxInput;
  onChange: (input: TaxInput) => void;
}

const cardClass =
  'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const selectClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

function manYen(value: number): string {
  if (!value) return '';
  return `= ${(value / 10000).toLocaleString('ja-JP')}万円`;
}

export function SimulatorForm({ input, onChange }: Props) {
  function update<K extends keyof TaxInput>(key: K, value: TaxInput[K]) {
    onChange({ ...input, [key]: value });
  }

  function num(value: string): number {
    const n = Number(value.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  return (
    <div className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold">入力</h2>

      <div className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="revenue">
            年間売上(税込・見込み)
          </label>
          <input
            id="revenue"
            inputMode="numeric"
            className={`${selectClass} tabular`}
            value={input.revenue ? input.revenue.toLocaleString('ja-JP') : ''}
            onChange={(e) => update('revenue', num(e.target.value))}
            placeholder="6,000,000"
          />
          <p className="mt-1 text-xs text-slate-500 tabular">
            {manYen(input.revenue)}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="expenses">
            年間経費(ざっくり)
          </label>
          <input
            id="expenses"
            inputMode="numeric"
            className={`${selectClass} tabular`}
            value={input.expenses ? input.expenses.toLocaleString('ja-JP') : ''}
            onChange={(e) => update('expenses', num(e.target.value))}
            placeholder="1,200,000"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[0.1, 0.2, 0.3].map((rate) => (
              <button
                key={rate}
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                onClick={() =>
                  update('expenses', Math.round(input.revenue * rate))
                }
              >
                売上の{rate * 100}%
              </button>
            ))}
            <span className="self-center text-xs text-slate-500 tabular">
              {manYen(input.expenses)}
            </span>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="filingType">
            申告区分
          </label>
          <select
            id="filingType"
            className={selectClass}
            value={input.filingType}
            onChange={(e) => update('filingType', e.target.value as FilingType)}
          >
            {(Object.keys(FILING_LABELS) as FilingType[]).map((k) => (
              <option key={k} value={k}>
                {FILING_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="consumptionTax">
            消費税の区分
          </label>
          <select
            id="consumptionTax"
            className={selectClass}
            value={input.consumptionTax}
            onChange={(e) =>
              update('consumptionTax', e.target.value as ConsumptionTaxMode)
            }
          >
            {(Object.keys(CONSUMPTION_LABELS) as ConsumptionTaxMode[]).map(
              (k) => (
                <option key={k} value={k}>
                  {CONSUMPTION_LABELS[k]}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="insurance">
            社会保険
          </label>
          <select
            id="insurance"
            className={selectClass}
            value={input.insurance}
            onChange={(e) =>
              update('insurance', e.target.value as InsuranceType)
            }
          >
            {(Object.keys(INSURANCE_LABELS) as InsuranceType[]).map((k) => (
              <option key={k} value={k}>
                {INSURANCE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="dependents">
              扶養親族(16歳以上)
            </label>
            <select
              id="dependents"
              className={selectClass}
              value={input.dependents}
              onChange={(e) => update('dependents', Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}人
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={input.hasSpouse}
                onChange={(e) => update('hasSpouse', e.target.checked)}
              />
              配偶者を扶養している
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={input.age40OrOver}
                onChange={(e) => update('age40OrOver', e.target.checked)}
              />
              40歳以上(介護分)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

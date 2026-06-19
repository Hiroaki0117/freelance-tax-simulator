'use client';

import { useState } from 'react';
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

type RevenueMode = 'annual' | 'monthly' | 'each';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const selectClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
const segBtn =
  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors';

function manYen(value: number): string {
  if (!value) return '';
  return `= ${(value / 10000).toLocaleString('ja-JP')}万円`;
}

function num(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function withCommas(value: number): string {
  return value ? value.toLocaleString('ja-JP') : '';
}

export function SimulatorForm({ input, onChange }: Props) {
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('annual');
  const [monthly, setMonthly] = useState(Math.round(input.revenue / 12));
  const [months, setMonths] = useState<number[]>(
    Array.from({ length: 12 }, () => Math.round(input.revenue / 12))
  );

  function update<K extends keyof TaxInput>(key: K, value: TaxInput[K]) {
    onChange({ ...input, [key]: value });
  }

  function switchMode(mode: RevenueMode) {
    setRevenueMode(mode);
    const seed = Math.round(input.revenue / 12);
    if (mode === 'monthly') {
      setMonthly(seed);
    } else if (mode === 'each') {
      setMonths(Array.from({ length: 12 }, () => seed));
    }
  }

  function setMonthlyValue(v: number) {
    setMonthly(v);
    update('revenue', v * 12);
  }

  function setMonthValue(index: number, v: number) {
    const next = months.slice();
    next[index] = v;
    setMonths(next);
    update(
      'revenue',
      next.reduce((a, b) => a + b, 0)
    );
  }

  const usesManualInsurance =
    input.insurance === 'voluntary' || input.insurance === 'other';

  return (
    <div className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold">入力</h2>

      <div className="space-y-4">
        {/* 売上(3つの入力方法) */}
        <div>
          <label className={labelClass}>年間売上(税込・見込み)</label>
          <div className="mt-1 flex gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['annual', '年額'],
                ['monthly', '月額×12'],
                ['each', '月別'],
              ] as [RevenueMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchMode(mode)}
                className={`${segBtn} ${
                  revenueMode === mode
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {revenueMode === 'annual' && (
            <input
              inputMode="numeric"
              className={`${selectClass} tabular`}
              value={withCommas(input.revenue)}
              onChange={(e) => update('revenue', num(e.target.value))}
              placeholder="6,000,000"
            />
          )}

          {revenueMode === 'monthly' && (
            <div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  className={`${selectClass} tabular`}
                  value={withCommas(monthly)}
                  onChange={(e) => setMonthlyValue(num(e.target.value))}
                  placeholder="500,000"
                />
                <span className="shrink-0 text-sm text-slate-500">円/月</span>
              </div>
            </div>
          )}

          {revenueMode === 'each' && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <label key={i} className="block">
                  <span className="text-[11px] text-slate-400">{i + 1}月</span>
                  <input
                    inputMode="numeric"
                    className="tabular w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                    value={withCommas(m)}
                    onChange={(e) => setMonthValue(i, num(e.target.value))}
                  />
                </label>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-slate-500 tabular">
            年間 {input.revenue.toLocaleString('ja-JP')}円 {manYen(input.revenue)}
          </p>
        </div>

        {/* 経費 */}
        <div>
          <label className={labelClass} htmlFor="expenses">
            年間経費(ざっくり)
          </label>
          <input
            id="expenses"
            inputMode="numeric"
            className={`${selectClass} tabular`}
            value={withCommas(input.expenses)}
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

        {/* 申告区分 */}
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

        {/* 消費税 */}
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

        {/* 健康保険 */}
        <div>
          <label className={labelClass} htmlFor="insurance">
            健康保険
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

          {usesManualInsurance && (
            <div className="mt-2">
              <label
                className="text-xs text-slate-500"
                htmlFor="healthInsuranceManual"
              >
                健康保険料(年額・手入力)
              </label>
              <input
                id="healthInsuranceManual"
                inputMode="numeric"
                className={`${selectClass} tabular`}
                value={withCommas(input.healthInsuranceManual)}
                onChange={(e) =>
                  update('healthInsuranceManual', num(e.target.value))
                }
                placeholder="360,000"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                任意継続などの実額を年額で(月額のときは ×12)。
                {manYen(input.healthInsuranceManual)}
              </p>
            </div>
          )}
        </div>

        {/* 扶養 */}
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

        {/* チェックボックス群 */}
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
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
            40歳以上(国保の介護分)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={input.businessTaxApplicable}
              onChange={(e) =>
                update('businessTaxApplicable', e.target.checked)
              }
            />
            個人事業税の対象業種
            <span className="text-xs text-slate-400">(非該当なら外す)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

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
import { AmountInput } from './AmountInput';

interface Props {
  input: TaxInput;
  onChange: (input: TaxInput) => void;
  /** ふるさと納税の上限目安(「上限額を入れる」ボタン用) */
  furusatoLimit: number;
}

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const selectClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

function num(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function withCommas(value: number): string {
  return value ? value.toLocaleString('ja-JP') : '';
}

function manYen(value: number): string {
  if (!value) return '';
  return `= ${(value / 10000).toLocaleString('ja-JP')}万円`;
}

export function SimulatorForm({ input, onChange, furusatoLimit }: Props) {
  function update<K extends keyof TaxInput>(key: K, value: TaxInput[K]) {
    onChange({ ...input, [key]: value });
  }

  const usesManualInsurance =
    input.insurance === 'voluntary' || input.insurance === 'other';

  return (
    <div className={cardClass}>
      <h2 className="mb-4 text-lg font-semibold">入力</h2>

      <div className="space-y-4">
        <AmountInput
          label="年間売上(税込・見込み)"
          value={input.revenue}
          onChange={(v) => update('revenue', v)}
          placeholder="6,000,000"
        />

        <AmountInput
          label="年間経費(ざっくり)"
          value={input.expenses}
          onChange={(v) => update('expenses', v)}
          placeholder="1,200,000"
          quick={[0.1, 0.2, 0.3].map((rate) => ({
            label: `売上の${rate * 100}%`,
            value: Math.round(input.revenue * rate),
          }))}
        />

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

        {/* ふるさと納税 */}
        <div>
          <label className={labelClass} htmlFor="furusatoDonation">
            ふるさと納税の寄附額(年間)
          </label>
          <input
            id="furusatoDonation"
            inputMode="numeric"
            className={`${selectClass} tabular`}
            value={withCommas(input.furusatoDonation)}
            onChange={(e) => update('furusatoDonation', num(e.target.value))}
            placeholder="0"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {furusatoLimit > 0 && (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                onClick={() => update('furusatoDonation', furusatoLimit)}
              >
                上限額を入れる(
                {(furusatoLimit / 10000).toLocaleString('ja-JP')}万円)
              </button>
            )}
            {input.furusatoDonation > 0 && (
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400"
                onClick={() => update('furusatoDonation', 0)}
              >
                クリア
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            実額を入れると控除と「実質負担」を概算します(0なら未利用)。
            {manYen(input.furusatoDonation)}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useRef, useState } from 'react';
import { calculateTax } from '@/lib/tax/calculator';
import { DEFAULT_INPUT } from '@/lib/tax/defaults';
import { TAX_YEAR } from '@/lib/tax/constants';
import type { TaxInput } from '@/lib/tax/types';
import {
  CONSUMPTION_LABELS,
  FILING_LABELS,
  INSURANCE_LABELS,
} from '@/lib/tax/format';
import { SimulatorForm } from './SimulatorForm';
import { ResultPanel } from './ResultPanel';
import { ManInput } from './ManInput';

/** 最初は空でスタート(結果は自分で売上をいれてから) */
const INITIAL_INPUT: TaxInput = { ...DEFAULT_INPUT, revenue: 0, expenses: 0 };

const REVENUE_PRESETS = [4_000_000, 6_000_000, 8_000_000];

/** 経費を自分で触るまでの仮置き比率 */
const ASSUMED_EXPENSE_RATE = 0.2;

export function Simulator() {
  const [input, setInput] = useState<TaxInput>(INITIAL_INPUT);
  const [expensesTouched, setExpensesTouched] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const revenueRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => calculateTax(input), [input]);
  const hasResult = input.revenue > 0;

  function setRevenue(revenue: number) {
    setInput((prev) => ({
      ...prev,
      revenue,
      expenses: expensesTouched
        ? prev.expenses
        : Math.round((revenue * ASSUMED_EXPENSE_RATE) / 10000) * 10000,
    }));
  }

  function handleFormChange(next: TaxInput) {
    if (next.expenses !== input.expenses) setExpensesTouched(true);
    setInput(next);
  }

  function handleCta() {
    if (hasResult) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      revenueRef.current?.focus();
    }
  }

  return (
    <div>
      {/* 入力カード(ファーストビュー) */}
      <div className="rounded-3xl bg-white p-6 shadow-warm">
        <label
          className="block text-sm font-bold text-ink-900"
          htmlFor="revenue"
        >
          去年(または今年見込み)の売上
        </label>
        <ManInput
          id="revenue"
          inputRef={revenueRef}
          valueYen={input.revenue}
          onChangeYen={setRevenue}
          placeholder="例: 600"
          className="mt-2"
          inputClassName="tabular w-full rounded-2xl border-2 border-cream-200 bg-cream-50 px-4 py-3.5 pr-20 text-2xl font-bold text-ink-900 placeholder:text-ink-400/60 focus:border-emerald-500 focus:outline-none"
          suffixClassName="text-lg font-bold text-ink-500"
        />
        {hasResult && (
          <p className="tabular mt-1.5 text-xs text-ink-400">
            = {input.revenue.toLocaleString('ja-JP')}円
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {REVENUE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRevenue(preset)}
              className={`rounded-full border-[1.5px] px-4 py-1.5 text-sm font-semibold transition-colors ${
                input.revenue === preset
                  ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700'
                  : 'border-cream-300 bg-white text-ink-600 hover:border-emerald-400 hover:text-emerald-700'
              }`}
            >
              {preset / 10000}万
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
            className="rounded-full border-[1.5px] border-dashed border-cream-300 px-4 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:border-emerald-400 hover:text-emerald-700"
          >
            詳細を入力する {detailsOpen ? '▴' : '▾'}
          </button>
        </div>

        {!detailsOpen && hasResult && (
          <div className="mt-3 rounded-xl bg-cream-50 px-3.5 py-3 text-xs leading-relaxed text-ink-500">
            <p className="font-bold text-ink-600">いまの計算の前提</p>
            <ul className="mt-1.5 space-y-1">
              <li className="flex gap-1.5">
                <span className="text-emerald-600">・</span>
                <span>
                  経費:{' '}
                  {expensesTouched
                    ? `${(input.expenses / 10000).toLocaleString('ja-JP')}万円`
                    : '売上の20%で仮置き'}
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-emerald-600">・</span>
                <span>申告: {FILING_LABELS[input.filingType]}</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-emerald-600">・</span>
                <span>消費税: {CONSUMPTION_LABELS[input.consumptionTax]}</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-emerald-600">・</span>
                <span>保険: {INSURANCE_LABELS[input.insurance]}</span>
              </li>
            </ul>
            <p className="mt-1.5 text-[11px] text-ink-400">
              変えたいときは「詳細を入力する」から。
            </p>
          </div>
        )}

        {detailsOpen && (
          <SimulatorForm
            input={input}
            onChange={handleFormChange}
            furusatoLimit={result.furusatoNozeiLimit}
            expensesAssumed={!expensesTouched && hasResult}
          />
        )}

        <button
          type="button"
          onClick={handleCta}
          className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-[0_8px_18px_rgba(5,150,105,0.28)] transition-colors hover:bg-emerald-700"
        >
          {hasResult ? '結果をみる' : 'ざっくり計算する'}
        </button>
      </div>

      <p className="mt-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
        <span>✓ 登録なし</span>
        <span>✓ 入力は保存されません</span>
        <span>✓ {TAX_YEAR}年分対応</span>
      </p>

      {/* 結果(売上をいれると出る) */}
      {hasResult && (
        <div ref={resultRef} className="rise-in mt-6 scroll-mt-4">
          <ResultPanel result={result} expensesAssumed={!expensesTouched} />
        </div>
      )}

      {/* AIチャット(ChatPanel)は一時非表示中。復活させるときは import と
          <ChatPanel input={input} result={result} /> を戻す。 */}
    </div>
  );
}

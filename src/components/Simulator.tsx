'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [showResult, setShowResult] = useState(false);
  const revenueRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => calculateTax(input), [input]);
  const hasRevenue = input.revenue > 0;
  const showingResult = showResult && hasRevenue;

  // 「結果をみる」を押して結果が現れたら、そこまでスクロールする
  useEffect(() => {
    if (showingResult) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // showResult が false→true に変わった初回だけ発火させたいので依存は showResult
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

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
    if (!hasRevenue) {
      revenueRef.current?.focus();
      return;
    }
    if (showResult) {
      // すでに表示済みなら結果までスクロール
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // 初回は表示を有効化(スクロールは useEffect が担当)
      setShowResult(true);
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
        {hasRevenue && (
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
        </div>

        {/* いまの計算の前提(右上に「詳細を入力」ボタン) */}
        {!detailsOpen && (
          <div className="mt-3 rounded-2xl bg-cream-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink-800">いまの計算の前提</p>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                aria-expanded={false}
                className="shrink-0 rounded-full border-2 border-emerald-500 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
              >
                詳細を入力 ▾
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 pb-2">
                <dt className="text-ink-500">経費</dt>
                <dd className="text-right font-bold text-ink-900">
                  {expensesTouched
                    ? `${(input.expenses / 10000).toLocaleString('ja-JP')}万円`
                    : '売上の20%で仮置き'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 pb-2">
                <dt className="text-ink-500">申告</dt>
                <dd className="text-right font-bold text-ink-900">
                  {FILING_LABELS[input.filingType]}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 pb-2">
                <dt className="text-ink-500">消費税</dt>
                <dd className="text-right font-bold text-ink-900">
                  {CONSUMPTION_LABELS[input.consumptionTax]}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-500">保険</dt>
                <dd className="text-right font-bold text-ink-900">
                  {INSURANCE_LABELS[input.insurance]}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {detailsOpen && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink-800">詳細を入力</p>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-expanded={true}
                className="shrink-0 rounded-full border-2 border-cream-300 bg-white px-4 py-2 text-sm font-bold text-ink-600 transition-colors hover:border-emerald-400 hover:text-emerald-700"
              >
                閉じる ▴
              </button>
            </div>
            <SimulatorForm
              input={input}
              onChange={handleFormChange}
              furusatoLimit={result.furusatoNozeiLimit}
              expensesAssumed={!expensesTouched && hasRevenue}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleCta}
          className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-[0_8px_18px_rgba(5,150,105,0.28)] transition-colors hover:bg-emerald-700"
        >
          {showingResult ? '結果をみる' : 'ざっくり計算する'}
        </button>
      </div>

      <p className="mt-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
        <span>✓ 登録・ログインなし</span>
        <span>✓ 入力内容は保存されません</span>
        <span>✓ 令和7年({TAX_YEAR}年)分対応</span>
      </p>

      {/* 結果(「結果をみる」を押すと出る) */}
      {showingResult && (
        <div ref={resultRef} className="rise-in mt-6 scroll-mt-4">
          <ResultPanel result={result} expensesAssumed={!expensesTouched} />
        </div>
      )}

      {/* AIチャット(ChatPanel)は一時非表示中。復活させるときは import と
          <ChatPanel input={input} result={result} /> を戻す。 */}
    </div>
  );
}

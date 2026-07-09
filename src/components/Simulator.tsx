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

/** 月額モードのプリセット(月額・円) */
const MONTHLY_PRESETS = [400_000, 600_000, 800_000];

/** 経費を自分で触るまでの仮置き比率 */
const ASSUMED_EXPENSE_RATE = 0.2;

export function Simulator() {
  const [input, setInput] = useState<TaxInput>(INITIAL_INPUT);
  const [expensesTouched, setExpensesTouched] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // 売上の入れ方:年間まとめて or 月額単価×稼働月(SES/準委任は月単価で考える人が多い)
  const [revenueMode, setRevenueMode] = useState<'annual' | 'monthly'>(
    'annual'
  );
  const [monthlyYen, setMonthlyYen] = useState(0);
  const [workMonths, setWorkMonths] = useState(12);
  // 売上が空のままボタンを押したときの「手応え」(シェイク+ひとこと)
  const [nudge, setNudge] = useState(false);
  const nudgeTimer = useRef<number | null>(null);
  const revenueRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => calculateTax(input), [input]);
  const hasRevenue = input.revenue > 0;
  // 一度開いた結果は閉じない(結果内のその場編集で売上が一時的に0になっても、
  // 入力欄ごと消えてフォーカスを失わないように)
  const showingResult = showResult;

  // 「結果をみる」を押して結果が現れたら、そこまでスクロールする
  useEffect(() => {
    if (showingResult) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // showResult が false→true に変わった初回だけ発火させたいので依存は showResult
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

  function setRevenue(revenue: number) {
    if (revenue > 0) setNudge(false);
    setInput((prev) => ({
      ...prev,
      revenue,
      expenses: expensesTouched
        ? prev.expenses
        : Math.round((revenue * ASSUMED_EXPENSE_RATE) / 10000) * 10000,
    }));
  }

  /** 月額単価 or 稼働月が変わったら、年間売上に換算して反映 */
  function setMonthlyRevenue(nextMonthlyYen: number, nextMonths: number) {
    setMonthlyYen(nextMonthlyYen);
    setWorkMonths(nextMonths);
    setRevenue(nextMonthlyYen * nextMonths);
  }

  function switchRevenueMode(mode: 'annual' | 'monthly') {
    if (mode === 'monthly' && revenueMode !== 'monthly') {
      // 年間の値から月額の初期値を種まき(12ヶ月想定)
      setMonthlyYen(
        input.revenue > 0 ? Math.round(input.revenue / 12 / 10000) * 10000 : 0
      );
      setWorkMonths(12);
    }
    setRevenueMode(mode);
  }

  function handleFormChange(next: TaxInput) {
    if (next.expenses !== input.expenses) setExpensesTouched(true);
    setInput(next);
  }

  function setExpenses(expenses: number) {
    setExpensesTouched(true);
    setInput((prev) => ({ ...prev, expenses }));
  }

  function handleCta() {
    if (!hasRevenue) {
      // 無反応に見えないように:フォーカス+シェイク+ひとこと
      revenueRef.current?.focus();
      setNudge(true);
      if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
      nudgeTimer.current = window.setTimeout(() => setNudge(false), 1800);
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
        <div className="flex items-center justify-between gap-3">
          <label
            className="block text-sm font-bold text-ink-900"
            htmlFor="revenue"
          >
            去年(または今年見込み)の売上
          </label>
          {/* 年間まとめて or 月額単価×稼働月 */}
          <div
            className="flex shrink-0 gap-1 rounded-full bg-cream-100 p-1"
            role="group"
            aria-label="売上の入れ方"
          >
            {(
              [
                ['annual', '年間'],
                ['monthly', '月額'],
              ] as const
            ).map(([m, t]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchRevenueMode(m)}
                aria-pressed={revenueMode === m}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  revenueMode === m
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-ink-500 hover:text-ink-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {revenueMode === 'annual' ? (
          <>
            <ManInput
              id="revenue"
              inputRef={revenueRef}
              valueYen={input.revenue}
              onChangeYen={setRevenue}
              placeholder="例: 600"
              className={`mt-2 ${nudge ? 'shake' : ''}`}
              inputClassName="tabular w-full rounded-2xl border-2 border-cream-200 bg-cream-50 px-4 py-3.5 pr-20 text-2xl font-bold text-ink-900 placeholder:text-ink-400/60 focus:border-emerald-500 focus:outline-none"
              suffixClassName="text-lg font-bold text-ink-500"
            />
            {hasRevenue && (
              <p className="tabular mt-1.5 text-xs text-ink-400">
                = {input.revenue.toLocaleString('ja-JP')}円
              </p>
            )}
          </>
        ) : (
          <>
            <div
              className={`mt-2 flex items-stretch gap-2 ${nudge ? 'shake' : ''}`}
            >
              <ManInput
                id="revenue"
                inputRef={revenueRef}
                valueYen={monthlyYen}
                onChangeYen={(v) => setMonthlyRevenue(v, workMonths)}
                placeholder="例: 60"
                suffix="万円/月"
                className="min-w-0 flex-1"
                inputClassName="tabular w-full rounded-2xl border-2 border-cream-200 bg-cream-50 px-4 py-3.5 pr-24 text-2xl font-bold text-ink-900 placeholder:text-ink-400/60 focus:border-emerald-500 focus:outline-none"
                suffixClassName="text-sm font-bold text-ink-500"
              />
              <label className="flex shrink-0 flex-col justify-stretch">
                <span className="sr-only">稼働月数</span>
                <select
                  value={workMonths}
                  onChange={(e) =>
                    setMonthlyRevenue(monthlyYen, Number(e.target.value))
                  }
                  className="h-full rounded-2xl border-2 border-cream-200 bg-cream-50 px-2 text-sm font-bold text-ink-900 focus:border-emerald-500 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => 12 - i).map((n) => (
                    <option key={n} value={n}>
                      ×{n}ヶ月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {hasRevenue && (
              <p className="tabular mt-1.5 text-xs text-ink-400">
                = 年{(input.revenue / 10000).toLocaleString('ja-JP')}万円(
                {input.revenue.toLocaleString('ja-JP')}円)
              </p>
            )}
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {(revenueMode === 'annual' ? REVENUE_PRESETS : MONTHLY_PRESETS).map(
            (preset) => {
              const active =
                revenueMode === 'annual'
                  ? input.revenue === preset
                  : monthlyYen === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    revenueMode === 'annual'
                      ? setRevenue(preset)
                      : setMonthlyRevenue(preset, workMonths)
                  }
                  className={`rounded-full border-[1.5px] px-4 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700'
                      : 'border-cream-300 bg-white text-ink-600 hover:border-emerald-400 hover:text-emerald-700'
                  }`}
                >
                  {revenueMode === 'annual'
                    ? `${preset / 10000}万`
                    : `月${preset / 10000}万`}
                </button>
              );
            }
          )}
        </div>
        {nudge && (
          <p role="status" className="mt-2 text-xs font-bold text-orange-700">
            まず売上を入れてください(上の「
            {revenueMode === 'annual' ? '600万' : '月60万'}
            」を押すだけでもOK)
          </p>
        )}

        {/* いまの計算の前提(右上に「詳細を入力」ボタン)。
            開閉は collapse-y で高さアニメーション。閉じている側は inert で
            タブ移動・支援技術からも外す */}
        <div
          className={`collapse-y ${detailsOpen ? '' : 'open'}`}
          inert={detailsOpen}
        >
          <div>
            <div className="mt-3 rounded-2xl bg-cream-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink-800">
                  いまの計算の前提
                </p>
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
                  <dt className="font-medium text-ink-900">経費</dt>
                  <dd className="text-right font-bold text-ink-900">
                    {expensesTouched
                      ? `${(input.expenses / 10000).toLocaleString('ja-JP')}万円`
                      : '売上の20%で仮置き'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 pb-2">
                  <dt className="font-medium text-ink-900">申告</dt>
                  <dd className="text-right font-bold text-ink-900">
                    {FILING_LABELS[input.filingType]}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-cream-200 pb-2">
                  <dt className="font-medium text-ink-900">消費税</dt>
                  <dd className="text-right font-bold text-ink-900">
                    {CONSUMPTION_LABELS[input.consumptionTax]}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-medium text-ink-900">保険</dt>
                  <dd className="text-right font-bold text-ink-900">
                    {INSURANCE_LABELS[input.insurance]}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div
          className={`collapse-y ${detailsOpen ? 'open' : ''}`}
          inert={!detailsOpen}
        >
          <div>
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
          </div>
        </div>

        <button
          type="button"
          onClick={handleCta}
          className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-[0_8px_18px_rgba(5,150,105,0.28)] transition-colors hover:bg-emerald-700"
        >
          {showingResult ? '結果をみる' : 'ざっくり計算する'}
        </button>
      </div>

      <p className="mt-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-400">
        <span>✓ 登録・ログインなし</span>
        <span>✓ 入力内容は保存されません</span>
        <span>✓ 令和7年({TAX_YEAR}年)分対応</span>
      </p>

      {/* 結果(「結果をみる」を押すと出る) */}
      {showingResult && (
        <div ref={resultRef} className="rise-in mt-6 scroll-mt-4">
          <ResultPanel
            result={result}
            expensesAssumed={!expensesTouched}
            onRevenueChange={setRevenue}
            onExpensesChange={setExpenses}
            onIdecoChange={(v) =>
              setInput((prev) => ({ ...prev, idecoMonthly: v }))
            }
            onFurusatoChange={(v) =>
              setInput((prev) => ({ ...prev, furusatoDonation: v }))
            }
          />
        </div>
      )}

      {/* AIチャット(ChatPanel)は一時非表示中。復活させるときは import と
          <ChatPanel input={input} result={result} /> を戻す。 */}
    </div>
  );
}

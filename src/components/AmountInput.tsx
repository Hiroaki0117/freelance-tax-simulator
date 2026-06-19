'use client';

import { useState } from 'react';

type Mode = 'annual' | 'monthly' | 'each';

interface QuickSet {
  label: string;
  value: number;
}

interface Props {
  label: string;
  value: number; // 年額(source of truth)
  onChange: (annual: number) => void;
  placeholder?: string;
  /** 年額モードのときだけ表示するクイック設定(例:売上の◯%) */
  quick?: QuickSet[];
}

const selectClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
const segBtn =
  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors';

function num(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function withCommas(value: number): string {
  return value ? value.toLocaleString('ja-JP') : '';
}

function manYen(value: number): string {
  if (!value) return '';
  return `(${(value / 10000).toLocaleString('ja-JP')}万円)`;
}

export function AmountInput({
  label,
  value,
  onChange,
  placeholder,
  quick,
}: Props) {
  const [mode, setMode] = useState<Mode>('annual');
  const [monthly, setMonthly] = useState(Math.round(value / 12));
  const [months, setMonths] = useState<number[]>(
    Array.from({ length: 12 }, () => Math.round(value / 12))
  );

  function switchMode(next: Mode) {
    setMode(next);
    const seed = Math.round(value / 12);
    if (next === 'monthly') setMonthly(seed);
    else if (next === 'each')
      setMonths(Array.from({ length: 12 }, () => seed));
  }

  function setMonthlyValue(v: number) {
    setMonthly(v);
    onChange(v * 12);
  }

  function setMonthValue(index: number, v: number) {
    const next = months.slice();
    next[index] = v;
    setMonths(next);
    onChange(next.reduce((a, b) => a + b, 0));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            ['annual', '年額'],
            ['monthly', '月額×12'],
            ['each', '月別'],
          ] as [Mode, string][]
        ).map(([m, t]) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`${segBtn} ${
              mode === m
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {mode === 'annual' && (
        <>
          <input
            inputMode="numeric"
            className={`${selectClass} tabular`}
            value={withCommas(value)}
            onChange={(e) => onChange(num(e.target.value))}
            placeholder={placeholder}
          />
          {quick && quick.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                  onClick={() => onChange(q.value)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'monthly' && (
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
      )}

      {mode === 'each' && (
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
        年間 {value.toLocaleString('ja-JP')}円 {manYen(value)}
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ManInput } from './ManInput';

type Mode = 'annual' | 'monthly' | 'each';

interface QuickSet {
  label: string;
  value: number;
}

interface Props {
  label: string;
  value: number; // 年額・円(source of truth)
  onChange: (annual: number) => void;
  placeholder?: string;
  /** 年額モードのときだけ表示するクイック設定(例:売上の◯%) */
  quick?: QuickSet[];
}

const inputClass =
  'w-full rounded-xl border border-cream-300 bg-white px-3 py-2 pr-14 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 tabular';
const segBtn =
  'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors';

function yenNote(value: number): string {
  if (!value) return '';
  return `(${value.toLocaleString('ja-JP')}円)`;
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
      <label className="block text-sm font-medium text-ink-600">{label}</label>
      <div className="mt-1 flex gap-1 rounded-xl bg-cream-100 p-1">
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
                : 'text-ink-500 hover:text-ink-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {mode === 'annual' && (
        <>
          <ManInput
            valueYen={value}
            onChangeYen={onChange}
            placeholder={placeholder}
            className="mt-1"
            inputClassName={inputClass}
          />
          {quick && quick.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="rounded-full border border-cream-300 px-3 py-1 text-xs text-ink-600 hover:border-emerald-400 hover:text-emerald-700"
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
        <ManInput
          valueYen={monthly}
          onChangeYen={setMonthlyValue}
          placeholder="10"
          suffix="万円/月"
          className="mt-2"
          inputClassName={`${inputClass} pr-20`}
        />
      )}

      {mode === 'each' && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {months.map((m, i) => (
            <label key={i} className="block">
              <span className="text-[11px] text-ink-400">{i + 1}月</span>
              <ManInput
                valueYen={m}
                onChangeYen={(v) => setMonthValue(i, v)}
                suffix="万"
                inputClassName="tabular w-full rounded-lg border border-cream-300 px-2 py-1 pr-7 text-xs focus:border-emerald-500 focus:outline-none"
                suffixClassName="text-[10px] text-ink-400"
              />
            </label>
          ))}
        </div>
      )}

      <p className="mt-1 text-xs text-ink-500 tabular">
        年間{' '}
        {(value / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}
        万円 {yenNote(value)}
      </p>
    </div>
  );
}

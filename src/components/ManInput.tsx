'use client';

import { useState } from 'react';

interface Props {
  id?: string;
  /** 内部は常に円。表示・入力は万円単位 */
  valueYen: number;
  onChangeYen: (yen: number) => void;
  placeholder?: string;
  /** 入力欄の右に重ねる単位表示 */
  suffix?: string;
  className?: string;
  inputClassName?: string;
  suffixClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

/** 「600」「10.5」のような万円テキストを円に変換 */
function parseMan(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 10000) : 0;
}

export function formatMan(yen: number): string {
  if (!yen) return '';
  return (yen / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
}

/**
 * 万円単位の金額入力。フォーカス中は打った文字列をそのまま保持し
 * (小数点が消えないように)、外れたら整形表示に戻す。
 */
export function ManInput({
  id,
  valueYen,
  onChangeYen,
  placeholder,
  suffix = '万円',
  className,
  inputClassName,
  suffixClassName,
  inputRef,
}: Props) {
  const [text, setText] = useState(() => formatMan(valueYen));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(valueYen);

  // 外から値が変わったら(チップ入力など)、編集中でない限り表示を追従させる
  if (valueYen !== lastValue) {
    setLastValue(valueYen);
    if (!focused) setText(formatMan(valueYen));
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        id={id}
        ref={inputRef}
        inputMode="decimal"
        className={inputClassName}
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(formatMan(valueYen));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChangeYen(parseMan(e.target.value));
        }}
      />
      <span
        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
          suffixClassName ?? 'text-sm font-semibold text-ink-500'
        }`}
        aria-hidden
      >
        {suffix}
      </span>
    </div>
  );
}

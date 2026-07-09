'use client';

import { useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import { buildShareParams } from '@/lib/tax/urlParams';

const SITE_URL = 'https://freelance-tedori.com';

function man(v: number): string {
  return Math.round(v / 10000).toLocaleString('ja-JP');
}

function buildShareUrl(result: TaxResult): string {
  const params = buildShareParams(result.input);
  return `${SITE_URL}/?${params.toString()}`;
}

function shareMessage(result: TaxResult): string {
  return `売上${man(result.input.revenue)}万のフリーランス、手取りは${man(result.takeHome)}万でした。あなたはいくら残る?👇`;
}

/**
 * 結果をURLで共有するボタン。押したときだけ共有用リンクを組み立てる
 * (入力するたびにアドレスバーを書き換えることはしない)。
 */
export function ShareLinkButton({ result }: { result: TaxResult }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = buildShareUrl(result);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境ではXの投稿画面を直接開く
      window.open(xIntentUrl(result), '_blank', 'noopener,noreferrer');
    }
  }

  function xIntentUrl(result: TaxResult): string {
    return `https://x.com/intent/post?${new URLSearchParams({
      text: shareMessage(result),
      url: buildShareUrl(result),
      hashtags: 'フリーランス,確定申告',
    }).toString()}`;
  }

  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-500 bg-white px-6 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
      >
        {copied ? '✓ リンクをコピーしました' : '🔗 この結果をリンクでシェア'}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-ink-400">
        共有用リンクには入力した売上・経費などの数字がURLに含まれます。人に見られたくない場合は共有しないでください。
      </p>
    </div>
  );
}

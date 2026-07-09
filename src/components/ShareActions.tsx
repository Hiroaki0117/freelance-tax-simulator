'use client';

// 結果のシェアパネル(画像でシェア+リンクでシェア)
//
// 画像でシェア:
// - 感情別に3種の画像から選べる(自慢 / 共感 / 備え・UX案 4-6)。選んだ型のプレビューを表示
// リンクでシェア:
// - 押した瞬間にだけ共有URL(/s?r=…)を組み立てる(自動でURLを書き換えない)
// - モバイル等はネイティブ共有シート、それ以外はクリップボードにコピー
//   +「そのままXでポストする」導線(リンクカードに結果入りOGP画像が出る)

import { useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import { buildShareUrl, shareMessage, xIntentUrl } from '@/lib/share';
import {
  SHARE_VARIANTS,
  shareSvgDataUrl,
  type ShareVariant,
} from '@/lib/shareImage';
import { ShareImageButton } from './ShareImageButton';

type CopiedState = {
  sig: string;
  url: string;
  text: string;
  ok: boolean;
} | null;

export function ShareActions({ result }: { result: TaxResult }) {
  const [variant, setVariant] = useState<ShareVariant>('brag');
  const [copiedState, setCopied] = useState<CopiedState>(null);

  // 結果が変わったら、古いリンクのコピー済み表示は下げる
  // (どの入力に対するコピーだったかを sig で照合する)
  const sig = JSON.stringify(result.input);
  const copied = copiedState && copiedState.sig === sig ? copiedState : null;

  async function handleLinkShare() {
    const url = buildShareUrl(result);
    const text = shareMessage(result, variant);
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    // モバイル等:共有シートから直接X・LINEなどへ
    if (nav.canShare?.({ url, text })) {
      nav.share({ url, text }).catch(() => {
        // ユーザーのキャンセルは何もしない
      });
      return;
    }
    // PC等:コピーして、そのままポストできる導線を出す
    try {
      await navigator.clipboard.writeText(url);
      setCopied({ sig, url, text, ok: true });
    } catch {
      setCopied({ sig, url, text, ok: false });
    }
  }

  return (
    <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-center">
      <p className="text-sm font-bold text-emerald-900">
        この結果、シェアできます
      </p>

      {/* 画像のタイプを選ぶ(感情別3種) */}
      <div
        className="mt-3 flex justify-center gap-1.5 rounded-full bg-white/70 p-1"
        role="group"
        aria-label="シェア画像のタイプ"
      >
        {SHARE_VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setVariant(v.key)}
            aria-pressed={variant === v.key}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              variant === v.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-ink-500 hover:text-emerald-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-emerald-900/60">
        {SHARE_VARIANTS.find((v) => v.key === variant)?.hint}
      </p>

      {/* 選んだ画像のプレビュー(実際に共有される絵) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shareSvgDataUrl(result, variant)}
        alt={`シェア画像プレビュー(${variant})`}
        width={1080}
        height={1080}
        className="mx-auto mt-3 w-full max-w-[300px] rounded-xl border border-emerald-100 shadow-sm"
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <ShareImageButton result={result} variant={variant} />
        <button
          type="button"
          onClick={handleLinkShare}
          className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-600 bg-white px-6 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          🔗 リンクでシェア
        </button>
      </div>

      {copied && (
        <div className="mt-3 rounded-xl bg-white/70 p-3">
          <p role="status" className="text-xs font-bold text-emerald-800">
            {copied.ok
              ? 'リンクをコピーしました'
              : 'コピーできなかったので、下のリンクを直接コピーしてください'}
          </p>
          <p className="tabular mt-1.5 break-all rounded-lg bg-white px-2.5 py-1.5 text-left text-[11px] leading-relaxed text-ink-500">
            {copied.url}
          </p>
          <a
            href={xIntentUrl(copied.text, copied.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-block rounded-full bg-ink-900 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-ink-600"
          >
            そのままXでポストする
          </a>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-emerald-900/70">
        リンクを開くと、この結果がそのまま再現されます。
        <br className="hidden sm:block" />
        リンクには入力した数字(売上・経費など)が含まれます。サーバーには保存されません。
      </p>
    </div>
  );
}

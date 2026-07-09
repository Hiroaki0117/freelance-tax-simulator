'use client';

import { useEffect, useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import { buildShareUrl, shareMessage, xIntentUrl } from '@/lib/share';
import { buildShareSvg, type ShareVariant } from '@/lib/shareImage';

/** SVG文字列を PNG Blob にする(純SVG textなので canvas は汚染されない) */
function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg load failed'));
    };
    img.src = url;
  });
}

export function ShareImageButton({
  result,
  variant,
}: {
  result: TaxResult;
  variant: ShareVariant;
}) {
  // 選択中のバリアント + 結果が変われば画像を作り直す
  const sig = [
    variant,
    result.input.revenue,
    result.input.expenses,
    result.takeHome,
    result.burdenTotal,
    result.taxTotal,
    result.socialInsuranceTotal,
    result.monthlyTaxReserve,
  ].join('|');
  const [ready, setReady] = useState<{ sig: string; file: File } | null>(null);

  // 結果が変わったら共有用の画像を先に用意しておく。
  // (クリック時は同期的に share するため。await 後だと share/ポップアップが弾かれる)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const blob = await svgToPng(buildShareSvg(result, variant));
        if (!cancelled) {
          const file = new File([blob], `tedori-${variant}.png`, {
            type: 'image/png',
          });
          setReady({ sig, file });
        }
      } catch {
        // 生成に失敗しても致命的ではない(ボタンは準備中のまま)
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // sig は buildShareSvg が使う値をすべて含むので deps は sig のみで十分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const file = ready && ready.sig === sig ? ready.file : null;

  function handle() {
    if (!file) return;
    const text = shareMessage(result, variant);
    // 画像といっしょに、この結果を再現できるリンクも渡す(開いた人の追体験導線)
    const shareUrl = buildShareUrl(result);
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    // モバイル等:画像つきネイティブ共有(Xアプリなどに直接)
    if (nav.canShare?.({ files: [file] })) {
      nav
        .share({ files: [file], text: `${text}\n${shareUrl}` })
        .catch(() => {});
      return;
    }
    // PC等:PNGをダウンロード → X投稿画面を開いて添付してもらう
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tedori-${variant}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.open(xIntentUrl(text, shareUrl), '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={!file}
      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_6px_14px_rgba(5,150,105,0.28)] transition-colors hover:bg-emerald-700 disabled:opacity-60"
    >
      {file ? '📸 画像でシェア' : '画像を準備中…'}
    </button>
  );
}

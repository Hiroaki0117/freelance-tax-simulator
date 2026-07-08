'use client';

import { useEffect, useState } from 'react';
import type { TaxResult } from '@/lib/tax/types';
import { TAX_YEAR } from '@/lib/tax/constants';

const SHARE_URL = 'https://freelance-tedori.com';
const HANDLE = '@freelance_hiro';

const C = {
  bg: '#faf5ec',
  card: '#ffffff',
  ink900: '#3e3a33',
  ink500: '#8a8377',
  ink400: '#a79e8c',
  emerald: '#059669',
  emerald700: '#047857',
  expense: '#e0d6bf',
  tax: '#fbbf24',
  insurance: '#0ea5e9', // 画面の内訳バーと同じ(税金のamberと色覚でも区別できる青系)
  takeHome: '#059669',
};

const FONT =
  "system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif";

function man(v: number): string {
  return Math.round(v / 10000).toLocaleString('ja-JP');
}

/** 結果を 1080×1080 のシェア用カード(SVG文字列)にする */
function buildSvg(r: TaxResult): string {
  const rev = man(r.input.revenue);
  const rate = Math.round((r.burdenTotal / r.input.revenue) * 100);
  const takeRate = Math.round((r.takeHome / r.input.revenue) * 100);

  const segs = [
    { label: '経費', value: r.input.expenses, color: C.expense },
    { label: '税金', value: r.taxTotal, color: C.tax },
    { label: '保険', value: r.socialInsuranceTotal, color: C.insurance },
    { label: '手取り', value: r.takeHome, color: C.takeHome },
  ];
  const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const barX = 108;
  const barW = 864;
  const barY = 690;
  const barH = 60;
  let cx = barX;
  const bars = segs
    .map((s) => {
      const w = (Math.max(0, s.value) / total) * barW;
      const rect = `<rect x="${cx.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" fill="${s.color}"/>`;
      cx += w;
      return rect;
    })
    .join('');

  const legend = segs
    .map((s, i) => {
      const x = barX + i * 216;
      return `
        <rect x="${x}" y="800" width="22" height="22" rx="5" fill="${s.color}"/>
        <text x="${x + 34}" y="818" font-size="30" fill="${C.ink500}">${s.label}</text>
        <text x="${x}" y="866" font-size="44" font-weight="700" fill="${C.ink900}">${man(s.value)}万</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="${FONT}">
    <rect width="1080" height="1080" fill="${C.bg}"/>
    <rect x="48" y="48" width="984" height="984" rx="56" fill="${C.card}"/>
    <text x="108" y="158" font-size="34" font-weight="700" fill="${C.ink500}">フリーランスの手取りざっくりシミュレーター</text>

    <text x="108" y="300" font-size="44" font-weight="700" fill="${C.ink900}">手取り(年)</text>
    <text x="972" y="298" font-size="30" fill="${C.ink400}" text-anchor="end">令和7年(${TAX_YEAR}年)分</text>

    <text x="108" y="530">
      <tspan font-size="220" font-weight="800" fill="${C.emerald}">${man(r.takeHome)}</tspan><tspan font-size="84" font-weight="700" fill="${C.emerald}" dx="10">万円</tspan>
    </text>
    <text x="972" y="452" font-size="34" fill="${C.ink500}" text-anchor="end">手取り率</text>
    <text x="972" y="520" font-size="72" font-weight="800" fill="${C.emerald700}" text-anchor="end">${takeRate}%</text>

    <text x="108" y="628" font-size="38" fill="${C.ink500}">売上${rev}万円のうち、税・保険で ${man(r.burdenTotal)}万円(${rate}%)</text>

    <clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="18"/></clipPath>
    <g clip-path="url(#bar)">${bars}</g>
    ${legend}

    <text x="108" y="958" font-size="30" fill="${C.ink400}">freelance-tedori.com</text>
    <text x="972" y="958" font-size="34" font-weight="700" fill="${C.emerald700}" text-anchor="end">${HANDLE}</text>
  </svg>`;
}

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

const SHARE_MESSAGE = (r: TaxResult) =>
  `売上${man(r.input.revenue)}万のフリーランス、手取りは${man(r.takeHome)}万でした。\n` +
  `税金と保険で${man(r.burdenTotal)}万(売上の${Math.round((r.burdenTotal / r.input.revenue) * 100)}%)😇\n` +
  `あなたはいくら残る?👇`;

function xIntentUrl(r: TaxResult): string {
  return `https://x.com/intent/post?${new URLSearchParams({
    text: SHARE_MESSAGE(r),
    url: SHARE_URL,
    hashtags: 'フリーランス,確定申告',
  }).toString()}`;
}

export function ShareImageButton({ result }: { result: TaxResult }) {
  const sig = [
    result.input.revenue,
    result.input.expenses,
    result.takeHome,
    result.burdenTotal,
    result.taxTotal,
    result.socialInsuranceTotal,
  ].join('|');
  const [ready, setReady] = useState<{ sig: string; file: File } | null>(null);

  // 結果が変わったら共有用の画像を先に用意しておく。
  // (クリック時は同期的に share するため。await 後だと share/ポップアップが弾かれる)
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const blob = await svgToPng(buildSvg(result));
        if (!cancelled) {
          const file = new File([blob], 'tedori-result.png', {
            type: 'image/png',
          });
          setReady({ sig, file });
        }
      } catch {
        // 生成に失敗しても致命的ではない(ボタンは準備中のまま)
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // sig は buildSvg が使う値をすべて含むので deps は sig のみで十分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const file = ready && ready.sig === sig ? ready.file : null;

  function handle() {
    if (!file) return;
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    // モバイル等:画像つきネイティブ共有(Xアプリなどに直接)
    if (nav.canShare?.({ files: [file] })) {
      nav.share({ files: [file], text: SHARE_MESSAGE(result) }).catch(() => {});
      return;
    }
    // PC等:PNGをダウンロード → X投稿画面を開いて添付してもらう
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tedori-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.open(xIntentUrl(result), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-center">
      <p className="text-sm font-bold text-emerald-900">
        この結果、画像でシェアできます
      </p>
      <button
        type="button"
        onClick={handle}
        disabled={!file}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_6px_14px_rgba(5,150,105,0.28)] transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {file ? '📸 結果をシェアする' : '画像を準備中…'}
      </button>
    </div>
  );
}

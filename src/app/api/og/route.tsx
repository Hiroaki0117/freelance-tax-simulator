// 結果入りOGP画像の動的生成(1200×630)
//
// 共有URL(/s?r=…)と同じクエリを受け取り、計算結果を描いたPNGを返す。
// - opengraph-image.tsx ファイル規約は searchParams を受け取れないため Route Handler 方式
// - 日本語フォントは事前サブセット化した Noto Sans JP を同梱(fonts/README.md)
// - 税計算は画面と同じ calculateTax() を使う=シェア画像と開いた結果の数字がズレない

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { calculateTax } from '@/lib/tax/calculator';
import { TAX_YEAR } from '@/lib/tax/constants';
import { decodeShareParams } from '@/lib/tax/urlParams';
import { man, OG_TEXT } from '@/lib/og/text';

export const runtime = 'nodejs';

// 画面・シェア画像(ShareImageButton)と同じあたたかトーンのパレット
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
  insurance: '#0ea5e9',
  takeHome: '#059669',
};

const FONT_DIR = path.join(process.cwd(), 'src/app/api/og/fonts');
const FONT_WEIGHTS = [400, 700, 800] as const;

type OgFont = {
  name: string;
  data: Buffer;
  weight: (typeof FONT_WEIGHTS)[number];
  style: 'normal';
};

// フォントはプロセス内で1回だけ読む(サーバーレスのインスタンス単位でキャッシュ)
let fontsPromise: Promise<OgFont[]> | null = null;
function loadFonts(): Promise<OgFont[]> {
  fontsPromise ??= Promise.all(
    FONT_WEIGHTS.map(async (weight) => ({
      name: 'Noto Sans JP',
      data: await readFile(
        path.join(FONT_DIR, `NotoSansJP-${weight}-subset.ttf`)
      ),
      weight,
      style: 'normal' as const,
    }))
  );
  return fontsPromise;
}

export async function GET(req: NextRequest) {
  const input = decodeShareParams(req.nextUrl.searchParams);
  if (!input) {
    return new Response('missing or invalid share params', { status: 400 });
  }

  const r = calculateTax(input);
  const takeRate = Math.round((r.takeHome / input.revenue) * 100);
  const burdenRate = Math.round((r.burdenTotal / input.revenue) * 100);

  const segs = [
    { label: OG_TEXT.legend[0], value: input.expenses, color: C.expense },
    { label: OG_TEXT.legend[1], value: r.taxTotal, color: C.tax },
    { label: OG_TEXT.legend[2], value: r.socialInsuranceTotal, color: C.insurance },
    { label: OG_TEXT.legend[3], value: r.takeHome, color: C.takeHome },
  ];
  const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: C.bg,
          padding: 24,
          fontFamily: 'Noto Sans JP',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: C.card,
            borderRadius: 36,
            padding: '44px 56px 40px',
          }}
        >
          {/* ヘッダー: ツール名 / 年度 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 27, fontWeight: 700, color: C.ink500 }}>
              {OG_TEXT.siteTitle}
            </span>
            <span style={{ fontSize: 22, color: C.ink400 }}>
              {OG_TEXT.yearBadge(TAX_YEAR)}
            </span>
          </div>

          {/* 主役: 手取り(年)と手取り率 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: C.ink900 }}>
                {OG_TEXT.takeHomeLabel}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 148,
                    fontWeight: 800,
                    color: C.emerald,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {man(r.takeHome)}
                </span>
                <span
                  style={{
                    fontSize: 46,
                    fontWeight: 700,
                    color: C.emerald,
                    lineHeight: 1.25,
                    marginLeft: 8,
                  }}
                >
                  {OG_TEXT.man}
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <span style={{ fontSize: 24, color: C.ink500 }}>
                {OG_TEXT.rateLabel}
              </span>
              <span
                style={{
                  fontSize: 66,
                  fontWeight: 800,
                  color: C.emerald700,
                  lineHeight: 1.1,
                }}
              >
                {takeRate}%
              </span>
            </div>
          </div>

          {/* サブ行: 売上のうち税・保険でいくら */}
          <span style={{ fontSize: 27, color: C.ink500 }}>
            {OG_TEXT.subLine(man(input.revenue), man(r.burdenTotal), burdenRate)}
          </span>

          {/* 内訳バー + 凡例 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: 42,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {segs.map((s) => (
                <div
                  key={s.label}
                  style={{
                    width: `${(Math.max(0, s.value) / total) * 100}%`,
                    height: '100%',
                    backgroundColor: s.color,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', marginTop: 18 }}>
              {segs.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 272,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        backgroundColor: s.color,
                        marginRight: 10,
                      }}
                    />
                    <span style={{ fontSize: 21, color: C.ink500 }}>
                      {s.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      color: C.ink900,
                      marginTop: 2,
                    }}
                  >
                    {man(s.value)}万
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* フッター: ドメイン / ハンドル */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 22, color: C.ink400 }}>
              {OG_TEXT.domain}
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, color: C.emerald700 }}>
              {OG_TEXT.handle}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await loadFonts(),
      headers: {
        // 同じクエリなら同じ画像。CDNに1日キャッシュさせ、デザイン更新も翌日には反映
        'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}

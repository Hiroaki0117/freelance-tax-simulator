// 動的OGP画像(/api/og)用の日本語フォント読み込み。
//
// next/og の ImageResponse(Satori)はシステムフォントに依存できず、TTF/OTF/WOFFの
// フォントデータを明示的に渡す必要がある(WOFF2は非対応)。OGPカードに出す文字は
// 固定テンプレート+数字/記号のみなので、Google Fonts の CSS2 API に text= で
// 使用文字だけを渡し、自動サブセットされた小さいWOFFを1つだけ取得する。
// 参照: docs/research/2026-07-09-dynamic-ogp-url-share-research.md

/** OGPカードで実際に使う文字(固定文言 + 数字/記号)。増やす場合はここに追記する */
export const OG_FONT_TEXT =
  'フリーランスの手取りざっくりシミュレーター令和年分手取り率売上のうち税・保険で万円' +
  '自慢共感備え取られた来る山でした0123456789,.%()@freelance-tedori.com_hiro';

// woff2 だと Satori が読めないため、CSS2 API に古めの UA を送って woff を引き出す
const LEGACY_UA =
  'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.115 Safari/537.36';

let cachedFont: Promise<ArrayBuffer> | null = null;

async function fetchNotoSansJpBold(): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(OG_FONT_TEXT)}`;
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': LEGACY_UA },
  });
  if (!cssRes.ok) {
    throw new Error(`google fonts css fetch failed: ${cssRes.status}`);
  }
  const css = await cssRes.text();
  const match = css.match(/src: url\(([^)]+)\) format\('(woff2?)'\)/);
  if (!match) throw new Error('google fonts css: font url not found');
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`google fonts file fetch failed: ${fontRes.status}`);
  }
  return fontRes.arrayBuffer();
}

/** Bold の Noto Sans JP(必要な文字だけのサブセット)を取得する。プロセス内でキャッシュする */
export function getOgFont(): Promise<ArrayBuffer> {
  if (!cachedFont) {
    cachedFont = fetchNotoSansJpBold().catch((err) => {
      cachedFont = null; // 失敗時は次回また取り直す
      throw err;
    });
  }
  return cachedFont;
}

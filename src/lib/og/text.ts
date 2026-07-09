// 動的OGP画像(/api/og)に描く文言と、その文字集合(フォントサブセットの元)
//
// ⚠️ このファイルの文言・文字を変えたら、フォントの再生成が必要:
//   src/app/api/og/fonts/README.md の手順で charset.txt とサブセットTTFを作り直すこと。
//   (同梱フォントに無い文字は豆腐になる。text.test.ts が charset.txt との一致を見張る)

/** 万円表記(結果画面・シェア画像と同じ丸め) */
export function man(yen: number): string {
  return Math.round(yen / 10000).toLocaleString('ja-JP');
}

export const OG_TEXT = {
  siteTitle: 'フリーランスの手取りざっくりシミュレーター',
  yearBadge: (taxYear: number) => `令和7年(${taxYear}年)分`,
  takeHomeLabel: '手取り(年)',
  man: '万円',
  rateLabel: '手取り率',
  subLine: (revenueMan: string, burdenMan: string, ratePercent: number) =>
    `売上${revenueMan}万円のうち、税・保険で${burdenMan}万円(${ratePercent}%)`,
  legend: ['経費', '税金', '保険', '手取り'] as const,
  domain: 'freelance-tedori.com',
  handle: '@freelance_hiro',
};

/**
 * OGP画像に登場しうる文字の全集合。
 * 固定文言+数字まわりの記号(カンマ・%・負号など)から機械的に組み立てる。
 * この文字列そのままが fonts/charset.txt になり、pyftsubset の入力になる。
 */
export const OG_CHARSET = [
  ...new Set(
    [
      OG_TEXT.siteTitle,
      OG_TEXT.yearBadge(2025),
      OG_TEXT.takeHomeLabel,
      OG_TEXT.man,
      OG_TEXT.rateLabel,
      OG_TEXT.subLine('1,234', '5,678', 90),
      ...OG_TEXT.legend,
      OG_TEXT.domain,
      OG_TEXT.handle,
      // 数字と、金額表示に出うる記号(負の手取りの「-」を含む)
      '0123456789,.()%+- ',
    ].join('')
  ),
]
  .sort()
  .join('');

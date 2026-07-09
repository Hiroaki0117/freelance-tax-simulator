import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { man, OG_CHARSET, OG_TEXT } from './text';

/** 文字列 text の全文字が OG_CHARSET に含まれるか(足りない文字を返す) */
function missingChars(text: string): string[] {
  return [...new Set(text)].filter((ch) => !OG_CHARSET.includes(ch));
}

describe('OG_CHARSET(フォントサブセットの文字集合)', () => {
  it('固定文言とテンプレートの出力を全部カバーしている', () => {
    const samples = [
      OG_TEXT.siteTitle,
      OG_TEXT.yearBadge(2025),
      OG_TEXT.yearBadge(2026),
      OG_TEXT.takeHomeLabel,
      OG_TEXT.man,
      OG_TEXT.rateLabel,
      // 桁・負数・カンマ入りなど数字まわりの揺れ
      OG_TEXT.subLine(man(123_456_789), man(98_765_432), 100),
      OG_TEXT.subLine(man(600_0000), man(-1_340_000), -5),
      ...OG_TEXT.legend,
      OG_TEXT.domain,
      OG_TEXT.handle,
    ];
    for (const text of samples) {
      expect(missingChars(text), `不足文字 in "${text}"`).toEqual([]);
    }
  });

  it('同梱フォントの生成元 charset.txt と一致している(ズレたら再生成が必要)', () => {
    // 文言を変えたのにフォントを作り直していないと、ここで落ちる。
    // 再生成手順: src/app/api/og/fonts/README.md
    const committed = readFileSync(
      join(__dirname, '../../app/api/og/fonts/charset.txt'),
      'utf8'
    );
    expect(committed).toBe(OG_CHARSET);
  });
});

describe('man(万円表記)', () => {
  it('結果画面と同じ丸め(四捨五入・カンマ区切り)', () => {
    expect(man(3_463_100)).toBe('346');
    expect(man(12_345_678)).toBe('1,235');
    // Math.round は -50.5 を -50 に丸める(正の無限大方向)
    expect(man(-505_000)).toBe('-50');
    expect(man(-510_000)).toBe('-51');
  });
});

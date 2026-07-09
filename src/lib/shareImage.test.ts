import { describe, expect, it } from 'vitest';
import { calculateTax } from './tax/calculator';
import { DEFAULT_INPUT } from './tax/defaults';
import { buildPaymentSchedule } from './tax/calendar';
import { buildShareSvg, SHARE_VARIANTS, shareSvgDataUrl } from './shareImage';

const r = calculateTax({ ...DEFAULT_INPUT });
const man = (v: number) => Math.round(v / 10000).toLocaleString('ja-JP');

describe('SHARE_VARIANTS', () => {
  it('自慢・共感・備えの3種', () => {
    expect(SHARE_VARIANTS.map((v) => v.key)).toEqual([
      'brag',
      'empathy',
      'prepare',
    ]);
  });
});

describe('buildShareSvg', () => {
  it('すべて 1080×1080 の妥当なSVGで、ハンドルとドメインを含む', () => {
    for (const v of SHARE_VARIANTS) {
      const svg = buildShareSvg(r, v.key);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('width="1080"');
      expect(svg).toContain('@freelance_hiro');
      expect(svg).toContain('freelance-tedori.com');
    }
  });

  it('自慢型は手取り額が主役', () => {
    const svg = buildShareSvg(r, 'brag');
    expect(svg).toContain('手取り(年)');
    expect(svg).toContain(`>${man(r.takeHome)}<`);
  });

  it('共感型は負担額が主役', () => {
    const svg = buildShareSvg(r, 'empathy');
    expect(svg).toContain('持っていかれた');
    expect(svg).toContain(`>${man(r.burdenTotal)}<`);
  });

  it('備え型はカレンダーの山(ピーク月の額)が主役', () => {
    const svg = buildShareSvg(r, 'prepare');
    const peak = buildPaymentSchedule(r).peak;
    expect(svg).toContain('万円の山');
    expect(svg).toContain(`>${man(peak.total)}<`);
    expect(svg).toContain(peak.label);
  });
});

describe('shareSvgDataUrl', () => {
  it('img src に差せる data URL を返す', () => {
    const url = shareSvgDataUrl(r, 'brag');
    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });
});

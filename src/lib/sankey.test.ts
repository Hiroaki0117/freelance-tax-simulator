import { describe, expect, it } from 'vitest';
import { calculateTax } from './tax/calculator';
import { DEFAULT_INPUT } from './tax/defaults';
import {
  buildSankeyFromResult,
  buildSankeyLayout,
  sankeySegments,
  type SankeySegment,
} from './sankey';

const seg = (key: SankeySegment['key'], value: number): SankeySegment => ({
  key,
  label: key,
  value,
  color: '#000',
});

describe('sankeySegments', () => {
  it('売上を 経費/税金/保険・年金/手取り の4区分に分け、合計は売上に一致する', () => {
    const r = calculateTax({ ...DEFAULT_INPUT });
    const segs = sankeySegments(r);
    expect(segs.map((s) => s.key)).toEqual([
      'expense',
      'tax',
      'insurance',
      'takeHome',
    ]);
    const sum = segs.reduce((a, s) => a + s.value, 0);
    // 経費 + 税 + 保険 + 手取り = 売上(手取りの定義そのもの)
    expect(sum).toBeCloseTo(r.input.revenue, 0);
  });
});

describe('buildSankeyLayout', () => {
  it('帯の太さは値に比例し、区分の順序は保たれる', () => {
    const layout = buildSankeyLayout([
      seg('expense', 100),
      seg('tax', 200),
      seg('insurance', 100),
      seg('takeHome', 600),
    ]);
    expect(layout).not.toBeNull();
    const l = layout!;
    expect(l.total).toBe(1000);
    expect(l.flows.map((f) => f.key)).toEqual([
      'expense',
      'tax',
      'insurance',
      'takeHome',
    ]);
    // 手取り(600)は税(200)の3倍の太さ
    const tax = l.flows.find((f) => f.key === 'tax')!;
    const take = l.flows.find((f) => f.key === 'takeHome')!;
    expect(take.thickness).toBeCloseTo(tax.thickness * 3, 1);
  });

  it('割合(pct)は合計に対する比で、合計すると1になる', () => {
    const l = buildSankeyLayout([
      seg('expense', 100),
      seg('tax', 200),
      seg('insurance', 100),
      seg('takeHome', 600),
    ])!;
    const take = l.targets.find((t) => t.key === 'takeHome')!;
    expect(take.pct).toBeCloseTo(0.6, 5);
    const pctSum = l.targets.reduce((a, t) => a + t.pct, 0);
    expect(pctSum).toBeCloseTo(1, 5);
  });

  it('到達ノードは上端から下端まで詰まって並ぶ(全高を使う)', () => {
    const height = 300;
    const padY = 6;
    const l = buildSankeyLayout(
      [seg('expense', 100), seg('tax', 200), seg('insurance', 100), seg('takeHome', 600)],
      { height, padY }
    )!;
    const first = l.targets[0];
    const last = l.targets[l.targets.length - 1];
    expect(first.y).toBeCloseTo(padY, 1);
    expect(last.y + last.h).toBeCloseTo(height - padY, 1);
  });

  it('値が0以下の区分(手取りマイナス等)は積み上げバーと同様に除外する', () => {
    const l = buildSankeyLayout([
      seg('expense', 400),
      seg('tax', 300),
      seg('insurance', 300),
      seg('takeHome', -50),
    ])!;
    expect(l.targets.map((t) => t.key)).toEqual(['expense', 'tax', 'insurance']);
    expect(l.total).toBe(1000);
  });

  it('合計が0以下なら null(売上ゼロなど)', () => {
    expect(
      buildSankeyLayout([
        seg('expense', 0),
        seg('tax', 0),
        seg('insurance', 0),
        seg('takeHome', 0),
      ])
    ).toBeNull();
  });

  it('隣り合うラベルは最低間隔ぶん離れる(細い区分でも文字が重ならない)', () => {
    // 手取りが極端に大きく、税がごく細いケース
    const l = buildSankeyLayout(
      [seg('expense', 10), seg('tax', 5), seg('insurance', 5), seg('takeHome', 980)],
      { labelMinSpacing: 34 }
    )!;
    for (let i = 1; i < l.targets.length; i++) {
      const gap = l.targets[i].labelCy - l.targets[i - 1].labelCy;
      expect(gap).toBeGreaterThanOrEqual(34 - 0.01);
    }
  });

  it('buildSankeyFromResult は TaxResult から同じ配置を作れる', () => {
    const r = calculateTax({ ...DEFAULT_INPUT });
    const l = buildSankeyFromResult(r);
    expect(l).not.toBeNull();
    expect(l!.targets).toHaveLength(4);
    expect(l!.flows.every((f) => f.d.startsWith('M'))).toBe(true);
  });
});

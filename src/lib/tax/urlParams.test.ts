import { describe, it, expect } from 'vitest';
import { DEFAULT_INPUT } from './defaults';
import {
  applyShareParams,
  buildShareParams,
  hasShareParams,
  parseShareParams,
} from './urlParams';
import type { TaxInput } from './types';

describe('buildShareParams / parseShareParams(共有URLの往復)', () => {
  it('主要項目を積んで往復できる', () => {
    const input: TaxInput = {
      ...DEFAULT_INPUT,
      revenue: 8_000_000,
      expenses: 2_000_000,
      filingType: 'blue55',
      consumptionTax: 'general',
      furusatoDonation: 50_000,
      idecoMonthly: 23_000,
    };
    const params = buildShareParams(input);
    const restored = applyShareParams(parseShareParams(params));

    expect(restored.revenue).toBe(8_000_000);
    expect(restored.expenses).toBe(2_000_000);
    expect(restored.filingType).toBe('blue55');
    expect(restored.consumptionTax).toBe('general');
    expect(restored.furusatoDonation).toBe(50_000);
    expect(restored.idecoMonthly).toBe(23_000);
  });

  it('デフォルトと同じ値の任意項目は省略してURLを短くする', () => {
    const input: TaxInput = { ...DEFAULT_INPUT, revenue: 6_000_000 };
    const params = buildShareParams(input);
    expect(params.has('c')).toBe(false); // デフォルトの consumptionTax
    expect(params.has('fn')).toBe(false); // 0円は省略
    expect(params.has('id')).toBe(false); // 0円は省略
  });

  it('扶養・配偶者・保険などの家族構成寄りの項目はURLに載せない', () => {
    const input: TaxInput = {
      ...DEFAULT_INPUT,
      hasSpouse: true,
      dependents: 2,
      insurance: 'voluntary',
      healthInsuranceManual: 300_000,
      age40OrOver: true,
    };
    const params = buildShareParams(input);
    expect(params.has('hasSpouse')).toBe(false);
    expect(params.has('dependents')).toBe(false);
    expect(params.has('insurance')).toBe(false);
    expect(params.has('age40OrOver')).toBe(false);
  });

  it('不正なfilingTypeは無視してデフォルトのまま', () => {
    const params = new URLSearchParams('r=1000000&f=not-a-valid-type');
    const restored = applyShareParams(parseShareParams(params));
    expect(restored.filingType).toBe(DEFAULT_INPUT.filingType);
  });

  it('r/eのどちらかがあればhasShareParamsはtrue', () => {
    expect(hasShareParams(new URLSearchParams('r=100'))).toBe(true);
    expect(hasShareParams(new URLSearchParams('e=100'))).toBe(true);
    expect(hasShareParams(new URLSearchParams('f=blue65'))).toBe(false);
    expect(hasShareParams(new URLSearchParams(''))).toBe(false);
  });

  it('負の値や巨大な値は0〜上限にクランプする', () => {
    const params = new URLSearchParams('r=-500&e=99999999999999');
    const restored = applyShareParams(parseShareParams(params));
    expect(restored.revenue).toBe(0);
    expect(restored.expenses).toBe(10_000_000_000);
  });
});

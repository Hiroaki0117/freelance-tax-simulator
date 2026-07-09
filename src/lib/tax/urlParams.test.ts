import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT } from './defaults';
import type { TaxInput } from './types';
import { decodeShareParams, encodeShareParams } from './urlParams';

/** クエリ文字列を URLSearchParams にして decode に渡すヘルパー */
function decode(qs: string) {
  return decodeShareParams(new URLSearchParams(qs));
}

describe('encodeShareParams', () => {
  it('デフォルトと同じ項目は省略される(売上・経費は常に載る)', () => {
    const qs = encodeShareParams({ ...DEFAULT_INPUT });
    expect(qs).toBe('r=6000000&e=1200000');
  });

  it('デフォルトから変えた項目だけが追加される', () => {
    const input: TaxInput = {
      ...DEFAULT_INPUT,
      revenue: 8_000_000,
      expenses: 2_000_000,
      filingType: 'white',
      hasSpouse: true,
      dependents: 2,
      idecoMonthly: 23_000,
    };
    const params = new URLSearchParams(encodeShareParams(input));
    expect(params.get('r')).toBe('8000000');
    expect(params.get('e')).toBe('2000000');
    expect(params.get('f')).toBe('white');
    expect(params.get('sp')).toBe('1');
    expect(params.get('dep')).toBe('2');
    expect(params.get('ide')).toBe('23000');
    // デフォルトのままの項目は載らない
    expect(params.get('c')).toBeNull();
    expect(params.get('i')).toBeNull();
    expect(params.get('bt')).toBeNull();
  });

  it('健康保険の手入力額は任意継続/その他のときだけ載る', () => {
    const base: TaxInput = { ...DEFAULT_INPUT, healthInsuranceManual: 480_000 };
    // 国保のままなら hi は意味を持たないので載せない
    expect(new URLSearchParams(encodeShareParams(base)).get('hi')).toBeNull();
    const voluntary: TaxInput = { ...base, insurance: 'voluntary' };
    const params = new URLSearchParams(encodeShareParams(voluntary));
    expect(params.get('i')).toBe('voluntary');
    expect(params.get('hi')).toBe('480000');
  });
});

describe('decodeShareParams', () => {
  it('encode → decode の往復で入力が完全に再現される', () => {
    const input: TaxInput = {
      revenue: 7_500_000,
      expenses: 1_800_000,
      filingType: 'blue10',
      hasSpouse: true,
      dependents: 3,
      consumptionTax: 'simplified',
      insurance: 'voluntary',
      healthInsuranceManual: 420_000,
      businessTaxApplicable: false,
      age40OrOver: true,
      furusatoDonation: 60_000,
      idecoMonthly: 68_000,
    };
    expect(decode(encodeShareParams(input))).toEqual(input);
  });

  it('売上が無い・0・不正なURLは共有として不成立(null)', () => {
    expect(decode('')).toBeNull();
    expect(decode('e=1000000')).toBeNull();
    expect(decode('r=0')).toBeNull();
    expect(decode('r=-100')).toBeNull();
    expect(decode('r=abc')).toBeNull();
  });

  it('壊れた値は例外を出さずデフォルトへフォールバックする', () => {
    const input = decode('r=6000000&e=xyz&f=gold99&c=???&i=none&dep=-5&sp=2');
    expect(input).not.toBeNull();
    expect(input!.revenue).toBe(6_000_000);
    expect(input!.expenses).toBe(DEFAULT_INPUT.expenses);
    expect(input!.filingType).toBe(DEFAULT_INPUT.filingType);
    expect(input!.consumptionTax).toBe(DEFAULT_INPUT.consumptionTax);
    expect(input!.insurance).toBe(DEFAULT_INPUT.insurance);
    expect(input!.dependents).toBe(0);
    expect(input!.hasSpouse).toBe(DEFAULT_INPUT.hasSpouse);
  });

  it('桁外れの金額はクランプされ、小数は切り捨てられる', () => {
    const input = decode('r=99999999999999&e=1234567.89&dep=999');
    expect(input!.revenue).toBe(9_999_999_999);
    expect(input!.expenses).toBe(1_234_567);
    expect(input!.dependents).toBe(20);
  });

  it('国保なのに hi が付いたURLでは手入力額を無視する(改変リンク対策)', () => {
    const input = decode('r=6000000&hi=99999999');
    expect(input!.healthInsuranceManual).toBe(
      DEFAULT_INPUT.healthInsuranceManual
    );
  });

  it('Next.js の searchParams 形式(プレーンオブジェクト)も読める', () => {
    const input = decodeShareParams({
      r: '6000000',
      e: ['1500000', '9999'],
      f: undefined,
    });
    expect(input!.revenue).toBe(6_000_000);
    expect(input!.expenses).toBe(1_500_000); // 配列は先頭を採用
    expect(input!.filingType).toBe(DEFAULT_INPUT.filingType);
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculateTax,
  calculateIncomeTaxBase,
  calculateConsumptionTax,
  calculateHealthInsurance,
} from './calculator';
import type { TaxInput } from './types';

const base: TaxInput = {
  revenue: 6_000_000,
  expenses: 1_000_000,
  filingType: 'blue65',
  hasSpouse: false,
  dependents: 0,
  consumptionTax: 'exempt',
  insurance: 'kokuho',
  age40OrOver: false,
};

describe('calculateIncomeTaxBase(所得税の速算)', () => {
  it('195万円以下は5%、控除0', () => {
    const r = calculateIncomeTaxBase(1_000_000);
    expect(r.rate).toBe(0.05);
    expect(r.amount).toBe(50_000);
  });

  it('195万円超〜330万円以下は10%・控除97,500円', () => {
    const r = calculateIncomeTaxBase(3_000_000);
    expect(r.rate).toBe(0.1);
    expect(r.amount).toBe(202_500); // 3,000,000*0.1 - 97,500
  });

  it('課税所得0なら税額0', () => {
    expect(calculateIncomeTaxBase(0).amount).toBe(0);
  });

  it('100円未満は切り捨て', () => {
    const r = calculateIncomeTaxBase(1_234_567);
    expect(r.amount).toBe(Math.floor((1_234_567 * 0.05) / 100) * 100);
  });
});

describe('calculateConsumptionTax(消費税の概算)', () => {
  it('免税は0円', () => {
    expect(calculateConsumptionTax('exempt', 6_000_000, 1_000_000)).toBe(0);
  });

  it('2割特例(売上600万・税込)', () => {
    expect(calculateConsumptionTax('special2wari', 6_000_000, 0)).toBe(108_900);
  });

  it('簡易課税(サービス業50%・売上600万)', () => {
    expect(calculateConsumptionTax('simplified', 6_000_000, 0)).toBe(272_600);
  });

  it('本則課税(売上600万・経費100万)', () => {
    expect(calculateConsumptionTax('general', 6_000_000, 1_000_000)).toBe(
      454_400
    );
  });
});

describe('calculateHealthInsurance(国保の概算)', () => {
  it('上限(賦課限度額)でキャップされる', () => {
    const r = calculateHealthInsurance(20_000_000, 1, false);
    expect(r).toBe(890_000);
  });

  it('40歳以上は介護分が上乗せされる', () => {
    const under = calculateHealthInsurance(4_000_000, 1, false);
    const over = calculateHealthInsurance(4_000_000, 1, true);
    expect(over).toBeGreaterThan(under);
  });
});

describe('calculateTax(総合・売上600万/経費100万/青色65万/国保/40歳未満)', () => {
  const r = calculateTax(base);

  it('事業所得 = 売上 - 経費 - 青色控除', () => {
    expect(r.profit).toBe(5_000_000);
    expect(r.blueDeductionApplied).toBe(650_000);
    expect(r.businessIncome).toBe(4_350_000);
  });

  it('社会保険(国民年金 + 国保)', () => {
    expect(r.nationalPension).toBe(203_760);
    expect(r.healthInsurance).toBe(438_080);
    expect(r.socialInsuranceTotal).toBe(641_840);
  });

  it('所得税(復興特別所得税込)', () => {
    expect(r.taxableIncomeForIncomeTax).toBe(3_228_000);
    expect(r.incomeTaxBase).toBe(225_300);
    expect(r.recoveryTax).toBe(4_700);
    expect(r.incomeTax).toBe(230_000);
    expect(r.incomeTaxRate).toBe(0.1);
  });

  it('住民税', () => {
    expect(r.taxableIncomeForResidentTax).toBe(3_278_000);
    expect(r.residentTax).toBe(332_800);
  });

  it('個人事業税(290万円の事業主控除後 × 5%)', () => {
    expect(r.businessTax).toBe(105_000);
  });

  it('消費税は免税で0', () => {
    expect(r.consumptionTax).toBe(0);
  });

  it('集計(税合計・負担合計・手取り・実効税率・毎月積立)', () => {
    expect(r.taxTotal).toBe(667_800);
    expect(r.burdenTotal).toBe(1_309_640);
    expect(r.takeHome).toBe(3_690_360);
    expect(r.effectiveRateOnRevenue).toBeCloseTo(0.2183, 4);
    expect(r.monthlyReserve).toBe(109_137);
  });
});

describe('calculateTax(低所得・扶養内・白色)', () => {
  const r = calculateTax({
    ...base,
    revenue: 1_000_000,
    expenses: 200_000,
    filingType: 'white',
    insurance: 'dependent',
  });

  it('扶養内は社会保険の自己負担なし', () => {
    expect(r.socialInsuranceTotal).toBe(0);
  });

  it('事業税は事業主控除以下なので0', () => {
    expect(r.businessTax).toBe(0);
  });

  it('手取りと毎月積立', () => {
    expect(r.incomeTax).toBe(16_300);
    expect(r.residentTax).toBe(42_000);
    expect(r.burdenTotal).toBe(58_300);
    expect(r.takeHome).toBe(741_700);
    expect(r.monthlyReserve).toBe(4_859);
  });
});

describe('calculateTax(赤字でも税額がマイナスにならない)', () => {
  const r = calculateTax({ ...base, revenue: 1_000_000, expenses: 1_500_000 });

  it('事業所得は0、各税は0以上', () => {
    expect(r.businessIncome).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.residentTax).toBe(0);
    expect(r.businessTax).toBe(0);
  });
});

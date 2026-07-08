import { describe, it, expect } from 'vitest';
import {
  calculateTax,
  calculateBasicDeductionIncomeTax,
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
  healthInsuranceManual: 0,
  businessTaxApplicable: true,
  age40OrOver: false,
  furusatoDonation: 0,
  idecoMonthly: 0,
};

describe('calculateIncomeTaxBase(所得税の速算)', () => {
  it('195万円以下は5%、速算控除0', () => {
    const r = calculateIncomeTaxBase(1_000_000);
    expect(r.rate).toBe(0.05);
    expect(r.deduction).toBe(0);
    expect(r.amount).toBe(50_000);
  });

  it('195万円超〜330万円以下は10%・速算控除97,500円', () => {
    const r = calculateIncomeTaxBase(3_000_000);
    expect(r.rate).toBe(0.1);
    expect(r.deduction).toBe(97_500);
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

describe('calculateBasicDeductionIncomeTax(令和7年分・所得別の基礎控除)', () => {
  it('132万円以下は95万円', () => {
    expect(calculateBasicDeductionIncomeTax(0)).toBe(950_000);
    expect(calculateBasicDeductionIncomeTax(1_320_000)).toBe(950_000);
  });

  it('132万円超〜336万円以下は88万円', () => {
    expect(calculateBasicDeductionIncomeTax(1_320_001)).toBe(880_000);
    expect(calculateBasicDeductionIncomeTax(3_360_000)).toBe(880_000);
  });

  it('336万円超〜489万円以下は68万円', () => {
    expect(calculateBasicDeductionIncomeTax(3_360_001)).toBe(680_000);
    expect(calculateBasicDeductionIncomeTax(4_890_000)).toBe(680_000);
  });

  it('489万円超〜655万円以下は63万円', () => {
    expect(calculateBasicDeductionIncomeTax(6_550_000)).toBe(630_000);
  });

  it('655万円超〜2,350万円以下は58万円(本則)', () => {
    expect(calculateBasicDeductionIncomeTax(10_000_000)).toBe(580_000);
  });

  it('2,350万円超は逓減し2,500万円超で消失', () => {
    expect(calculateBasicDeductionIncomeTax(24_000_000)).toBe(480_000);
    expect(calculateBasicDeductionIncomeTax(24_500_000)).toBe(320_000);
    expect(calculateBasicDeductionIncomeTax(25_000_000)).toBe(160_000);
    expect(calculateBasicDeductionIncomeTax(25_000_001)).toBe(0);
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
    expect(r).toBe(920_000); // 令和7年度: 医療66万 + 支援26万
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
    expect(r.nationalPension).toBe(210_120); // 令和7年度 月17,510円 × 12
    expect(r.healthInsurance).toBe(438_080);
    expect(r.socialInsuranceTotal).toBe(648_200);
  });

  it('所得税(復興特別所得税込・基礎控除は令和7年分の段階制)', () => {
    // 事業所得435万 → 基礎控除68万(336万超489万以下の区分)
    expect(r.incomeTaxDeductions.basic).toBe(680_000);
    expect(r.taxableIncomeForIncomeTax).toBe(3_021_000);
    expect(r.incomeTaxBase).toBe(204_600);
    expect(r.recoveryTax).toBe(4_200);
    expect(r.incomeTax).toBe(208_800);
    expect(r.incomeTaxRate).toBe(0.1);
  });

  it('住民税(基礎控除43万は据え置き)', () => {
    expect(r.residentTaxDeductions.basic).toBe(430_000);
    expect(r.taxableIncomeForResidentTax).toBe(3_271_000);
    expect(r.residentTax).toBe(332_100);
  });

  it('個人事業税(290万円の事業主控除後 × 5%)', () => {
    expect(r.businessTax).toBe(105_000);
  });

  it('消費税は免税で0', () => {
    expect(r.consumptionTax).toBe(0);
  });

  it('集計(税合計・負担合計・手取り・実効税率・毎月の3分解)', () => {
    expect(r.taxTotal).toBe(645_900);
    expect(r.burdenTotal).toBe(1_294_100);
    expect(r.takeHome).toBe(3_705_900);
    expect(r.effectiveRateOnRevenue).toBeCloseTo(0.2157, 4);
    // 毎月の3分解: ①固定費(社保/12) + ②税の月割り(税/12) + ③手取り(/12)
    expect(r.monthlyFixedCost).toBe(54_017); // 社会保険 648,200 / 12 切り上げ
    expect(r.monthlyTaxReserve).toBe(53_825); // 税 645,900 / 12
    expect(r.monthlyTakeHome).toBe(308_825); // 手取り 3,705,900 / 12
  });
});

describe('calculateTax(青色55万・複式簿記＋紙提出)', () => {
  const r = calculateTax({ ...base, filingType: 'blue55' });

  it('青色55万円控除が適用され、事業所得は65万との差(10万)だけ増える', () => {
    expect(r.profit).toBe(5_000_000);
    expect(r.blueDeductionApplied).toBe(550_000);
    expect(r.businessIncome).toBe(4_450_000); // 65万のとき 4,350,000 + 10万
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

  it('手取りと毎月の3分解(扶養内=固定費0)', () => {
    // 所得80万 → 基礎控除95万(132万以下の区分)で所得税は0に(令和7年分改正の効果)
    expect(r.incomeTax).toBe(0);
    expect(r.residentTax).toBe(42_000);
    expect(r.burdenTotal).toBe(42_000);
    expect(r.takeHome).toBe(758_000);
    expect(r.monthlyFixedCost).toBe(0); // 社会保険0(扶養内)
    expect(r.monthlyTaxReserve).toBe(3_500); // 税 42,000 / 12 切り上げ
    expect(r.monthlyTakeHome).toBe(63_166); // 手取り 758,000 / 12 切り捨て
  });
});

describe('calculateTax(健康保険の区分)', () => {
  it('任意継続は手入力の健保額を使い、国民年金は本人分を計上', () => {
    const r = calculateTax({
      ...base,
      insurance: 'voluntary',
      healthInsuranceManual: 360_000,
    });
    expect(r.healthInsurance).toBe(360_000);
    expect(r.nationalPension).toBe(210_120);
    expect(r.socialInsuranceTotal).toBe(570_120);
  });

  it('その他の健康保険も手入力額を反映', () => {
    const r = calculateTax({
      ...base,
      insurance: 'other',
      healthInsuranceManual: 240_000,
    });
    expect(r.healthInsurance).toBe(240_000);
    expect(r.nationalPension).toBe(210_120);
  });

  it('扶養内は健保・年金ともに0', () => {
    const r = calculateTax({ ...base, insurance: 'dependent' });
    expect(r.healthInsurance).toBe(0);
    expect(r.nationalPension).toBe(0);
  });
});

describe('calculateTax(ふるさと納税の上限・概算)', () => {
  it('基本ケースの上限目安', () => {
    // 住民税所得割327,100 × 20% ÷ (90% − 10%×1.021) + 2,000
    expect(calculateTax(base).furusatoNozeiLimit).toBe(83_000);
  });

  it('住民税の所得割が0なら上限も0', () => {
    const r = calculateTax({ ...base, revenue: 1_000_000, expenses: 1_500_000 });
    expect(r.breakdown.residentIncomeLevy).toBe(0);
    expect(r.furusatoNozeiLimit).toBe(0);
  });
});

describe('calculateTax(ふるさと納税の実額反映)', () => {
  it('寄附0なら furusato ブロックは無反応', () => {
    const r = calculateTax(base);
    expect(r.furusato.donation).toBe(0);
    expect(r.furusato.totalBenefit).toBe(0);
    expect(r.furusato.outOfPocket).toBe(0);
    expect(r.furusato.overLimit).toBe(false);
  });

  it('上限内の寄附は実質負担が2,000円(軽減 = 寄附 − 2,000)', () => {
    // 基本ケースの上限は 83,000 円
    const r = calculateTax({ ...base, furusatoDonation: 83_000 });
    expect(r.furusato.overLimit).toBe(false);
    expect(r.furusato.totalBenefit).toBe(81_000);
    expect(r.furusato.outOfPocket).toBe(2_000);
    // 所得税 + 住民税(基本 + 特例)の内訳が軽減合計と整合
    expect(
      r.furusato.incomeTaxReduction + r.furusato.residentReduction
    ).toBe(r.furusato.totalBenefit);
  });

  it('上限内の寄附は手取りが実質自己負担(2,000円)だけ減る', () => {
    const noDonation = calculateTax(base);
    const withDonation = calculateTax({ ...base, furusatoDonation: 83_000 });
    // 税・社会保険の合計はふるさと納税では変わらない(軽減は手取り側で反映)
    expect(withDonation.burdenTotal).toBe(noDonation.burdenTotal);
    // 手取りは自己負担分(2,000円)だけ減る
    expect(withDonation.furusato.outOfPocket).toBe(2_000);
    expect(withDonation.takeHome).toBe(noDonation.takeHome - 2_000);
    // 明細の恒等式:手取り = 売上 − 経費 − 負担合計 − 自己負担
    expect(withDonation.takeHome).toBe(
      withDonation.input.revenue -
        withDonation.input.expenses -
        withDonation.burdenTotal -
        withDonation.furusato.outOfPocket
    );
  });

  it('上限超過なら手取りは実質自己負担(2,000円超)だけ減る', () => {
    const noDonation = calculateTax(base);
    const withDonation = calculateTax({ ...base, furusatoDonation: 150_000 });
    expect(withDonation.furusato.overLimit).toBe(true);
    expect(withDonation.furusato.outOfPocket).toBeGreaterThan(2_000);
    expect(withDonation.takeHome).toBe(
      noDonation.takeHome - withDonation.furusato.outOfPocket
    );
  });

  it('寄附0なら手取りは変わらない', () => {
    const noDonation = calculateTax(base);
    const zeroDonation = calculateTax({ ...base, furusatoDonation: 0 });
    expect(zeroDonation.takeHome).toBe(noDonation.takeHome);
  });

  it('上限超過の寄附は特例控除が頭打ちで自己負担が増える', () => {
    const r = calculateTax({ ...base, furusatoDonation: 150_000 });
    expect(r.furusato.overLimit).toBe(true);
    expect(r.furusato.residentSpecial).toBe(r.furusato.residentSpecialCap);
    expect(r.furusato.outOfPocket).toBeGreaterThan(2_000);
  });

  it('住民税の所得割が0なら寄附しても軽減は出ない', () => {
    const r = calculateTax({
      ...base,
      revenue: 1_000_000,
      expenses: 1_500_000,
      furusatoDonation: 30_000,
    });
    expect(r.furusatoNozeiLimit).toBe(0);
    expect(r.furusato.totalBenefit).toBe(0);
  });
});

describe('calculateTax(内訳 breakdown)', () => {
  it('国保の内訳(所得割 + 均等割)が合計と整合', () => {
    const r = calculateTax(base);
    expect(r.breakdown.kokuho).not.toBeNull();
    const k = r.breakdown.kokuho!;
    expect(k.incomeLevy + k.perCapita).toBe(r.healthInsurance);
  });

  it('国保以外は kokuho 内訳が null', () => {
    const r = calculateTax({ ...base, insurance: 'dependent' });
    expect(r.breakdown.kokuho).toBeNull();
  });

  it('消費税の内訳(課税標準・売上税額・国税 + 地方)が整合', () => {
    const r = calculateTax({ ...base, consumptionTax: 'special2wari' });
    expect(r.breakdown.consumption).not.toBeNull();
    const c = r.breakdown.consumption!;
    expect(c.national + c.local).toBe(r.consumptionTax);
    // 課税標準額(税抜)は税込売上より小さく正の値
    expect(c.salesBase).toBeGreaterThan(0);
    expect(c.salesBase).toBeLessThan(r.input.revenue);
    // 2割特例は売上税額の20%を納付 → 納付国税は売上税額より小さい
    expect(c.salesNationalTax).toBeGreaterThan(c.national);
  });

  it('免税は消費税の内訳が null', () => {
    expect(calculateTax(base).breakdown.consumption).toBeNull();
  });
});

describe('calculateTax(個人事業税の対象/対象外)', () => {
  it('対象外なら事業所得が高くても事業税は0', () => {
    const r = calculateTax({ ...base, businessTaxApplicable: false });
    expect(r.businessTax).toBe(0);
  });

  it('対象なら従来どおり課税される', () => {
    const r = calculateTax({ ...base, businessTaxApplicable: true });
    expect(r.businessTax).toBe(105_000);
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

describe('calculateTax(iDeCo・小規模企業共済等掛金控除)', () => {
  const noIdeco = calculateTax(base);
  const withIdeco = calculateTax({ ...base, idecoMonthly: 23_000 });
  const annual = 23_000 * 12; // 276,000円

  it('掛金(年額)が所得税・住民税の両方の所得控除に全額入る', () => {
    expect(withIdeco.incomeTaxDeductions.ideco).toBe(annual);
    expect(withIdeco.residentTaxDeductions.ideco).toBe(annual);
    expect(withIdeco.incomeTaxDeductions.total).toBe(
      noIdeco.incomeTaxDeductions.total + annual
    );
    expect(withIdeco.residentTaxDeductions.total).toBe(
      noIdeco.residentTaxDeductions.total + annual
    );
  });

  it('課税所得が掛金分(1,000円未満切り捨て)だけ下がり、税額が減る', () => {
    expect(withIdeco.taxableIncomeForIncomeTax).toBe(
      noIdeco.taxableIncomeForIncomeTax - annual
    );
    expect(withIdeco.incomeTax).toBeLessThan(noIdeco.incomeTax);
    expect(withIdeco.residentTax).toBeLessThan(noIdeco.residentTax);
  });

  it('国民健康保険と国民年金には効かない(金額が変わらない)', () => {
    expect(withIdeco.healthInsurance).toBe(noIdeco.healthInsurance);
    expect(withIdeco.nationalPension).toBe(noIdeco.nationalPension);
  });

  it('個人事業税・消費税には効かない', () => {
    expect(withIdeco.businessTax).toBe(noIdeco.businessTax);
    expect(withIdeco.consumptionTax).toBe(noIdeco.consumptionTax);
  });

  it('税金が減るぶん手取りは増える', () => {
    expect(withIdeco.takeHome).toBeGreaterThan(noIdeco.takeHome);
    expect(withIdeco.takeHome - noIdeco.takeHome).toBe(
      noIdeco.taxTotal - withIdeco.taxTotal
    );
  });

  it('掛金は月68,000円(第1号の上限)でクランプされる', () => {
    const over = calculateTax({ ...base, idecoMonthly: 100_000 });
    const atMax = calculateTax({ ...base, idecoMonthly: 68_000 });
    expect(over.input.idecoMonthly).toBe(68_000);
    expect(over.incomeTaxDeductions.ideco).toBe(68_000 * 12);
    expect(over.takeHome).toBe(atMax.takeHome);
  });

  it('課税所得が減るのでふるさと納税の上限も下がる', () => {
    expect(withIdeco.furusatoNozeiLimit).toBeLessThan(
      noIdeco.furusatoNozeiLimit
    );
  });

  it('マイナス入力は0(未加入)として扱う', () => {
    const r = calculateTax({ ...base, idecoMonthly: -5_000 });
    expect(r.input.idecoMonthly).toBe(0);
    expect(r.takeHome).toBe(noIdeco.takeHome);
  });
});

// フリーランス/個人事業主向け 税金&手取り 概算ロジック
//
// 方針:v1 は「ざっくり当てる」。細かい特例より、まず全体像を即答することを優先する。
// すべて概算であり、正確な金額は確定申告・税理士で確認する前提(免責は UI 側にも明記)。

import {
  BASIC_DEDUCTION_INCOME_TAX,
  BASIC_DEDUCTION_RESIDENT_TAX,
  BLUE_DEDUCTION,
  BUSINESS_TAX_DEDUCTION,
  BUSINESS_TAX_RATE,
  CONSUMPTION_LOCAL_RATIO,
  CONSUMPTION_NATIONAL_RATE,
  DEPENDENT_DEDUCTION_INCOME_TAX,
  DEPENDENT_DEDUCTION_RESIDENT_TAX,
  INCOME_TAX_BRACKETS,
  KOKUHO,
  NATIONAL_PENSION_ANNUAL,
  RECOVERY_TAX_RATE,
  RESIDENT_TAX_INCOME_RATE,
  RESIDENT_TAX_PER_CAPITA,
  SIMPLIFIED_DEEMED_PURCHASE_RATE,
  SPECIAL_2WARI_DEDUCTION_RATE,
  SPOUSE_DEDUCTION_INCOME_TAX,
  SPOUSE_DEDUCTION_RESIDENT_TAX,
} from './constants';
import type {
  ConsumptionTaxMode,
  DeductionBreakdown,
  TaxInput,
  TaxResult,
} from './types';

/** 100円未満を切り捨てる(税額の端数処理) */
function floor100(value: number): number {
  return Math.floor(value / 100) * 100;
}

/** 1,000円未満を切り捨てる(課税所得・課税標準の端数処理) */
function floor1000(value: number): number {
  return Math.floor(value / 1000) * 1000;
}

/** 所得税(復興税前)と限界税率を求める */
export function calculateIncomeTaxBase(taxableIncome: number): {
  amount: number;
  rate: number;
} {
  const bracket =
    INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit) ??
    INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  const amount = Math.max(
    0,
    floor100(taxableIncome * bracket.rate - bracket.deduction)
  );
  return { amount, rate: bracket.rate };
}

/**
 * 国民健康保険(概算)
 * 賦課のベース = 事業所得 - 43万円。所得割 + 均等割(被保険者数分)を上限でキャップ。
 */
export function calculateHealthInsurance(
  businessIncome: number,
  insuredCount: number,
  age40OrOver: boolean
): number {
  const table = age40OrOver ? KOKUHO.over40 : KOKUHO.under40;
  const base = Math.max(0, businessIncome - KOKUHO.basicDeduction);
  const incomeLevy = Math.round(base * table.incomeLevyRate);
  const perCapita = table.perCapita * Math.max(1, insuredCount);
  return Math.min(table.cap, incomeLevy + perCapita);
}

/**
 * 消費税(概算)
 * 売上は税込(10%)を前提とする。
 */
export function calculateConsumptionTax(
  mode: ConsumptionTaxMode,
  revenue: number,
  expenses: number
): number {
  if (mode === 'exempt') return 0;

  // 課税標準額(売上の税抜・1,000円未満切り捨て)に対する国税分
  const salesTaxableStandard = floor1000((revenue * 100) / 110);
  const salesNationalTax = salesTaxableStandard * CONSUMPTION_NATIONAL_RATE;

  let national = 0;
  if (mode === 'special2wari') {
    // 2割特例:売上税額の80%を控除 → 残り20%を納付
    national = floor100(salesNationalTax * (1 - SPECIAL_2WARI_DEDUCTION_RATE));
  } else if (mode === 'simplified') {
    // 簡易課税:みなし仕入率(サービス業50%)で控除
    national = floor100(salesNationalTax * (1 - SIMPLIFIED_DEEMED_PURCHASE_RATE));
  } else {
    // 本則課税(概算):経費を全額課税仕入とみなして控除
    const purchaseTaxableStandard = floor1000((expenses * 100) / 110);
    const purchaseNationalTax =
      purchaseTaxableStandard * CONSUMPTION_NATIONAL_RATE;
    national = Math.max(0, floor100(salesNationalTax - purchaseNationalTax));
  }

  const local = floor100(national * CONSUMPTION_LOCAL_RATIO);
  return national + local;
}

/** メイン:入力から税・社会保険・手取りを概算する */
export function calculateTax(input: TaxInput): TaxResult {
  const revenue = Math.max(0, Math.round(input.revenue));
  const expenses = Math.max(0, Math.round(input.expenses));
  const dependents = Math.max(0, Math.floor(input.dependents));

  // --- 所得 ---
  const profit = revenue - expenses;
  const blueMax = BLUE_DEDUCTION[input.filingType];
  const blueDeductionApplied = Math.max(0, Math.min(blueMax, profit));
  const businessIncome = Math.max(0, profit - blueDeductionApplied);

  // --- 社会保険 ---
  // 国民年金は扶養内(第3号)以外は本人分を計上(配偶者・家族分は概算では含めない)
  const paysPension = input.insurance !== 'dependent';
  const nationalPension = paysPension ? NATIONAL_PENSION_ANNUAL : 0;

  // 健康保険:区分に応じて算出
  let healthInsurance = 0;
  if (input.insurance === 'kokuho') {
    // 国保の被保険者数は世帯(本人 + 配偶者 + 扶養人数)でカウント
    const insuredCount = 1 + (input.hasSpouse ? 1 : 0) + dependents;
    healthInsurance = calculateHealthInsurance(
      businessIncome,
      insuredCount,
      input.age40OrOver
    );
  } else if (input.insurance === 'voluntary' || input.insurance === 'other') {
    // 任意継続・その他は実額(年額)を手入力で反映
    healthInsurance = Math.max(0, Math.round(input.healthInsuranceManual || 0));
  }
  // dependent(扶養内)は健康保険の自己負担なし(0)

  const socialInsuranceTotal = nationalPension + healthInsurance;

  // --- 所得税 ---
  const incomeTaxDeductions: DeductionBreakdown = {
    basic: BASIC_DEDUCTION_INCOME_TAX,
    socialInsurance: socialInsuranceTotal,
    spouse: input.hasSpouse ? SPOUSE_DEDUCTION_INCOME_TAX : 0,
    dependents: dependents * DEPENDENT_DEDUCTION_INCOME_TAX,
    total: 0,
  };
  incomeTaxDeductions.total =
    incomeTaxDeductions.basic +
    incomeTaxDeductions.socialInsurance +
    incomeTaxDeductions.spouse +
    incomeTaxDeductions.dependents;

  const taxableIncomeForIncomeTax = floor1000(
    Math.max(0, businessIncome - incomeTaxDeductions.total)
  );
  const { amount: incomeTaxBase, rate: incomeTaxRate } =
    calculateIncomeTaxBase(taxableIncomeForIncomeTax);
  const recoveryTax = floor100(incomeTaxBase * RECOVERY_TAX_RATE);
  const incomeTax = incomeTaxBase + recoveryTax;

  // --- 住民税 ---
  const residentTaxDeductions: DeductionBreakdown = {
    basic: BASIC_DEDUCTION_RESIDENT_TAX,
    socialInsurance: socialInsuranceTotal,
    spouse: input.hasSpouse ? SPOUSE_DEDUCTION_RESIDENT_TAX : 0,
    dependents: dependents * DEPENDENT_DEDUCTION_RESIDENT_TAX,
    total: 0,
  };
  residentTaxDeductions.total =
    residentTaxDeductions.basic +
    residentTaxDeductions.socialInsurance +
    residentTaxDeductions.spouse +
    residentTaxDeductions.dependents;

  const taxableIncomeForResidentTax = floor1000(
    Math.max(0, businessIncome - residentTaxDeductions.total)
  );
  const residentIncomeLevy = floor100(
    taxableIncomeForResidentTax * RESIDENT_TAX_INCOME_RATE
  );
  // 課税所得が0なら均等割も発生しない簡易判定(非課税基準はざっくり)
  const residentTax =
    taxableIncomeForResidentTax > 0
      ? residentIncomeLevy + RESIDENT_TAX_PER_CAPITA
      : 0;

  // --- 個人事業税 ---
  // 法定業種に該当する場合のみ課税(エンジニア等は非該当のことがある)。
  // 事業税の所得計算では青色申告特別控除を差し引かない(profit ベース)。
  const businessTaxBase = input.businessTaxApplicable
    ? Math.max(0, profit - BUSINESS_TAX_DEDUCTION)
    : 0;
  const businessTax = floor100(businessTaxBase * BUSINESS_TAX_RATE);

  // --- 消費税 ---
  const consumptionTax = calculateConsumptionTax(
    input.consumptionTax,
    revenue,
    expenses
  );

  // --- 集計 ---
  const taxTotal = incomeTax + residentTax + businessTax + consumptionTax;
  const burdenTotal = taxTotal + socialInsuranceTotal;
  const takeHome = revenue - expenses - burdenTotal;
  const effectiveRateOnRevenue = revenue > 0 ? burdenTotal / revenue : 0;
  const effectiveRateOnIncome = profit > 0 ? burdenTotal / profit : 0;
  const monthlyReserve = Math.ceil(burdenTotal / 12);

  return {
    input: { ...input, revenue, expenses, dependents },
    profit,
    blueDeductionApplied,
    businessIncome,
    nationalPension,
    healthInsurance,
    socialInsuranceTotal,
    incomeTaxDeductions,
    residentTaxDeductions,
    taxableIncomeForIncomeTax,
    taxableIncomeForResidentTax,
    incomeTaxBase,
    recoveryTax,
    incomeTax,
    incomeTaxRate,
    residentTax,
    businessTax,
    consumptionTax,
    taxTotal,
    burdenTotal,
    takeHome,
    effectiveRateOnRevenue,
    effectiveRateOnIncome,
    monthlyReserve,
  };
}

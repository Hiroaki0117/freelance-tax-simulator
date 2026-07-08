// フリーランス/個人事業主向け 税金&手取り 概算ロジック
//
// 方針:v1 は「ざっくり当てる」。細かい特例より、まず全体像を即答することを優先する。
// すべて概算であり、正確な金額は確定申告・税理士で確認する前提(免責は UI 側にも明記)。

import {
  BASIC_DEDUCTION_INCOME_TAX_BRACKETS,
  BASIC_DEDUCTION_RESIDENT_TAX,
  BLUE_DEDUCTION,
  BUSINESS_TAX_DEDUCTION,
  BUSINESS_TAX_RATE,
  CONSUMPTION_LOCAL_RATIO,
  CONSUMPTION_NATIONAL_RATE,
  DEPENDENT_DEDUCTION_INCOME_TAX,
  DEPENDENT_DEDUCTION_RESIDENT_TAX,
  FURUSATO_RESIDENT_BASIC_RATE,
  FURUSATO_SELF_BURDEN,
  FURUSATO_SPECIAL_CAP_RATE,
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

/**
 * 基礎控除(所得税・令和7年分)を合計所得金額から求める。
 * 令和7年度税制改正で所得に応じた段階制(95万〜58万円+高所得の逓減)になった。
 */
export function calculateBasicDeductionIncomeTax(totalIncome: number): number {
  const bracket =
    BASIC_DEDUCTION_INCOME_TAX_BRACKETS.find((b) => totalIncome <= b.limit) ??
    BASIC_DEDUCTION_INCOME_TAX_BRACKETS[
      BASIC_DEDUCTION_INCOME_TAX_BRACKETS.length - 1
    ];
  return bracket.deduction;
}

/** 所得税(復興税前)と限界税率・速算控除を求める */
export function calculateIncomeTaxBase(taxableIncome: number): {
  amount: number;
  rate: number;
  deduction: number;
} {
  const bracket =
    INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.limit) ??
    INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  const amount = Math.max(
    0,
    floor100(taxableIncome * bracket.rate - bracket.deduction)
  );
  return { amount, rate: bracket.rate, deduction: bracket.deduction };
}

/**
 * 国民健康保険(概算)の内訳
 * 賦課のベース = 事業所得 - 43万円。所得割 + 均等割(被保険者数分)を上限でキャップ。
 */
export function calculateHealthInsuranceDetail(
  businessIncome: number,
  insuredCount: number,
  age40OrOver: boolean
): {
  total: number;
  incomeLevy: number;
  perCapita: number;
  insuredCount: number;
  cap: number;
  capped: boolean;
} {
  const table = age40OrOver ? KOKUHO.over40 : KOKUHO.under40;
  const count = Math.max(1, insuredCount);
  const base = Math.max(0, businessIncome - KOKUHO.basicDeduction);
  const incomeLevy = Math.round(base * table.incomeLevyRate);
  const perCapita = table.perCapita * count;
  const raw = incomeLevy + perCapita;
  return {
    total: Math.min(table.cap, raw),
    incomeLevy,
    perCapita,
    insuredCount: count,
    cap: table.cap,
    capped: raw > table.cap,
  };
}

export function calculateHealthInsurance(
  businessIncome: number,
  insuredCount: number,
  age40OrOver: boolean
): number {
  return calculateHealthInsuranceDetail(businessIncome, insuredCount, age40OrOver)
    .total;
}

/**
 * 消費税(概算)の内訳。売上は税込(10%)を前提とする。
 */
export function calculateConsumptionTaxDetail(
  mode: ConsumptionTaxMode,
  revenue: number,
  expenses: number
): {
  total: number;
  national: number;
  local: number;
  salesBase: number;
  salesNationalTax: number;
} {
  if (mode === 'exempt')
    return { total: 0, national: 0, local: 0, salesBase: 0, salesNationalTax: 0 };

  // 課税標準額(売上の税抜・1,000円未満切り捨て)に対する国税分
  const salesTaxableStandard = floor1000((revenue * 100) / 110);
  const salesNationalTax = salesTaxableStandard * CONSUMPTION_NATIONAL_RATE;

  let national = 0;
  if (mode === 'special2wari') {
    // 2割特例:売上税額の80%を控除 → 残り20%を納付
    national = floor100(salesNationalTax * (1 - SPECIAL_2WARI_DEDUCTION_RATE));
  } else if (mode === 'simplified') {
    // 簡易課税:みなし仕入率(サービス業50%)で控除
    national = floor100(
      salesNationalTax * (1 - SIMPLIFIED_DEEMED_PURCHASE_RATE)
    );
  } else {
    // 本則課税(概算):経費を全額課税仕入とみなして控除
    const purchaseTaxableStandard = floor1000((expenses * 100) / 110);
    const purchaseNationalTax =
      purchaseTaxableStandard * CONSUMPTION_NATIONAL_RATE;
    national = Math.max(0, floor100(salesNationalTax - purchaseNationalTax));
  }

  const local = floor100(national * CONSUMPTION_LOCAL_RATIO);
  return {
    total: national + local,
    national,
    local,
    salesBase: salesTaxableStandard,
    salesNationalTax,
  };
}

export function calculateConsumptionTax(
  mode: ConsumptionTaxMode,
  revenue: number,
  expenses: number
): number {
  return calculateConsumptionTaxDetail(mode, revenue, expenses).total;
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
  let kokuhoBreakdown: TaxResult['breakdown']['kokuho'] = null;
  if (input.insurance === 'kokuho') {
    // 国保の被保険者数は世帯(本人 + 配偶者 + 扶養人数)でカウント
    const insuredCount = 1 + (input.hasSpouse ? 1 : 0) + dependents;
    const detail = calculateHealthInsuranceDetail(
      businessIncome,
      insuredCount,
      input.age40OrOver
    );
    healthInsurance = detail.total;
    kokuhoBreakdown = {
      incomeLevy: detail.incomeLevy,
      perCapita: detail.perCapita,
      insuredCount: detail.insuredCount,
      cap: detail.cap,
      capped: detail.capped,
    };
  } else if (input.insurance === 'voluntary' || input.insurance === 'other') {
    // 任意継続・その他は実額(年額)を手入力で反映
    healthInsurance = Math.max(0, Math.round(input.healthInsuranceManual || 0));
  }
  // dependent(扶養内)は健康保険の自己負担なし(0)

  const socialInsuranceTotal = nationalPension + healthInsurance;

  // --- 所得税 ---
  const incomeTaxDeductions: DeductionBreakdown = {
    basic: calculateBasicDeductionIncomeTax(businessIncome),
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
  const {
    amount: incomeTaxBase,
    rate: incomeTaxRate,
    deduction: incomeTaxRateDeduction,
  } = calculateIncomeTaxBase(taxableIncomeForIncomeTax);
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
  const residentPerCapita =
    taxableIncomeForResidentTax > 0 ? RESIDENT_TAX_PER_CAPITA : 0;
  const residentTax = residentIncomeLevy + residentPerCapita;

  // --- 個人事業税 ---
  // 法定業種に該当する場合のみ課税(エンジニア等は非該当のことがある)。
  // 事業税の所得計算では青色申告特別控除を差し引かない(profit ベース)。
  const businessTaxBase = input.businessTaxApplicable
    ? Math.max(0, profit - BUSINESS_TAX_DEDUCTION)
    : 0;
  const businessTax = floor100(businessTaxBase * BUSINESS_TAX_RATE);

  // --- 消費税 ---
  const consumptionDetail = calculateConsumptionTaxDetail(
    input.consumptionTax,
    revenue,
    expenses
  );
  const consumptionTax = consumptionDetail.total;

  // --- ふるさと納税の上限額(概算)---
  // 控除上限 ≒ 住民税所得割 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円
  const recoveryFactor = 1 + RECOVERY_TAX_RATE; // 1.021(復興特別所得税込み)
  const furusatoNozeiLimit =
    residentIncomeLevy > 0
      ? floor1000(
          (residentIncomeLevy * FURUSATO_SPECIAL_CAP_RATE) /
            (0.9 - incomeTaxRate * recoveryFactor)
        ) + FURUSATO_SELF_BURDEN
      : 0;

  // --- ふるさと納税(実額入力時の控除・実質負担)---
  // 寄附額 X のうち (X − 2,000) が控除対象。次の3つに分かれる:
  //  ① 所得税の還付 = (X−2,000) × 所得税率 × 1.021
  //  ② 住民税・基本控除 = (X−2,000) × 10%
  //  ③ 住民税・特例控除 = (X−2,000) × (90% − 所得税率×1.021) ※住民税所得割×20%が上限
  // 上限内なら ①+②+③ = (X−2,000) となり実質負担2,000円。超過すると③が頭打ちで負担が増える。
  const furusatoDonation = Math.max(0, Math.round(input.furusatoDonation || 0));
  const furusatoEligible = Math.max(0, furusatoDonation - FURUSATO_SELF_BURDEN);
  const furusatoIncomeTaxReduction =
    furusatoDonation > 0 && incomeTax > 0
      ? Math.round(furusatoEligible * incomeTaxRate * recoveryFactor)
      : 0;
  const furusatoResidentSpecialCap = Math.round(
    residentIncomeLevy * FURUSATO_SPECIAL_CAP_RATE
  );
  const furusatoResidentSpecialUncapped =
    furusatoDonation > 0 && residentIncomeLevy > 0
      ? Math.round(furusatoEligible * (0.9 - incomeTaxRate * recoveryFactor))
      : 0;
  const furusatoResidentBasic =
    furusatoDonation > 0 && residentIncomeLevy > 0
      ? Math.round(furusatoEligible * FURUSATO_RESIDENT_BASIC_RATE)
      : 0;
  const furusatoResidentSpecial = Math.min(
    furusatoResidentSpecialUncapped,
    furusatoResidentSpecialCap
  );
  const furusatoResidentReduction =
    furusatoResidentBasic + furusatoResidentSpecial;
  const furusatoTotalBenefit =
    furusatoIncomeTaxReduction + furusatoResidentReduction;
  const furusatoOutOfPocket =
    furusatoDonation > 0 ? furusatoDonation - furusatoTotalBenefit : 0;
  const furusatoOverLimit =
    furusatoDonation > 0 &&
    furusatoResidentSpecialUncapped > furusatoResidentSpecialCap;

  // --- 集計 ---
  const taxTotal = incomeTax + residentTax + businessTax + consumptionTax;
  const burdenTotal = taxTotal + socialInsuranceTotal;
  // ふるさと納税をすると、寄附額のうち軽減分(所得税還付+住民税控除)は税が減って戻り、
  // 正味の持ち出しは実質自己負担(outOfPocket・上限内なら2,000円)だけ。
  // その分だけ手取り(使えるお金)が減る(返礼品は別途もらえる)。
  const takeHome = revenue - expenses - burdenTotal - furusatoOutOfPocket;
  const effectiveRateOnRevenue = revenue > 0 ? burdenTotal / revenue : 0;
  const effectiveRateOnIncome = profit > 0 ? burdenTotal / profit : 0;
  // 毎月のお金の3分解: 国保・年金は毎月払い / 税はまとめて来るので積立 / 残りが手取り
  const monthlyFixedCost = Math.ceil(socialInsuranceTotal / 12);
  const monthlyTaxReserve = Math.ceil(taxTotal / 12);
  const monthlyTakeHome = Math.floor(takeHome / 12);

  return {
    input: { ...input, revenue, expenses, dependents, furusatoDonation },
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
    incomeTaxRateDeduction,
    residentTax,
    businessTax,
    consumptionTax,
    taxTotal,
    burdenTotal,
    takeHome,
    effectiveRateOnRevenue,
    effectiveRateOnIncome,
    monthlyFixedCost,
    monthlyTaxReserve,
    monthlyTakeHome,
    furusatoNozeiLimit,
    furusato: {
      donation: furusatoDonation,
      eligible: furusatoEligible,
      incomeTaxReduction: furusatoIncomeTaxReduction,
      residentBasic: furusatoResidentBasic,
      residentSpecial: furusatoResidentSpecial,
      residentSpecialCap: furusatoResidentSpecialCap,
      residentReduction: furusatoResidentReduction,
      totalBenefit: furusatoTotalBenefit,
      outOfPocket: furusatoOutOfPocket,
      overLimit: furusatoOverLimit,
    },
    breakdown: {
      residentIncomeLevy,
      residentPerCapita,
      businessTaxBase,
      kokuho: kokuhoBreakdown,
      consumption:
        input.consumptionTax === 'exempt'
          ? null
          : {
              national: consumptionDetail.national,
              local: consumptionDetail.local,
              salesBase: consumptionDetail.salesBase,
              salesNationalTax: consumptionDetail.salesNationalTax,
            },
    },
  };
}

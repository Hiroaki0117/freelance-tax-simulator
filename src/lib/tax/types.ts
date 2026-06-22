// 税金シミュレーターの入出力型

/** 申告区分(青色申告特別控除の額に対応) */
export type FilingType = 'blue65' | 'blue10' | 'white';

/** 消費税の課税区分 */
export type ConsumptionTaxMode =
  | 'exempt' // 免税事業者
  | 'special2wari' // インボイス登録 + 2割特例
  | 'simplified' // 簡易課税(サービス業・第5種を既定)
  | 'general'; // 本則課税(概算)

/** 健康保険の区分 */
export type InsuranceType =
  | 'kokuho' // 国民健康保険(概算)+ 国民年金(第1号)
  | 'voluntary' // 前職の健康保険の任意継続(保険料は手入力)+ 国民年金(第1号)
  | 'other' // その他の健康保険(国保組合など・保険料は手入力)+ 国民年金(第1号)
  | 'dependent'; // 配偶者などの社会保険の扶養内(健保・年金の自己負担なし)

/** シミュレーターへの入力 */
export interface TaxInput {
  /** 年間売上(税込・見込み) */
  revenue: number;
  /** 年間経費(税込・概算) */
  expenses: number;
  /** 申告区分 */
  filingType: FilingType;
  /** 控除対象配偶者がいるか(配偶者の所得が低い) */
  hasSpouse: boolean;
  /** 扶養親族の人数(16歳以上・一般扶養としてざっくり計上) */
  dependents: number;
  /** 消費税の課税区分 */
  consumptionTax: ConsumptionTaxMode;
  /** 健康保険の区分 */
  insurance: InsuranceType;
  /** 任意継続・その他を選んだ場合の健康保険料(年額・手入力) */
  healthInsuranceManual: number;
  /** 個人事業税の対象業種か(非該当の職種なら false で0円) */
  businessTaxApplicable: boolean;
  /** 40歳以上か(国保の介護分の有無に影響) */
  age40OrOver: boolean;
}

/** 所得控除の内訳 */
export interface DeductionBreakdown {
  basic: number; // 基礎控除
  socialInsurance: number; // 社会保険料控除(国保 + 国民年金)
  spouse: number; // 配偶者控除
  dependents: number; // 扶養控除
  total: number; // 合計
}

/** シミュレーターの計算結果 */
export interface TaxResult {
  /** 入力の控え */
  input: TaxInput;

  // 所得
  profit: number; // 事業の利益(売上 - 経費・青色控除前)
  blueDeductionApplied: number; // 適用された青色申告特別控除
  businessIncome: number; // 事業所得(青色控除後)

  // 社会保険
  nationalPension: number; // 国民年金(本人分)
  healthInsurance: number; // 国民健康保険
  socialInsuranceTotal: number; // 社会保険合計

  // 所得控除と課税所得
  incomeTaxDeductions: DeductionBreakdown; // 所得税の所得控除
  residentTaxDeductions: DeductionBreakdown; // 住民税の所得控除
  taxableIncomeForIncomeTax: number; // 課税所得(所得税)
  taxableIncomeForResidentTax: number; // 課税所得(住民税)

  // 各税
  incomeTaxBase: number; // 所得税(復興税前)
  recoveryTax: number; // 復興特別所得税
  incomeTax: number; // 所得税合計(復興税込)
  incomeTaxRate: number; // 適用された所得税率(限界税率)
  incomeTaxRateDeduction: number; // 速算控除額(速算表の控除額)
  residentTax: number; // 住民税
  businessTax: number; // 個人事業税
  consumptionTax: number; // 消費税

  // 集計
  taxTotal: number; // 税の合計(所得税 + 住民税 + 事業税 + 消費税)
  burdenTotal: number; // 税 + 社会保険の合計
  takeHome: number; // 手取り(売上 - 経費 - burdenTotal)
  effectiveRateOnRevenue: number; // 売上に対する負担率(burdenTotal / revenue)
  effectiveRateOnIncome: number; // 利益に対する負担率(burdenTotal / profit)
  // 毎月のお金の3分解(毎月の利益 = ①固定費 + ②税の月割り + ③手取り)
  monthlyFixedCost: number; // ① 国保+年金 ÷12 — もう毎月出ているお金
  monthlyTaxReserve: number; // ② 住民税+事業税+所得税+消費税 ÷12 — まとめて来るので毎月積立
  monthlyTakeHome: number; // ③ 手取り ÷12 — 自由に使えるお金

  // ふるさと納税(実質負担2,000円で済む寄附の上限額・概算)
  furusatoNozeiLimit: number;

  // 計算内訳(UIのクリック展開・AIの説明用)
  breakdown: {
    residentIncomeLevy: number; // 住民税の所得割
    residentPerCapita: number; // 住民税の均等割 + 森林環境税
    businessTaxBase: number; // 個人事業税の課税ベース(利益 − 290万)
    kokuho: {
      incomeLevy: number; // 所得割
      perCapita: number; // 均等割(被保険者数分)
      insuredCount: number; // 被保険者数
      cap: number; // 賦課限度額
      capped: boolean; // 上限に達したか
    } | null;
    consumption: {
      national: number; // 国税分
      local: number; // 地方消費税分
      salesBase: number; // 課税標準額(売上の税抜)
      salesNationalTax: number; // 売上の消費税(国税分)
    } | null;
  };
}

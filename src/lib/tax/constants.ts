// 税率・控除のテーブル(年度別の定数)
//
// すべて「令和7年(2025年)分」を前提とした概算用の値。
// 毎年更新する前提で、計算ロジックから定数を分離している。
// 細かい特例(調整控除・特定扶養・自治体差など)はあえて省いた「ざっくり」版。
//
// 将来の更新メモ:
// - 令和8年分は基礎控除の本則が62万円+特例再設計の見込み(令和8年度改正大綱)
// - 令和8年度は国保の賦課限度額に「子ども・子育て支援納付金分」(新区分)が加わる見込み
// - 令和9年1月から復興特別所得税2.1%が「復興1.1%+防衛1.0%」に分かれる(合計は同じ)

/** 適用年分(表示・将来の切り替え用) */
export const TAX_YEAR = 2025;

/** 青色申告特別控除の額 */
export const BLUE_DEDUCTION = {
  blue65: 650_000, // 複式簿記 + e-Tax(電子申告)または電子帳簿保存
  blue55: 550_000, // 複式簿記 + 書面(紙)で提出
  blue10: 100_000, // 簡易簿記
  white: 0, // 白色申告
} as const;

/**
 * 基礎控除(所得税・令和7年分)
 *
 * 令和7年度税制改正で本則48万円→58万円に引き上げ。さらに合計所得655万円以下には
 * 令和7・8年分限定の上乗せ特例があり、合計所得金額に応じて段階的に決まる。
 * 2,350万円超は従来どおり逓減し2,500万円超で消失。
 * (このツールでは合計所得金額 = 事業所得として判定する)
 */
export const BASIC_DEDUCTION_INCOME_TAX_BRACKETS = [
  { limit: 1_320_000, deduction: 950_000 },
  { limit: 3_360_000, deduction: 880_000 },
  { limit: 4_890_000, deduction: 680_000 },
  { limit: 6_550_000, deduction: 630_000 },
  { limit: 23_500_000, deduction: 580_000 },
  { limit: 24_000_000, deduction: 480_000 },
  { limit: 24_500_000, deduction: 320_000 },
  { limit: 25_000_000, deduction: 160_000 },
  { limit: Infinity, deduction: 0 },
] as const;

/** 基礎控除(住民税)。令和7年度改正でも43万円で据え置き(所得税とは連動しない) */
export const BASIC_DEDUCTION_RESIDENT_TAX = 430_000;

/** 配偶者控除(本人の合計所得900万円以下・一般を前提) */
export const SPOUSE_DEDUCTION_INCOME_TAX = 380_000;
export const SPOUSE_DEDUCTION_RESIDENT_TAX = 330_000;

/** 扶養控除(一般・1人あたり)。特定扶養63万円などはざっくり版では区別しない */
export const DEPENDENT_DEDUCTION_INCOME_TAX = 380_000;
export const DEPENDENT_DEDUCTION_RESIDENT_TAX = 330_000;

/** 国民年金保険料(令和7年度:月17,510円。毎年度改定されるので要更新。令和8年度は17,920円) */
export const NATIONAL_PENSION_MONTHLY = 17_510;
export const NATIONAL_PENSION_ANNUAL = NATIONAL_PENSION_MONTHLY * 12; // 210,120円

/**
 * 所得税の速算表(令和6年分)
 * 税額 = 課税所得 × rate - deduction
 */
export const INCOME_TAX_BRACKETS = [
  { limit: 1_950_000, rate: 0.05, deduction: 0 },
  { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
  { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
  { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
  { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
  { limit: Infinity, rate: 0.45, deduction: 4_796_000 },
] as const;

/** 復興特別所得税の税率(基準所得税額 × 2.1%) */
export const RECOVERY_TAX_RATE = 0.021;

/** 住民税:所得割の税率(都道府県民税 + 市町村民税 ≒ 10%) */
export const RESIDENT_TAX_INCOME_RATE = 0.1;

/** 住民税:均等割 + 森林環境税(4,000円 + 1,000円 = 5,000円) */
export const RESIDENT_TAX_PER_CAPITA = 5_000;

/** 個人事業税:事業主控除(年290万円) */
export const BUSINESS_TAX_DEDUCTION = 2_900_000;

/** 個人事業税:税率(第1種事業 5%) */
export const BUSINESS_TAX_RATE = 0.05;

/**
 * 国民健康保険(概算)
 *
 * 自治体ごとに料率・均等割・上限が大きく異なるため、ここでは全国的な「目安」を用いる。
 * - 40歳未満:介護分なし
 * - 40歳以上:介護分を上乗せ
 * 実際の保険料は必ずお住まいの自治体の料率で確認すること。
 */
export const KOKUHO = {
  /** 賦課のベースから差し引く基礎控除(43万円) */
  basicDeduction: 430_000,
  under40: {
    incomeLevyRate: 0.099, // 医療分 + 後期高齢者支援分(目安)
    perCapita: 50_000, // 均等割(被保険者1人あたり・目安)
    cap: 920_000, // 賦課限度額(令和7年度: 医療66万 + 支援26万)
  },
  over40: {
    incomeLevyRate: 0.118, // 上記 + 介護分(目安)
    perCapita: 65_000, // 介護分の均等割を上乗せ(目安)
    cap: 1_090_000, // 賦課限度額(令和7年度: + 介護17万)
  },
} as const;

/** 消費税の地方分の割合(国税 × 22/78) */
export const CONSUMPTION_LOCAL_RATIO = 22 / 78;

/** 消費税の国税率(7.8%)。標準税率10%のうち国税分 */
export const CONSUMPTION_NATIONAL_RATE = 0.078;

/** 簡易課税のみなし仕入率(第5種・サービス業 = 50%)をざっくり既定とする */
export const SIMPLIFIED_DEEMED_PURCHASE_RATE = 0.5;

/** インボイス「2割特例」の控除割合(売上税額の80%を控除) */
export const SPECIAL_2WARI_DEDUCTION_RATE = 0.8;

/**
 * iDeCo(個人型確定拠出年金)の掛金上限(第1号被保険者=フリーランス)
 *
 * 月68,000円(国民年金基金・付加保険料との合算枠)。掛金は全額が
 * 小規模企業共済等掛金控除(所得税・住民税とも同額)になる。
 * 国保の保険料計算には効かない(所得控除は国保の賦課ベースに反映されない)。
 * 将来メモ: 令和9年(2027年)以降に月75,000円へ引き上げ予定(施行時期は要確認)。
 */
export const IDECO_MONTHLY_MAX = 68_000;

/** iDeCoの掛金の最低額(月5,000円・1,000円単位) */
export const IDECO_MONTHLY_MIN = 5_000;

/** ふるさと納税:自己負担額(2,000円)。寄附額のうちこの額は控除対象外 */
export const FURUSATO_SELF_BURDEN = 2_000;

/** ふるさと納税:住民税の特例控除の上限(住民税所得割に対する割合・20%) */
export const FURUSATO_SPECIAL_CAP_RATE = 0.2;

/** ふるさと納税:住民税の基本控除の割合(寄附額 − 2,000円 の10%) */
export const FURUSATO_RESIDENT_BASIC_RATE = 0.1;

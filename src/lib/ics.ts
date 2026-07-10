// 納税予定カレンダー(.ics)の生成(UX案 4-5)
//
// 「今年の所得」にかかる納付の期限を、払う年(=課税年+1)の日付に割り付けて、
// iCalendar(RFC 5545)形式のテキストにする。Google カレンダー/iPhone に取り込める。
// 期限・金額はすべて概算。実際の額・期限は自治体/税務署の通知書で確認する前提。
//
// 画面の支払いカレンダー(ResultPanel の PaymentTimeline)と同じ内訳ルール:
//   - 3月: 所得税(確定申告)/ 消費税(確定申告)
//   - 住民税4期: 6月・8月・10月・翌1月(普通徴収)
//   - 個人事業税2期: 8月・11月

import type { TaxResult } from './tax/types';

export interface TaxDeadline {
  /** 支払期限の年 */
  year: number;
  /** 月(1-12) */
  month: number;
  /** 日 */
  day: number;
  /** イベント名(例: 所得税の納付) */
  title: string;
  /** 概算の金額(円) */
  amount: number;
  /** UID に使う安定キー(income / resident-1 など) */
  kind: string;
  /** 補足(自治体で前後する等) */
  note?: string;
}

/**
 * 「今年の所得」にかかる納付期限を、払う年(=課税年+1)の日付に割り付ける。
 * 金額が0のもの(所得ゼロ・免税・非対象業種など)は含めない。
 *
 * @param result 計算結果
 * @param payYear 払う年(課税年 + 1)
 */
export function buildTaxDeadlines(
  result: TaxResult,
  payYear: number
): TaxDeadline[] {
  const r = result;
  const out: TaxDeadline[] = [];

  if (r.incomeTax > 0) {
    out.push({
      year: payYear,
      month: 3,
      day: 15,
      title: '所得税の納付(確定申告)',
      amount: r.incomeTax,
      kind: 'income',
      note: '確定申告ぶんの所得税。振替納税なら口座引落しは4月ごろ。',
    });
  }
  if (r.consumptionTax > 0) {
    out.push({
      year: payYear,
      month: 3,
      day: 31,
      title: '消費税の納付(確定申告)',
      amount: r.consumptionTax,
      kind: 'consumption',
      note: '個人事業主の消費税の申告・納付期限。',
    });
  }

  if (r.residentTax > 0) {
    const inst = Math.round(r.residentTax / 4);
    const last = r.residentTax - inst * 3; // 端数は最終期に寄せて合計を一致させる
    out.push(
      {
        year: payYear,
        month: 6,
        day: 30,
        title: '住民税 第1期',
        amount: inst,
        kind: 'resident-1',
        note: '普通徴収。金額・期限は自治体で前後します。',
      },
      {
        year: payYear,
        month: 8,
        day: 31,
        title: '住民税 第2期',
        amount: inst,
        kind: 'resident-2',
        note: '普通徴収。金額・期限は自治体で前後します。',
      },
      {
        year: payYear,
        month: 10,
        day: 31,
        title: '住民税 第3期',
        amount: inst,
        kind: 'resident-3',
        note: '普通徴収。金額・期限は自治体で前後します。',
      },
      {
        year: payYear + 1,
        month: 1,
        day: 31,
        title: '住民税 第4期(最終)',
        amount: last,
        kind: 'resident-4',
        note: '普通徴収の最終回。金額・期限は自治体で前後します。',
      }
    );
  }

  if (r.businessTax > 0) {
    const inst = Math.round(r.businessTax / 2);
    const last = r.businessTax - inst;
    out.push(
      {
        year: payYear,
        month: 8,
        day: 31,
        title: '個人事業税 第1期',
        amount: inst,
        kind: 'business-1',
        note: '法定業種の場合。通知は8月ごろ届きます。',
      },
      {
        year: payYear,
        month: 11,
        day: 30,
        title: '個人事業税 第2期',
        amount: last,
        kind: 'business-2',
        note: '法定業種の場合。',
      }
    );
  }

  return out;
}

const CRLF = '\r\n';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(year: number, month: number, day: number): string {
  return `${year}${pad2(month)}${pad2(day)}`;
}

/** うるう年を考慮した月の日数 */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** 全日イベントの DTEND は排他(翌日)。年末・月末を跨ぐ */
function nextDay(year: number, month: number, day: number) {
  if (day < daysInMonth(year, month)) return { year, month, day: day + 1 };
  if (month < 12) return { year, month: month + 1, day: 1 };
  return { year: year + 1, month: 1, day: 1 };
}

/** RFC 5545 のテキストエスケープ(順序重要: バックスラッシュを先に) */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export interface IcsOptions {
  /** DTSTAMP(生成時刻)。決定的にするため呼び出し側から渡す。形式 YYYYMMDDTHHMMSSZ */
  dtstamp: string;
  /** カレンダー名(X-WR-CALNAME) */
  calendarName?: string;
  /** 何日前にリマインダを出すか(既定3日前) */
  reminderDaysBefore?: number;
}

/**
 * 納付期限リストを iCalendar(.ics)テキストにする。
 * 各期限は「全日イベント + N日前リマインダ」。UID は kind+日付で安定(再取込で重複せず更新)。
 */
export function buildTaxIcs(
  deadlines: TaxDeadline[],
  options: IcsOptions
): string {
  const reminder = options.reminderDaysBefore ?? 3;
  const calName = options.calendarName ?? '納税予定(概算)';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//freelance-tedori//tax-calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];

  for (const dl of deadlines) {
    const start = ymd(dl.year, dl.month, dl.day);
    const nd = nextDay(dl.year, dl.month, dl.day);
    const end = ymd(nd.year, nd.month, nd.day);
    const amount = dl.amount.toLocaleString('ja-JP');
    const summary = escapeText(`${dl.title} 約${amount}円`);
    const description = escapeText(
      [
        `概算 約${amount}円`,
        dl.note,
        'フリーランスの手取りざっくりシミュレーターより。正確な額・期限は通知書で確認を。',
      ]
        .filter(Boolean)
        .join('\n')
    );

    lines.push(
      'BEGIN:VEVENT',
      `UID:${dl.kind}-${start}@freelance-tedori.com`,
      `DTSTAMP:${options.dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:-P${reminder}D`,
      `DESCRIPTION:${summary}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}

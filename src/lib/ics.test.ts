import { describe, it, expect } from 'vitest';
import { buildTaxDeadlines, buildTaxIcs } from './ics';
import { calculateTax } from './tax/calculator';
import type { TaxInput } from './tax/types';

const base: TaxInput = {
  revenue: 6_000_000,
  expenses: 1_200_000,
  filingType: 'blue65',
  hasSpouse: false,
  dependents: 0,
  consumptionTax: 'special2wari',
  insurance: 'kokuho',
  healthInsuranceManual: 0,
  businessTaxApplicable: true,
  age40OrOver: false,
  furusatoDonation: 0,
  idecoMonthly: 0,
};

const DTSTAMP = '20260101T000000Z';

describe('buildTaxDeadlines(納付期限の割り付け)', () => {
  it('所得税・消費税・住民税4期・事業税2期が払う年に並ぶ', () => {
    const r = calculateTax(base);
    const dls = buildTaxDeadlines(r, 2026);
    const kinds = dls.map((d) => d.kind);
    expect(kinds).toEqual([
      'income',
      'consumption',
      'resident-1',
      'resident-2',
      'resident-3',
      'resident-4',
      'business-1',
      'business-2',
    ]);
    // 住民税4期の最終は翌々年1月
    const r4 = dls.find((d) => d.kind === 'resident-4')!;
    expect([r4.year, r4.month, r4.day]).toEqual([2027, 1, 31]);
    // 所得税は3/15、消費税は3/31
    expect(dls.find((d) => d.kind === 'income')).toMatchObject({ month: 3, day: 15 });
    expect(dls.find((d) => d.kind === 'consumption')).toMatchObject({ month: 3, day: 31 });
  });

  it('住民税4期の合計は residentTax に一致する(端数は最終期に寄せる)', () => {
    const r = calculateTax(base);
    const dls = buildTaxDeadlines(r, 2026);
    const sum = dls
      .filter((d) => d.kind.startsWith('resident-'))
      .reduce((a, d) => a + d.amount, 0);
    expect(sum).toBe(r.residentTax);
  });

  it('事業税2期の合計は businessTax に一致する', () => {
    const r = calculateTax(base);
    const dls = buildTaxDeadlines(r, 2026);
    const sum = dls
      .filter((d) => d.kind.startsWith('business-'))
      .reduce((a, d) => a + d.amount, 0);
    expect(sum).toBe(r.businessTax);
  });

  it('非対象業種なら事業税イベントは出ない', () => {
    const r = calculateTax({ ...base, businessTaxApplicable: false });
    const dls = buildTaxDeadlines(r, 2026);
    expect(dls.some((d) => d.kind.startsWith('business-'))).toBe(false);
  });

  it('免税事業者なら消費税イベントは出ない', () => {
    const r = calculateTax({ ...base, consumptionTax: 'exempt' });
    const dls = buildTaxDeadlines(r, 2026);
    expect(dls.some((d) => d.kind === 'consumption')).toBe(false);
  });

  it('所得ゼロなら期限は空', () => {
    const r = calculateTax({ ...base, revenue: 0, expenses: 0 });
    expect(buildTaxDeadlines(r, 2026)).toEqual([]);
  });
});

describe('buildTaxIcs(iCalendar出力)', () => {
  it('VCALENDARで囲まれ、期限の数だけVEVENTを持つ', () => {
    const r = calculateTax(base);
    const dls = buildTaxDeadlines(r, 2026);
    const ics = buildTaxIcs(dls, { dtstamp: DTSTAMP });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    const eventCount = ics.split('BEGIN:VEVENT').length - 1;
    expect(eventCount).toBe(dls.length);
    // CRLF 改行
    expect(ics.includes('\r\n')).toBe(true);
  });

  it('全日イベントで、DTENDは翌日(月末・年末を跨ぐ)', () => {
    // 12/31 の期限 → DTEND は翌年1/1
    const ics = buildTaxIcs(
      [{ year: 2026, month: 12, day: 31, title: 'テスト', amount: 1000, kind: 't' }],
      { dtstamp: DTSTAMP }
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('SUMMARYのカンマ(金額区切り)がエスケープされる', () => {
    const ics = buildTaxIcs(
      [{ year: 2026, month: 3, day: 15, title: '所得税の納付', amount: 123_456, kind: 'income' }],
      { dtstamp: DTSTAMP }
    );
    expect(ics).toContain('SUMMARY:所得税の納付 約123\\,456円');
  });

  it('リマインダ(VALARM)が既定3日前で入る', () => {
    const ics = buildTaxIcs(
      [{ year: 2026, month: 3, day: 15, title: '所得税', amount: 1000, kind: 'income' }],
      { dtstamp: DTSTAMP }
    );
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P3D');
  });

  it('UIDは kind と日付から安定して決まる', () => {
    const dl = { year: 2026, month: 6, day: 30, title: '住民税 第1期', amount: 1000, kind: 'resident-1' };
    const a = buildTaxIcs([dl], { dtstamp: DTSTAMP });
    const b = buildTaxIcs([dl], { dtstamp: '20990101T000000Z' });
    expect(a).toContain('UID:resident-1-20260630@freelance-tedori.com');
    // DTSTAMP が違ってもUIDは同じ(再取込で重複しない)
    expect(b).toContain('UID:resident-1-20260630@freelance-tedori.com');
  });
});

import { describe, expect, it } from 'vitest';
import { calculateTax } from './calculator';
import { DEFAULT_INPUT } from './defaults';
import { NATIONAL_PENSION_MONTHLY } from './constants';
import { buildPaymentSchedule } from './calendar';

describe('buildPaymentSchedule', () => {
  it('12ヶ月ぶんを翌年3月〜翌々年2月の順で返す', () => {
    const sched = buildPaymentSchedule(calculateTax({ ...DEFAULT_INPUT }));
    expect(sched.months).toHaveLength(12);
    expect(sched.months[0].label).toBe('3月');
    expect(sched.months[0].yearHint).toBe('翌年');
    expect(sched.months[10].label).toBe('1月');
    expect(sched.months[10].yearHint).toBe('翌々年');
    expect(sched.months[11].label).toBe('2月');
  });

  it('確定申告の3月がピーク。marchLump = 所得税 + 消費税', () => {
    const r = calculateTax({ ...DEFAULT_INPUT });
    const sched = buildPaymentSchedule(r);
    expect(sched.peakIndex).toBe(0);
    expect(sched.peak.label).toBe('3月');
    expect(sched.peak.big).toBe(true);
    expect(sched.marchLump).toBe(r.incomeTax + r.consumptionTax);
    // 3月の合計 = まとめて来る税 + 毎月もの(国保 + 年金)
    expect(sched.months[0].total).toBe(sched.months[0].lump + sched.months[0].base);
  });

  it('国保は4月・5月がおやすみ(6月〜翌3月の10期)', () => {
    const r = calculateTax({ ...DEFAULT_INPUT }); // kokuho
    const sched = buildPaymentSchedule(r);
    const health = Math.round(r.healthInsurance / 12);
    // 4月(index1)・5月(index2)は国保なし、年金のみ
    expect(sched.months[1].base).toBe(NATIONAL_PENSION_MONTHLY);
    expect(sched.months[2].base).toBe(NATIONAL_PENSION_MONTHLY);
    // 6月(index3)は国保あり
    expect(sched.months[3].base).toBe(NATIONAL_PENSION_MONTHLY + health);
  });

  it('扶養内(dependent)は年金も国保も毎月ものに載らない', () => {
    const r = calculateTax({ ...DEFAULT_INPUT, insurance: 'dependent' });
    const sched = buildPaymentSchedule(r);
    expect(sched.months.every((m) => m.base === 0)).toBe(true);
  });

  it('任意継続(voluntary)は払う年カレンダーに健保を載せない(稼ぐ年に毎月払う想定)', () => {
    const r = calculateTax({
      ...DEFAULT_INPUT,
      insurance: 'voluntary',
      healthInsuranceManual: 480_000,
    });
    const sched = buildPaymentSchedule(r);
    // 毎月ものは年金だけ
    expect(sched.months[3].base).toBe(NATIONAL_PENSION_MONTHLY);
  });
});

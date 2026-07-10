import { describe, it, expect } from 'vitest';
import { calculateTax } from './calculator';
import { solveRevenueForTakeHome, REVERSE_MAX_REVENUE } from './reverse';
import { assumedExpenses } from './defaults';
import type { TaxInput } from './types';

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

describe('solveRevenueForTakeHome(逆算:手取り→必要売上)', () => {
  it('往復:既知の売上の手取りを目標にすると、ほぼ同じ売上に戻る(経費固定)', () => {
    const forward = calculateTax(base);
    const solution = solveRevenueForTakeHome(forward.takeHome, base, false);
    // 1,000円精度の探索なので、元の売上との差は十分小さい
    expect(Math.abs(solution.revenue - base.revenue)).toBeLessThan(3_000);
    expect(solution.reachable).toBe(true);
  });

  it('達成される手取りは目標以上で、目標との差はごくわずか', () => {
    const target = 3_600_000; // 年360万(月30万)
    const solution = solveRevenueForTakeHome(target, base, false);
    expect(solution.takeHome).toBeGreaterThanOrEqual(target - 2_000);
    // 二分探索の1ステップ(1,000円)ぶんの過達に収まる
    expect(solution.takeHome - target).toBeLessThan(3_000);
  });

  it('目標が大きいほど必要売上も大きい(単調)', () => {
    const low = solveRevenueForTakeHome(3_000_000, base, false);
    const mid = solveRevenueForTakeHome(4_000_000, base, false);
    const high = solveRevenueForTakeHome(5_000_000, base, false);
    expect(low.revenue).toBeLessThan(mid.revenue);
    expect(mid.revenue).toBeLessThan(high.revenue);
  });

  it('経費が仮置き(20%連動)のとき、返す経費は売上の20%・返す手取りは目標近傍', () => {
    const target = 4_000_000;
    const solution = solveRevenueForTakeHome(target, base, true);
    expect(solution.expenses).toBe(assumedExpenses(solution.revenue));
    // 経費を1万円単位に丸める分、達成手取りは目標を数千円下回ることがある(万円表示では同じ)
    expect(solution.takeHome).toBeGreaterThanOrEqual(target - 6_000);
    expect(solution.takeHome).toBeLessThanOrEqual(target + 6_000);
    // この目標では必要売上が6M(経費20%=実額1.2Mの交点)を超える → 仮置きの方が経費が多く必要売上も大きい
    const fixed = solveRevenueForTakeHome(target, base, false);
    expect(solution.revenue).toBeGreaterThan(fixed.revenue);
  });

  it('仮置き経路で返す売上・経費を本体に入れ直すと、返した手取りに一致する', () => {
    const solution = solveRevenueForTakeHome(4_000_000, base, true);
    const replay = calculateTax({
      ...base,
      revenue: solution.revenue,
      expenses: solution.expenses,
    });
    expect(replay.takeHome).toBe(solution.takeHome);
  });

  it('年金・健保の自己負担がない扶養内で目標0なら、売上0でよい', () => {
    // 国保・年金を払う base は「手取り0(トントン)」でも売上が要るが、
    // 扶養内(自己負担なし)+経費0なら売上0で手取り0が成立する
    const dependent = { ...base, insurance: 'dependent' as const, expenses: 0 };
    const solution = solveRevenueForTakeHome(0, dependent, false);
    expect(solution.revenue).toBe(0);
    expect(solution.reachable).toBe(true);
  });

  it('国保・年金を払う人の手取り0(トントン)には、固定費ぶんの売上が必要', () => {
    const solution = solveRevenueForTakeHome(0, base, false);
    expect(solution.revenue).toBeGreaterThan(0);
    expect(solution.takeHome).toBeGreaterThanOrEqual(0);
    expect(solution.reachable).toBe(true);
  });

  it('非現実的に大きい目標は reachable=false(上限で頭打ち)', () => {
    const solution = solveRevenueForTakeHome(9_999_999_999, base, false);
    expect(solution.reachable).toBe(false);
    expect(solution.revenue).toBe(REVERSE_MAX_REVENUE);
  });
});

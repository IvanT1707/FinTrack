const { calculateBudgetStatus } = require('../src/utils/budget');

describe('Budget status logic', () => {
  test('returns ok when spent is below 80%', () => {
    const result = calculateBudgetStatus(3000, 2000);
    expect(result.status).toBe('ok');
    expect(result.percent).toBeCloseTo(66.67, 2);
  });

  test('returns warning when spent is between 80% and 100%', () => {
    const result = calculateBudgetStatus(3000, 2500);
    expect(result.status).toBe('warning');
    expect(result.percent).toBeCloseTo(83.33, 2);
  });

  test('returns exceeded when spent is above 100%', () => {
    const result = calculateBudgetStatus(3000, 3500);
    expect(result.status).toBe('exceeded');
    expect(result.percent).toBeCloseTo(116.67, 2);
  });

  test('returns null when no limit exists', () => {
    expect(calculateBudgetStatus(null, 1500)).toBeNull();
  });
});

function calculateForecast(monthlyTotals) {
  if (!Array.isArray(monthlyTotals) || monthlyTotals.length === 0) {
    return {
      monthsAnalyzed: 0,
      averageIncome: 0,
      averageExpense: 0,
      projectedBalance: 0
    };
  }

  const totalIncome = monthlyTotals.reduce((sum, month) => sum + Number(month.income || 0), 0);
  const totalExpense = monthlyTotals.reduce((sum, month) => sum + Number(month.expense || 0), 0);
  const monthsAnalyzed = monthlyTotals.length;
  const averageIncome = totalIncome / monthsAnalyzed;
  const averageExpense = totalExpense / monthsAnalyzed;

  return {
    monthsAnalyzed,
    averageIncome,
    averageExpense,
    projectedBalance: averageIncome - averageExpense
  };
}

module.exports = {
  calculateForecast
};

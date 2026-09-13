function calculateBudgetStatus(limitAmount, spentAmount) {
  if (limitAmount === null || limitAmount === undefined || limitAmount === 0) {
    return null;
  }

  const safeSpent = Number(spentAmount) || 0;
  const safeLimit = Number(limitAmount);
  const percent = (safeSpent / safeLimit) * 100;

  let status = 'ok';

  if (percent >= 100) {
    status = 'exceeded';
  } else if (percent >= 80) {
    status = 'warning';
  }

  return {
    limit: safeLimit,
    spent: safeSpent,
    percent,
    status
  };
}

module.exports = {
  calculateBudgetStatus
};

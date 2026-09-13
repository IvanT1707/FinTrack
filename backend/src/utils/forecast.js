function forecastCategory(monthlyHistory) {
  if (!Array.isArray(monthlyHistory) || monthlyHistory.length === 0) {
    return 0;
  }

  if (monthlyHistory.length === 1) {
    return Number(monthlyHistory[0]) || 0;
  }

  const weights = [1, 2, 3];
  const history = monthlyHistory.slice(-weights.length);
  const usedWeights = weights.slice(-history.length);
  const weightedSum = history.reduce(
    (sum, value, index) => sum + (Number(value) || 0) * usedWeights[index],
    0
  );
  const weightSum = usedWeights.reduce((sum, weight) => sum + weight, 0);

  return weightedSum / weightSum;
}

module.exports = {
  forecastCategory
};

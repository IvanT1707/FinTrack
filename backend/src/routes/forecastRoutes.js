const express = require('express');
const { Op } = require('sequelize');

function createForecastRouter({ Category, Transaction, authMiddleware, forecastCategory }) {
  const router = express.Router();

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });
      if (!Number.isInteger(year)) return res.status(400).json({ message: 'year is required' });

      const targetStart = new Date(Date.UTC(year, month - 1, 1));
      const historyStart = new Date(Date.UTC(year, month - 4, 1));
      const toDateOnly = (date) => date.toISOString().slice(0, 10);
      const categories = await Category.findAll({
        where: { type: 'expense', [Op.or]: [{ userId: req.user.userId }, { userId: null }] },
        order: [['name', 'ASC']]
      });
      const transactions = await Transaction.findAll({
        where: {
          userId: req.user.userId,
          type: 'expense',
          transactionDate: { [Op.gte]: toDateOnly(historyStart), [Op.lt]: toDateOnly(targetStart) }
        },
        attributes: ['amount', 'categoryId', 'transactionDate']
      });

      const historyMonths = Array.from({ length: 3 }, (_, index) => {
        const date = new Date(Date.UTC(year, month - 4 + index, 1));
        return { key: date.toISOString().slice(0, 7), categories: new Map() };
      });
      const monthsByKey = new Map(historyMonths.map((item) => [item.key, item]));
      transactions.forEach((transaction) => {
        const monthTotals = monthsByKey.get(String(transaction.transactionDate).slice(0, 7));
        if (monthTotals) {
          const categoryTotal = monthTotals.categories.get(transaction.categoryId) || 0;
          monthTotals.categories.set(transaction.categoryId, categoryTotal + Number(transaction.amount));
        }
      });

      const categoryForecasts = categories.map((category) => {
        const history = historyMonths.map((monthTotals) => monthTotals.categories.get(category.id) || 0);
        return {
          category_id: category.id,
          category: category.name,
          forecast: Number(forecastCategory(history).toFixed(2))
        };
      });

      return res.status(200).json({
        month,
        year,
        categories: categoryForecasts,
        total_forecast: Number(categoryForecasts.reduce((sum, item) => sum + item.forecast, 0).toFixed(2))
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to calculate forecast', error: error.message });
    }
  });

  return router;
}

module.exports = { createForecastRouter };

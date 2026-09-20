const express = require('express');
const { Op } = require('sequelize');

function createAnalyticsRouter({ Transaction, Category, authMiddleware }) {
  const router = express.Router();

  router.get('/summary', authMiddleware, async (req, res) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });
      if (!Number.isInteger(year)) return res.status(400).json({ message: 'year is required' });

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));
      const transactions = await Transaction.findAll({
        where: { userId: req.user.userId, transactionDate: { [Op.gte]: startDate.toISOString().slice(0, 10), [Op.lt]: endDate.toISOString().slice(0, 10) } },
        attributes: ['amount', 'type']
      });
      const totalIncome = transactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      const totalExpense = transactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      return res.status(200).json({ month, year, total_income: Number(totalIncome.toFixed(2)), total_expense: Number(totalExpense.toFixed(2)), balance: Number((totalIncome - totalExpense).toFixed(2)) });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to calculate analytics summary', error: error.message });
    }
  });

  router.get('/by-category', authMiddleware, async (req, res) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });
      if (!Number.isInteger(year)) return res.status(400).json({ message: 'year is required' });

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));
      const transactions = await Transaction.findAll({
        where: { userId: req.user.userId, type: 'expense', transactionDate: { [Op.gte]: startDate.toISOString().slice(0, 10), [Op.lt]: endDate.toISOString().slice(0, 10) } },
        include: [{ model: Category, attributes: ['id', 'name'] }],
        attributes: ['amount', 'categoryId']
      });
      const totals = new Map();
      transactions.forEach((transaction) => {
        const current = totals.get(transaction.categoryId) || { category_id: transaction.categoryId, category: transaction.Category ? transaction.Category.name : null, total_expense: 0 };
        current.total_expense += Number(transaction.amount);
        totals.set(transaction.categoryId, current);
      });
      return res.status(200).json({ month, year, categories: [...totals.values()].map((item) => ({ ...item, total_expense: Number(item.total_expense.toFixed(2)) })) });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to calculate category analytics', error: error.message });
    }
  });

  router.get('/trend', authMiddleware, async (req, res) => {
    try {
      const months = Number(req.query.months || 6);
      const targetMonth = Number(req.query.month || new Date().getUTCMonth() + 1);
      const targetYear = Number(req.query.year || new Date().getUTCFullYear());
      if (!Number.isInteger(months) || months < 1 || months > 24) return res.status(400).json({ message: 'months must be between 1 and 24' });
      if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });
      if (!Number.isInteger(targetYear)) return res.status(400).json({ message: 'year is required' });

      const startDate = new Date(Date.UTC(targetYear, targetMonth - months - 1, 1));
      const endDate = new Date(Date.UTC(targetYear, targetMonth, 1));
      const transactions = await Transaction.findAll({
        where: { userId: req.user.userId, transactionDate: { [Op.gte]: startDate.toISOString().slice(0, 10), [Op.lt]: endDate.toISOString().slice(0, 10) } },
        attributes: ['amount', 'type', 'transactionDate']
      });
      const trend = Array.from({ length: months }, (_, index) => {
        const date = new Date(Date.UTC(targetYear, targetMonth - months + index, 1));
        return { month: date.toISOString().slice(0, 7), income: 0, expense: 0 };
      });
      const trendByMonth = new Map(trend.map((item) => [item.month, item]));
      transactions.forEach((transaction) => {
        const item = trendByMonth.get(String(transaction.transactionDate).slice(0, 7));
        if (item) item[transaction.type] += Number(transaction.amount);
      });
      return res.status(200).json({ months: trend.map((item) => ({ ...item, balance: Number((item.income - item.expense).toFixed(2)) })) });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to calculate analytics trend', error: error.message });
    }
  });

  return router;
}

module.exports = { createAnalyticsRouter };

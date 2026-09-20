const express = require('express');
const { Op } = require('sequelize');

function createBudgetLimitRouter({ BudgetLimit, Category, Transaction, authMiddleware, calculateBudgetStatus }) {
  const router = express.Router();

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const month = Number(req.query.month);
      const year = Number(req.query.year);
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'month must be between 1 and 12' });
      if (!Number.isInteger(year)) return res.status(400).json({ message: 'year is required' });
      const limits = await BudgetLimit.findAll({
        where: { userId: req.user.userId, periodMonth: month, periodYear: year },
        include: [{ model: Category, attributes: ['id', 'name', 'type'] }],
        order: [['createdAt', 'DESC']]
      });

      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const nextMonthDate = new Date(Date.UTC(year, month, 1));
      const toDateOnly = (date) => date.toISOString().slice(0, 10);
      const result = await Promise.all(limits.map(async (limit) => {
        const spent = await Transaction.sum('amount', {
          where: {
            userId: req.user.userId,
            categoryId: limit.categoryId,
            type: 'expense',
            transactionDate: { [Op.gte]: toDateOnly(startDate), [Op.lt]: toDateOnly(nextMonthDate) }
          }
        });
        const safeSpent = Number(spent || 0);
        const summary = calculateBudgetStatus(Number(limit.limitAmount), safeSpent);
        return {
          id: limit.id,
          category: limit.Category ? limit.Category.name : null,
          category_id: limit.categoryId,
          limit_amount: Number(limit.limitAmount).toFixed(2),
          spent: safeSpent,
          percent: summary ? summary.percent : 0,
          status: summary ? summary.status : 'ok'
        };
      }));
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch budget limits', error: error.message });
    }
  });

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const categoryId = Number(req.body.category_id);
      const limitAmount = Number(req.body.limit_amount);
      const periodMonth = Number(req.body.period_month);
      const periodYear = Number(req.body.period_year);
      if (!categoryId || !Number.isFinite(limitAmount) || limitAmount <= 0) return res.status(400).json({ message: 'limit_amount must be a positive number' });
      if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) return res.status(400).json({ message: 'period_month must be between 1 and 12' });
      if (!Number.isInteger(periodYear)) return res.status(400).json({ message: 'period_year is required' });

      const category = await Category.findOne({ where: { id: categoryId, [Op.or]: [{ userId: req.user.userId }, { userId: null }] } });
      if (!category) return res.status(400).json({ message: 'Category does not exist or does not belong to this user' });
      if (category.type !== 'expense') return res.status(400).json({ message: 'Budget limits can only be assigned to expense categories' });

      const limit = await BudgetLimit.create({ userId: req.user.userId, categoryId, limitAmount, periodMonth, periodYear });
      return res.status(201).json({ id: limit.id, user_id: limit.userId, category_id: limit.categoryId, limit_amount: Number(limit.limitAmount).toFixed(2), period_month: limit.periodMonth, period_year: limit.periodYear });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Budget limit for this category and period already exists' });
      }
      return res.status(500).json({ message: 'Failed to create budget limit', error: error.message });
    }
  });

  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const limit = await BudgetLimit.findOne({ where: { id: Number(req.params.id), userId: req.user.userId } });
      if (!limit) return res.status(404).json({ message: 'Budget limit not found' });

      const categoryId = Number(req.body.category_id ?? limit.categoryId);
      const limitAmount = Number(req.body.limit_amount ?? limit.limitAmount);
      const periodMonth = Number(req.body.period_month ?? limit.periodMonth);
      const periodYear = Number(req.body.period_year ?? limit.periodYear);
      if (!categoryId || !Number.isFinite(limitAmount) || limitAmount <= 0) return res.status(400).json({ message: 'limit_amount must be a positive number' });
      if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) return res.status(400).json({ message: 'period_month must be between 1 and 12' });
      if (!Number.isInteger(periodYear)) return res.status(400).json({ message: 'period_year is required' });

      const category = await Category.findOne({ where: { id: categoryId, [Op.or]: [{ userId: req.user.userId }, { userId: null }] } });
      if (!category) return res.status(400).json({ message: 'Category does not exist or does not belong to this user' });
      if (category.type !== 'expense') return res.status(400).json({ message: 'Budget limits can only be assigned to expense categories' });

      await limit.update({ categoryId, limitAmount, periodMonth, periodYear });
      return res.status(200).json({ id: limit.id, user_id: limit.userId, category_id: limit.categoryId, limit_amount: Number(limit.limitAmount).toFixed(2), period_month: limit.periodMonth, period_year: limit.periodYear });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Budget limit for this category and period already exists' });
      }
      return res.status(500).json({ message: 'Failed to update budget limit', error: error.message });
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const deletedCount = await BudgetLimit.destroy({ where: { id: Number(req.params.id), userId: req.user.userId } });
      if (!deletedCount) return res.status(404).json({ message: 'Budget limit not found' });
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete budget limit', error: error.message });
    }
  });

  return router;
}

module.exports = { createBudgetLimitRouter };

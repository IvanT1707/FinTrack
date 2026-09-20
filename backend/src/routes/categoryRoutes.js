const express = require('express');
const { Op } = require('sequelize');

function createCategoryRouter({ Category, Transaction, BudgetLimit, authMiddleware }) {
  const router = express.Router();

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const categories = await Category.findAll({
        where: {
          [Op.or]: [
            { userId: req.user.userId },
            { userId: null }
          ]
        },
        order: [['name', 'ASC']]
      });

      return res.status(200).json(categories);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
    }
  });

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      const type = String(req.body.type || '').trim();

      if (!name || name.length < 1 || name.length > 100) {
        return res.status(400).json({ message: 'Category name must be 1-100 characters' });
      }
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'Type must be income or expense' });
      }

      const category = await Category.create({ userId: req.user.userId, name, type });
      return res.status(201).json(category);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to create category', error: error.message });
    }
  });

  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const category = await Category.findOne({
        where: { id: Number(req.params.id), userId: req.user.userId }
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found or is system-owned' });
      }

      const name = String(req.body.name ?? category.name).trim();
      const type = String(req.body.type ?? category.type).trim();
      if (!name || name.length > 100) {
        return res.status(400).json({ message: 'Category name must be 1-100 characters' });
      }
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'Type must be income or expense' });
      }

      if (type === 'income' && category.type === 'expense') {
        const budgetLimitCount = await BudgetLimit.count({
          where: { categoryId: category.id, userId: req.user.userId }
        });
        if (budgetLimitCount > 0) {
          return res.status(409).json({
            message: 'Category cannot become income while it has budget limits'
          });
        }
      }

      await category.update({ name, type });
      return res.status(200).json(category);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update category', error: error.message });
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const category = await Category.findOne({
        where: { id: Number(req.params.id), userId: req.user.userId }
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found or is system-owned' });
      }

      const [transactionCount, budgetLimitCount] = await Promise.all([
        Transaction.count({ where: { categoryId: category.id, userId: req.user.userId } }),
        BudgetLimit.count({ where: { categoryId: category.id, userId: req.user.userId } })
      ]);

      if (transactionCount > 0 || budgetLimitCount > 0) {
        return res.status(409).json({
          message: 'Category cannot be deleted while it is used by transactions or budget limits'
        });
      }

      await category.destroy();
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete category', error: error.message });
    }
  });

  return router;
}

module.exports = { createCategoryRouter };

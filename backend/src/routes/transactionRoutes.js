const express = require('express');
const { Op } = require('sequelize');

function createTransactionRouter({ Transaction, Category, authMiddleware, isValidDateOnly }) {
  const router = express.Router();

  router.get('/', authMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
      const type = req.query.type ? String(req.query.type).trim() : null;
      const from = req.query.from ? String(req.query.from).trim() : null;
      const to = req.query.to ? String(req.query.to).trim() : null;

      if (!Number.isInteger(page) || page < 1) return res.status(400).json({ message: 'page must be a positive integer' });
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: 'limit must be between 1 and 100' });
      if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId < 1)) return res.status(400).json({ message: 'category_id must be a positive integer' });
      if (type !== null && !['income', 'expense'].includes(type)) return res.status(400).json({ message: 'type must be income or expense' });
      if ((from && !isValidDateOnly(from)) || (to && !isValidDateOnly(to))) return res.status(400).json({ message: 'from and to must use valid YYYY-MM-DD dates' });

      const where = { userId: req.user.userId };
      if (categoryId !== null) where.categoryId = categoryId;
      if (type !== null) where.type = type;
      if (from || to) {
        where.transactionDate = {};
        if (from) where.transactionDate[Op.gte] = from;
        if (to) where.transactionDate[Op.lte] = to;
      }

      const result = await Transaction.findAndCountAll({
        where,
        include: [{ model: Category, attributes: ['id', 'name', 'type'] }],
        order: [['transactionDate', 'DESC'], ['id', 'DESC']],
        limit,
        offset: (page - 1) * limit
      });

      return res.status(200).json({
        items: result.rows,
        pagination: { page, limit, total: result.count, total_pages: Math.ceil(result.count / limit) }
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
    }
  });

  router.post('/', authMiddleware, async (req, res) => {
    try {
      const categoryId = Number(req.body.category_id);
      const amount = Number(req.body.amount);
      const type = String(req.body.type || '').trim();
      const description = req.body.description ? String(req.body.description).trim() : null;
      const transactionDate = req.body.transaction_date ? String(req.body.transaction_date).trim() : null;

      if (!categoryId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Amount must be a positive number' });
      if (!['income', 'expense'].includes(type)) return res.status(400).json({ message: 'Type must be income or expense' });
      if (!transactionDate || !isValidDateOnly(transactionDate)) return res.status(400).json({ message: 'transaction_date must be a valid YYYY-MM-DD date' });

      const category = await Category.findOne({ where: { id: categoryId, [Op.or]: [{ userId: req.user.userId }, { userId: null }] } });
      if (!category) return res.status(400).json({ message: 'Category does not exist or does not belong to this user' });

      const transaction = await Transaction.create({ userId: req.user.userId, categoryId, amount, type, description, transactionDate });
      return res.status(201).json(transaction);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to create transaction', error: error.message });
    }
  });

  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const transaction = await Transaction.findOne({ where: { id: Number(req.params.id), userId: req.user.userId } });
      if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

      const categoryId = Number(req.body.category_id ?? transaction.categoryId);
      const amount = Number(req.body.amount ?? transaction.amount);
      const type = String(req.body.type ?? transaction.type).trim();
      const description = req.body.description === undefined ? transaction.description : String(req.body.description).trim() || null;
      const transactionDate = String(req.body.transaction_date ?? transaction.transactionDate).trim();

      if (!categoryId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Amount must be a positive number' });
      if (!['income', 'expense'].includes(type)) return res.status(400).json({ message: 'Type must be income or expense' });
      if (!isValidDateOnly(transactionDate)) return res.status(400).json({ message: 'transaction_date must be a valid YYYY-MM-DD date' });

      const category = await Category.findOne({ where: { id: categoryId, [Op.or]: [{ userId: req.user.userId }, { userId: null }] } });
      if (!category) return res.status(400).json({ message: 'Category does not exist or does not belong to this user' });

      await transaction.update({ categoryId, amount, type, description, transactionDate });
      const response = transaction.toJSON();
      response.amount = Number(transaction.amount).toFixed(2);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update transaction', error: error.message });
    }
  });

  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const deletedCount = await Transaction.destroy({ where: { id: Number(req.params.id), userId: req.user.userId } });
      if (!deletedCount) return res.status(404).json({ message: 'Transaction not found' });
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
    }
  });

  return router;
}

module.exports = { createTransactionRouter };

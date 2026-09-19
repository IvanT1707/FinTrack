const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define(
  'Transaction',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'category_id',
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },
    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['income', 'expense']]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'transaction_date'
    }
  },
  {
    tableName: 'transactions',
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'transaction_date']
      },
      {
        fields: ['category_id']
      }
    ]
  }
);

module.exports = Transaction;

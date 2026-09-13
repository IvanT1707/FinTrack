const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BudgetLimit = sequelize.define(
  'BudgetLimit',
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
    limitAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'limit_amount',
      validate: {
        min: 0.01
      }
    },
    periodMonth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'period_month',
      validate: {
        min: 1,
        max: 12
      }
    },
    periodYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'period_year'
    }
  },
  {
    tableName: 'budget_limits',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'category_id', 'period_month', 'period_year']
      }
    ]
  }
);

module.exports = BudgetLimit;

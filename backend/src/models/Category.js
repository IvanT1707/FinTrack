const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['income', 'expense']]
      }
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true
    }
  },
  {
    tableName: 'categories',
    underscored: true
  }
);

module.exports = Category;

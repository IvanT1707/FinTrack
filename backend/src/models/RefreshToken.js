const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define(
  'RefreshToken',
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
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    }
  },
  {
    tableName: 'refresh_tokens',
    underscored: true
  }
);

module.exports = RefreshToken;

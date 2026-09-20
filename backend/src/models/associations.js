function setupAssociations({ User, RefreshToken, Category, Transaction, BudgetLimit }) {
  User.hasMany(RefreshToken, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
  });

  RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

  User.hasMany(Category, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
  });

  Category.belongsTo(User, { foreignKey: 'user_id' });

  User.hasMany(Transaction, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
  });

  Category.hasMany(Transaction, { foreignKey: 'category_id' });
  Transaction.belongsTo(User, { foreignKey: 'user_id' });
  Transaction.belongsTo(Category, { foreignKey: 'category_id' });

  User.hasMany(BudgetLimit, {
    foreignKey: 'user_id',
    onDelete: 'CASCADE'
  });

  Category.hasMany(BudgetLimit, { foreignKey: 'category_id' });
  BudgetLimit.belongsTo(User, { foreignKey: 'user_id' });
  BudgetLimit.belongsTo(Category, { foreignKey: 'category_id' });
}

module.exports = setupAssociations;

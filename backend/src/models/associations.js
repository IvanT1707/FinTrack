function setupAssociations({ User, RefreshToken, Category, Transaction, BudgetLimit }) {
  User.hasMany(RefreshToken, {
    foreignKey: 'userId',
    onDelete: 'CASCADE'
  });

  RefreshToken.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Category, {
    foreignKey: 'userId',
    onDelete: 'CASCADE'
  });

  Category.belongsTo(User, { foreignKey: 'userId' });

  User.hasMany(Transaction, {
    foreignKey: 'userId',
    onDelete: 'CASCADE'
  });

  Category.hasMany(Transaction, { foreignKey: 'category_id' });
  Transaction.belongsTo(User, { foreignKey: 'userId' });
  Transaction.belongsTo(Category, { foreignKey: 'category_id' });

  User.hasMany(BudgetLimit, {
    foreignKey: 'userId',
    onDelete: 'CASCADE'
  });

  Category.hasMany(BudgetLimit, { foreignKey: 'category_id' });
  BudgetLimit.belongsTo(User, { foreignKey: 'userId' });
  BudgetLimit.belongsTo(Category, { foreignKey: 'category_id' });
}

module.exports = setupAssociations;

const Category = require('../models/Category');

const defaultCategories = [
  { name: 'Продукти', type: 'expense' },
  { name: 'Транспорт', type: 'expense' },
  { name: 'Комунальні послуги', type: 'expense' },
  { name: 'Розваги', type: 'expense' },
  { name: 'Здоров’я', type: 'expense' },
  { name: 'Зарплата', type: 'income' },
  { name: 'Інше', type: 'expense' }
];

async function seedDefaultCategories() {
  for (const category of defaultCategories) {
    await Category.findOrCreate({
      where: {
        userId: null,
        name: category.name,
        type: category.type
      },
      defaults: category
    });
  }
}

module.exports = {
  defaultCategories,
  seedDefaultCategories
};

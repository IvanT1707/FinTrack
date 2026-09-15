require('dotenv').config();

const sequelize = require('../src/config/database');
const { seedDefaultCategories } = require('../src/seed/defaultCategories');

async function run() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: false });
    await seedDefaultCategories();
    console.log('Default categories seeded');
  } catch (error) {
    console.error('Failed to seed default categories:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();

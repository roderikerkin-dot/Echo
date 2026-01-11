// Импортируем приложение из нашего серверного файла
const app = require('../../vercel-server-supabase-clean.js');

// Создаем обработчик для Vercel
module.exports = async (req, res) => {
  // Передаем управление нашему приложению Express
  await new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
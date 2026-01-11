// Импортируем приложение из нашего серверного файла
const app = require('../vercel-server-supabase-clean.js');

// Создаем обработчик для Vercel
module.exports = (req, res) => {
  // Передаем управление нашему приложению Express
  app(req, res, (err) => {
    if (err) {
      console.error('Ошибка в обработке запроса:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Внутренняя ошибка сервера', details: err.message });
      }
    }
  });
};
// Импортируем приложение из нашего серверного файла
const app = require('../vercel-server-supabase-clean.js');

// Создаем обработчик для Vercel
module.exports = async (req, res) => {
  // Убедимся, что res не завершен
  if (!res.writableEnded) {
    try {
      // Передаем управление нашему приложению Express
      await new Promise((resolve, reject) => {
        const done = (err) => {
          if (err) {
            console.error('Ошибка в обработке запроса:', err);
            reject(err);
          } else {
            resolve();
          }
        };

        app(req, res, done);
      });
    } catch (error) {
      console.error('Ошибка при обработке запроса:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
      }
    }
  }
};
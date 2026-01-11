// Используем Supabase напрямую для Vercel API Routes
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Не заданы переменные окружения SUPABASE_URL или SUPABASE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Функция для проверки токена
function authenticateToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

module.exports = async (req, res) => {
  // Проверяем метод запроса
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  try {
    // Проверяем авторизацию
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    const user = authenticateToken(token);
    if (!user) {
      return res.status(403).json({ message: 'Недействительный токен' });
    }

    const userTag = req.query.tag;

    // Проверяем, что тег пользователя передан
    if (!userTag) {
      return res.status(400).json({ message: 'Не указан тег пользователя' });
    }

    // Находим пользователя по тегу
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, username, user_tag, avatar')
      .eq('user_tag', userTag)
      .single();

    if (error || !targetUser) {
      return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
    }

    // Возвращаем информацию о пользователе
    res.status(200).json({
      id: targetUser.id,
      username: targetUser.username,
      user_tag: targetUser.user_tag,
      avatar: targetUser.avatar
    });
  } catch (error) {
    console.error('Ошибка при получении информации о пользователе:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
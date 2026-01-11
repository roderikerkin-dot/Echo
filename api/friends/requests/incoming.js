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

    const userId = user.userId;

    // Получаем входящие запросы в друзья с информацией о пользователях
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        created_at,
        users!friend_requests_sender_id_fkey(username, avatar, user_tag)
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Ошибка при получении входящих запросов:', error);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Преобразуем результат, чтобы поля пользователя были на верхнем уровне
    const formattedRequests = requests.map(req => ({
      id: req.id,
      sender_id: req.sender_id,
      created_at: req.created_at,
      username: req.users?.username,
      avatar: req.users?.avatar || '👤',
      user_tag: req.users?.user_tag
    }));

    res.status(200).json(formattedRequests);
  } catch (error) {
    console.error('Ошибка при получении входящих запросов:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
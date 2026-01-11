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
  if (req.method !== 'POST') {
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

    const { userTag } = req.body;
    const senderId = user.userId;

    // Проверяем, что тег пользователя передан и имеет правильный формат
    if (!userTag || typeof userTag !== 'string' || !/^\d{6}$/.test(userTag)) {
      return res.status(400).json({ message: 'Неверный формат тега пользователя (ожидается 6-значное число)' });
    }

    // Находим получателя запроса по тегу
    const { data: receiver, error } = await supabase
      .from('users')
      .select('id')
      .eq('user_tag', userTag)
      .single();

    if (error || !receiver) {
      return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
    }

    const receiverId = receiver.id;

    // Проверяем, не является ли пользователь сам собой
    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Нельзя отправить запрос в друзья себе' });
    }

    // Проверяем, нет ли уже запроса или уже являются друзьями
    const { data: existingRequest, error: requestError } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ message: 'Вы уже являетесь друзьями' });
      } else {
        return res.status(400).json({ message: 'Запрос в друзья уже отправлен' });
      }
    }

    // Проверяем, нет ли уже дружбы между пользователями
    const { data: friendship, error: friendshipError } = await supabase
      .from('friends')
      .select('*')
      .or(`and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`)
      .single();

    if (friendship) {
      return res.status(400).json({ message: 'Вы уже являетесь друзьями' });
    }

    // Создаем запрос в друзья
    const { data: newRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert([{ sender_id: senderId, receiver_id: receiverId }])
      .select()
      .single();

    if (insertError) {
      console.error('Ошибка при создании запроса в друзья:', insertError);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    res.status(200).json({ message: 'Запрос в друзья успешно отправлен', requestId: newRequest.id });
  } catch (error) {
    console.error('Ошибка при отправке запроса в друзья:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
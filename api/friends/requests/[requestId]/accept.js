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

    const userId = user.userId;
    const requestId = req.query.requestId;

    // Проверяем, что ID запроса передан
    if (!requestId) {
      return res.status(400).json({ message: 'Не указан ID запроса' });
    }

    // Проверяем, что запрос существует и адресован текущему пользователю
    const { data: request, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .single();

    if (error || !request) {
      return res.status(404).json({ message: 'Запрос в друзья не найден или уже обработан' });
    }

    // Обновляем статус запроса
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Ошибка при обновлении статуса запроса:', updateError);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Создаем запись о дружбе
    const { data: friendship, error: insertError } = await supabase
      .from('friends')
      .insert([{ user1_id: request.sender_id, user2_id: request.receiver_id }])
      .select()
      .single();

    if (insertError) {
      // Откатываем изменения, если возникла ошибка
      await supabase
        .from('friend_requests')
        .update({ status: 'pending' })
        .eq('id', requestId);
        
      console.error('Ошибка при создании дружбы:', insertError);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    res.status(200).json({ message: 'Запрос в друзья принят' });
  } catch (error) {
    console.error('Ошибка при принятии запроса в друзья:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
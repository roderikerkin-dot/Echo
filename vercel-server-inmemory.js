require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Ошибка: Не заданы переменные окружения SUPABASE_URL или SUPABASE_KEY');
  throw new Error('Не заданы переменные окружения SUPABASE_URL или SUPABASE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Проверка подключения к Supabase
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('Ошибка подключения к Supabase:', error);
      throw new Error(`Ошибка подключения к Supabase: ${error.message}`);
    }
    console.log('Подключение к Supabase успешно');
  } catch (err) {
    console.error('Ошибка при проверке подключения к Supabase:', err);
    throw err;
  }
}

// Выполняем проверку подключения при инициализации
testSupabaseConnection().catch(err => {
  console.error('Ошибка при инициализации подключения к Supabase:', err);
});

// Настройка Passport для аутентификации через GitHub (заглушка)
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret',
    callbackURL: "/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // Заглушка для GitHub аутентификации
    const existingUser = users.find(u => u.github_id === profile.id);
    
    if (existingUser) {
      return done(null, existingUser);
    } else {
      const adjectives = ['cool', 'super', 'amazing', 'awesome', 'epic', 'legendary', 'fantastic', 'wonderful', 'brilliant', 'fabulous'];
      const nouns = ['user', 'gamer', 'ninja', 'hero', 'champion', 'warrior', 'wizard', 'master', 'pro', 'star'];
      const number = Math.floor(1000 + Math.random() * 9000); // 4-значное число

      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomUsername = `${randomAdjective}${randomNoun}${number}`;

      const newUser = {
        id: generateId(),
        email: `github_${profile.id}@example.com`,
        password: '',
        username: randomUsername,
        user_tag: generateUniqueUserTag(),
        github_id: profile.id,
        github_username: profile.username
      };
      
      users.push(newUser);
      return done(null, newUser);
    }
  }
));

// Сериализация пользователя для сессии
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

// Десериализация пользователя из сессии
passport.deserializeUser(function(id, done) {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Секретный ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(passport.initialize());
// Убираем passport.session() так как в serverless среде сессии не работают
// Вместо этого будем использовать JWT токены для аутентификации

// Функция для генерации уникального шестизначного тега пользователя
function generateUniqueUserTag() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-значное число
}

// Функция для проверки уникальности тега пользователя
async function checkUserTagUniqueness(tag) {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('user_tag', tag)
        .single();

    return !data; // true если тег уникален
}

// Функция для генерации уникального тега (с проверкой на уникальность)
async function generateUniqueTagWithRetry(attempts = 0) {
    if (attempts > 10) { // Ограничение числа попыток
        throw new Error('Не удалось сгенерировать уникальный тег после нескольких попыток');
    }

    const tag = generateUniqueUserTag();
    const isUnique = await checkUserTagUniqueness(tag);

    if (isUnique) {
        return tag;
    } else {
        // Рекурсивный вызов для генерации нового тега
        return generateUniqueTagWithRetry(attempts + 1);
    }
}

// Маршрут для регистрации
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Проверка, что пароль не менее 6 символов
        if (password.length < 6) {
            return res.status(400).json({ message: 'Пароль должен содержать не менее 6 символов' });
        }

        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Введите действительный email адрес' });
        }

        // Проверка, существует ли уже пользователь с таким email
        if (users.some(user => user.email === email)) {
            return res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' });
        }

        // Хеширование пароля
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Генерация случайного имени пользователя
        const adjectives = ['cool', 'super', 'amazing', 'awesome', 'epic', 'legendary', 'fantastic', 'wonderful', 'brilliant', 'fabulous'];
        const nouns = ['user', 'gamer', 'ninja', 'hero', 'champion', 'warrior', 'wizard', 'master', 'pro', 'star'];
        const number = Math.floor(1000 + Math.random() * 9000); // 4-значное число

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomUsername = `${randomAdjective}${randomNoun}${number}`;

        // Генерация уникального тега пользователя
        const userTag = generateUniqueTagWithRetry();

        // Вставка пользователя в базу данных Supabase
        const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                username: randomUsername,
                user_tag: userTag,
                about_me: '',
                avatar: '👤',
                registration_date: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertError) {
            if (insertError.code === '23505') { // Код ошибки уникальности в PostgreSQL
                if (insertError.message.includes('email')) {
                    return res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' });
                } else if (insertError.message.includes('user_tag')) {
                    return res.status(500).json({ message: 'Ошибка при генерации уникального тега' });
                }
            }
            return res.status(500).json({ message: 'Ошибка сервера при регистрации' });
        }

        // Успешная регистрация
        res.status(201).json({
            message: 'Регистрация успешна!',
            userId: insertedUser.id,
            username: randomUsername,
            userTag: userTag
        });
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для входа
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Поиск пользователя в базе данных
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        // Проверка пароля
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        // Создание JWT токена
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Возвращение токена и данных пользователя
        res.json({
            message: 'Вход успешен',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Ошибка при входе:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Защита маршрутов с помощью middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Маршрут для получения информации о пользователе
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, username, user_tag, about_me, avatar, registration_date')
            .eq('id', req.user.userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(user);
    } catch (error) {
        console.error('Ошибка при получении профиля:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для обновления профиля
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { username, about, avatar } = req.body;

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                username: username || undefined,
                about_me: about || undefined,
                avatar: avatar || undefined
            })
            .eq('id', req.user.userId)
            .select()
            .single();

        if (error) {
            console.error('Ошибка при обновлении профиля:', error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!data) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json({ message: 'Профиль успешно обновлен' });
    } catch (error) {
        console.error('Ошибка при обновлении профиля:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для аутентификации через GitHub (заглушка)
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

// Маршрут для обратного вызова после аутентификации через GitHub (заглушка)
app.get('/auth/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login' }), // Отключаем сессии
  (req, res) => {
    // Успешная аутентификация, генерируем JWT токен
    const user = req.user;

    // Создание JWT токена
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Перенаправляем на главную страницу с токеном в параметрах URL
    res.redirect(`/index.html?token=${token}`);
  });

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Маршрут для отправки запроса в друзья
app.post('/api/friends/request', authenticateToken, async (req, res) => {
    const senderId = req.user.userId;
    const { userTag } = req.body; // получаем тег пользователя, которому отправляем запрос

    try {
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

        res.json({ message: 'Запрос в друзья успешно отправлен', requestId: newRequest.id });
    } catch (error) {
        console.error('Ошибка при отправке запроса в друзья:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения входящих запросов в друзья
app.get('/api/friends/requests/incoming', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем входящие запросы в друзья с информацией о пользователях
    const incomingRequests = friendRequests
        .filter(req => req.receiver_id === userId && req.status === 'pending')
        .map(req => {
            const sender = users.find(u => u.id === req.sender_id);
            return {
                id: req.id,
                sender_id: req.sender_id,
                created_at: req.created_at,
                username: sender?.username,
                avatar: sender?.avatar || '👤',
                user_tag: sender?.user_tag
            };
        });

    res.json(incomingRequests);
});

// Маршрут для получения исходящих запросов в друзья
app.get('/api/friends/requests/outgoing', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем исходящие запросы в друзья
    const outgoingRequests = friendRequests
        .filter(req => req.sender_id === userId && req.status === 'pending')
        .map(req => {
            const receiver = users.find(u => u.id === req.receiver_id);
            return {
                id: req.id,
                receiver_id: req.receiver_id,
                created_at: req.created_at,
                username: receiver?.username,
                avatar: receiver?.avatar || '👤',
                user_tag: receiver?.user_tag
            };
        });

    res.json(outgoingRequests);
});

// Маршрут для принятия запроса в друзья
app.post('/api/friends/requests/:requestId/accept', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    // Проверяем, что запрос существует и адресован текущему пользователю
    const request = friendRequests.find(req => req.id === requestId && req.receiver_id === userId && req.status === 'pending');

    if (!request) {
        return res.status(404).json({ message: 'Запрос в друзья не найден или уже обработан' });
    }

    // Обновляем статус запроса
    request.status = 'accepted';

    // Создаем запись о дружбе
    const newFriendship = {
        id: generateId(),
        user1_id: request.sender_id,
        user2_id: request.receiver_id,
        added_at: new Date().toISOString()
    };

    friends.push(newFriendship);

    res.json({ message: 'Запрос в друзья принят' });
});

// Маршрут для отклонения запроса в друзья
app.post('/api/friends/requests/:requestId/reject', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const requestId = parseInt(req.params.requestId);

    // Проверяем, что запрос существует и адресован текущему пользователю
    const request = friendRequests.find(req => req.id === requestId && req.receiver_id === userId && req.status === 'pending');

    if (!request) {
        return res.status(404).json({ message: 'Запрос в друзья не найден или уже обработан' });
    }

    // Обновляем статус запроса на отклоненный
    request.status = 'rejected';

    res.json({ message: 'Запрос в друзья отклонен' });
});

// Маршрут для получения списка друзей
app.get('/api/friends', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем список друзей с информацией о них
    const userFriends = friends
        .filter(f => f.user1_id === userId || f.user2_id === userId)
        .flatMap(friendship => {
            const friendId = friendship.user1_id === userId ? friendship.user2_id : friendship.user1_id;
            const friend = users.find(u => u.id === friendId);
            if (friend) {
                return [{
                    id: friend.id,
                    username: friend.username,
                    avatar: friend.avatar || '👤',
                    user_tag: friend.user_tag
                }];
            }
            return [];
        });

    res.json(userFriends);
});

// Маршрут для отправки личного сообщения
app.post('/api/messages/private', authenticateToken, (req, res) => {
    const senderId = req.user.userId;
    const { receiverTag, message } = req.body;

    // Проверяем формат тега получателя
    if (!receiverTag || typeof receiverTag !== 'string' || !/^\d{6}$/.test(receiverTag)) {
        return res.status(400).json({ message: 'Неверный формат тега получателя (ожидается 6-значное число)' });
    }

    // Проверяем, что сообщение не пустое
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: 'Сообщение не может быть пустым' });
    }

    if (message.trim().length > 1000) {
        return res.status(400).json({ message: 'Сообщение слишком длинное (максимум 1000 символов)' });
    }

    // ПРИМЕЧАНИЕ: В реальном приложении в serverless-окружении рекомендуется использовать
    // внешнее хранилище (например, Redis) или Supabase для эффективного rate limiting
    // из-за отсутствия персистентности состояния между вызовами в serverless среде

    // Находим получателя по тегу
    const receiver = users.find(u => u.user_tag === receiverTag);

    if (!receiver) {
        return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
    }

    const receiverId = receiver.id;

    // Проверяем, являются ли пользователи друзьями
    const friendship = friends.find(
      f => (f.user1_id === senderId && f.user2_id === receiverId) || 
           (f.user1_id === receiverId && f.user2_id === senderId)
    );

    if (!friendship) {
        return res.status(400).json({ message: 'Можно отправлять сообщения только друзьям' });
    }

    // Проверяем, не отправляет ли пользователь сообщение самому себе
    if (senderId === receiverId) {
        return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
    }

    // Сохраняем сообщение
    const newMessage = {
        id: generateId(),
        sender_id: senderId,
        receiver_id: receiverId,
        message: message.trim(),
        timestamp: new Date().toISOString()
    };

    privateMessages.push(newMessage);

    res.json({
        message: 'Сообщение успешно отправлено',
        messageId: newMessage.id,
        timestamp: newMessage.timestamp
    });
});

// Маршрут для получения истории личных сообщений с конкретным пользователем
app.get('/api/messages/private/:userTag', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { userTag } = req.params;

    // Находим пользователя по тегу
    const targetUser = users.find(u => u.user_tag === userTag);

    if (!targetUser) {
        return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
    }

    const targetUserId = targetUser.id;

    // Проверяем, являются ли пользователи друзьями
    const friendship = friends.find(
      f => (f.user1_id === userId && f.user2_id === targetUserId) || 
           (f.user1_id === targetUserId && f.user2_id === userId)
    );

    if (!friendship) {
        return res.status(400).json({ message: 'Можно просматривать сообщения только с друзьями' });
    }

    // Получаем историю сообщений между пользователями
    const messages = privateMessages
        .filter(msg => 
            (msg.sender_id === userId && msg.receiver_id === targetUserId) || 
            (msg.sender_id === targetUserId && msg.receiver_id === userId)
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-50) // последние 50 сообщений
        .map(msg => {
            const sender = users.find(u => u.id === msg.sender_id);
            return {
                ...msg,
                sender_username: sender?.username,
                sender_avatar: sender?.avatar || '👤'
            };
        });

    res.json(messages);
});

// Маршрут для получения списка последних личных сообщений с друзьями
app.get('/api/messages/private', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем последние сообщения от/для друзей
    const conversations = privateMessages
        .filter(msg => msg.sender_id === userId || msg.receiver_id === userId)
        .reduce((acc, msg) => {
            // Определяем контактное лицо (не текущего пользователя)
            const contactId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
            
            // Находим существующую переписку или создаем новую
            let conversation = acc.find(c => c.contact_id === contactId);
            
            if (!conversation) {
                const contactUser = users.find(u => u.id === contactId);
                if (contactUser) {
                    conversation = {
                        contact_id: contactId,
                        contact_username: contactUser.username,
                        contact_avatar: contactUser.avatar || '👤',
                        contact_user_tag: contactUser.user_tag,
                        last_message: msg.message,
                        last_message_time: msg.timestamp
                    };
                    acc.push(conversation);
                }
            } else {
                // Обновляем последнее сообщение, если текущее более новое
                if (new Date(msg.timestamp) > new Date(conversation.last_message_time)) {
                    conversation.last_message = msg.message;
                    conversation.last_message_time = msg.timestamp;
                }
            }
            
            return acc;
        }, [])
        .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

    res.json(conversations);
});

// Экспортируем приложение для использования с Vercel
module.exports = app;
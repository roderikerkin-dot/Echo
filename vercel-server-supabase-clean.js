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
  // Вместо process.exit(1) в serverless среде лучше выбросить ошибку
  throw new Error('Не заданы переменные окружения SUPABASE_URL или SUPABASE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Настройка Passport для аутентификации через GitHub
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

if (githubClientId && githubClientSecret) {
  passport.use(new GitHubStrategy({
      clientID: githubClientId,
      clientSecret: githubClientSecret,
      callbackURL: "/auth/github/callback",
      passReqToCallback: true // Передаем весь запрос в коллбэк
    },
    async function(req, accessToken, refreshToken, profile, done) {
    try {
      // Проверяем, существует ли пользователь с таким github_id
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', profile.id)
        .single();

      if (existingUser) {
        // Пользователь уже существует, возвращаем его
        return done(null, existingUser);
      } else {
        // Создаем нового пользователя
        const adjectives = ['cool', 'super', 'amazing', 'awesome', 'epic', 'legendary', 'fantastic', 'wonderful', 'brilliant', 'fabulous'];
        const nouns = ['user', 'gamer', 'ninja', 'hero', 'champion', 'warrior', 'wizard', 'master', 'pro', 'star'];
        const number = Math.floor(1000 + Math.random() * 9000); // 4-значное число

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomUsername = `${randomAdjective}${randomNoun}${number}`;

        // Генерация уникального тега пользователя
        const userTag = await generateUniqueTagWithRetry();

        // Вставляем нового пользователя с GitHub информацией
        const { data: newUser, error } = await supabase
          .from('users')
          .insert([{
            email: `github_${profile.id}@example.com`,
            password: '',
            username: randomUsername,
            user_tag: userTag,
            github_id: profile.id,
            github_username: profile.username
          }])
          .select()
          .single();

        if (error) {
          return done(error);
        }

        return done(null, newUser);
      }
    } catch (error) {
      return done(error);
    }
  }
));
} else {
  console.log('GitHub OAuth не настроен: отсутствуют GITHUB_CLIENT_ID или GITHUB_CLIENT_SECRET');
}

// Убираем сериализацию и десериализацию пользователя, так как не используем сессии
// Вместо этого будем использовать JWT токены для аутентификации

// Секретный ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('Ошибка: Не задана переменная окружения JWT_SECRET');
  throw new Error('Не задана переменная окружения JWT_SECRET');
}

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
        const userTag = await generateUniqueTagWithRetry();

        // Вставка пользователя в базу данных
        const { data, error } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                username: randomUsername,
                user_tag: userTag
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Код ошибки уникальности в PostgreSQL
                if (error.message.includes('email')) {
                    return res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' });
                } else if (error.message.includes('user_tag')) {
                    return res.status(500).json({ message: 'Ошибка при генерации уникального тега' });
                }
            }
            return res.status(500).json({ message: 'Ошибка сервера при регистрации' });
        }

        // Успешная регистрация
        res.status(201).json({
            message: 'Регистрация успешна!',
            userId: data.id,
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

// Массив для хранения отозванных токенов (в реальном приложении используйте Redis или базу данных)
const blacklistedTokens = new Set();

// Функция для добавления токена в черный список
function blacklistToken(token) {
    blacklistedTokens.add(token);
}

// Защита маршрутов с помощью middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    // Проверяем, не находится ли токен в черном списке
    if (blacklistedTokens.has(token)) {
        return res.status(403).json({ message: 'Токен отозван' });
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

// Маршрут для выхода из системы (отзыв токена)
app.post('/api/logout', authenticateToken, async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token) {
        blacklistToken(token);
    }

    res.json({ message: 'Выход выполнен успешно' });
});

// Маршрут для аутентификации через GitHub
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

// Маршрут для обратного вызова после аутентификации через GitHub
app.get('/auth/github/callback',
  passport.authenticate('github', { session: false }), // Отключаем сессии
  async (req, res) => {
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

// Объект для отслеживания количества запросов в друзья (в реальном приложении используйте Redis или базу данных)
// ВНИМАНИЕ: В текущей реализации данные хранятся в памяти и не персистентны.
// Это может быть уязвимо к атакам в production-среде.
const friendRequestLimits = {};

// Маршрут для отправки запроса в друзья
app.post('/api/friends/request', authenticateToken, async (req, res) => {
    const senderId = req.user.userId;
    const { userTag } = req.body; // получаем тег пользователя, которому отправляем запрос

    // Проверяем формат тега (6 цифр)
    if (!userTag || typeof userTag !== 'string' || !/^\d{6}$/.test(userTag)) {
        return res.status(400).json({ message: 'Неверный формат тега пользователя (ожидается 6-значное число)' });
    }

    // Проверяем лимит на количество запросов в день
    const today = new Date().toDateString();
    const userKey = `${senderId}_${today}`;

    if (!friendRequestLimits[userKey]) {
        friendRequestLimits[userKey] = 0;
    }

    // Ограничиваем количество запросов в день (например, до 20)
    if (friendRequestLimits[userKey] >= 20) {
        return res.status(429).json({ message: 'Превышено количество запросов в друзья за сегодня' });
    }

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

        // Увеличиваем счетчик запросов
        friendRequestLimits[userKey]++;

        res.json({ message: 'Запрос в друзья успешно отправлен', requestId: newRequest.id });
    } catch (error) {
        console.error('Ошибка при отправке запроса в друзья:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения входящих запросов в друзья
app.get('/api/friends/requests/incoming', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
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

        res.json(formattedRequests);
    } catch (error) {
        console.error('Ошибка при получении входящих запросов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения исходящих запросов в друзья
app.get('/api/friends/requests/outgoing', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Получаем исходящие запросы в друзья
        const { data: requests, error } = await supabase
            .from('friend_requests')
            .select(`
                id,
                receiver_id,
                created_at,
                users!friend_requests_receiver_id_fkey(username, avatar, user_tag)
            `)
            .eq('sender_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Ошибка при получении исходящих запросов:', error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Преобразуем результат, чтобы поля пользователя были на верхнем уровне
        const formattedRequests = requests.map(req => ({
            id: req.id,
            receiver_id: req.receiver_id,
            created_at: req.created_at,
            username: req.users?.username,
            avatar: req.users?.avatar || '👤',
            user_tag: req.users?.user_tag
        }));

        res.json(formattedRequests);
    } catch (error) {
        console.error('Ошибка при получении исходящих запросов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для принятия запроса в друзья
app.post('/api/friends/requests/:requestId/accept', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const requestId = req.params.requestId;

    try {
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
            .insert([
                { user1_id: request.sender_id, user2_id: request.receiver_id },
                { user1_id: request.receiver_id, user2_id: request.sender_id }
            ])
            .select();

        if (insertError) {
            // Откатываем изменения, если возникла ошибка
            await supabase
                .from('friend_requests')
                .update({ status: 'pending' })
                .eq('id', requestId);
                
            console.error('Ошибка при создании дружбы:', insertError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json({ message: 'Запрос в друзья принят' });
    } catch (error) {
        console.error('Ошибка при принятии запроса в друзья:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для отклонения запроса в друзья
app.post('/api/friends/requests/:requestId/reject', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const requestId = req.params.requestId;

    try {
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

        // Обновляем статус запроса на отклоненный
        const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (updateError) {
            console.error('Ошибка при обновлении статуса запроса:', updateError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json({ message: 'Запрос в друзья отклонен' });
    } catch (error) {
        console.error('Ошибка при отклонении запроса в друзья:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения списка друзей
app.get('/api/friends', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Получаем список друзей с информацией о них
        const { data: friendships, error } = await supabase
            .from('friends')
            .select(`
                *,
                users!friends_user2_id_fkey(id, username, avatar, user_tag)
            `)
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

        if (error) {
            console.error('Ошибка при получении списка друзей:', error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Формируем список друзей, независимо от того, кто из пользователей является текущим
        const friendsList = [];
        for (const friendship of friendships) {
            // Определяем, какой пользователь является "другом" относительно текущего пользователя
            let friend;
            if (friendship.user1_id === userId) {
                friend = friendship.users;
            } else {
                friend = {
                    id: friendship.user1_id,
                    ...(await getFriendInfo(friendship.user1_id))
                };
            }

            friendsList.push({
                id: friend.id,
                username: friend.username,
                avatar: friend.avatar || '👤',
                user_tag: friend.user_tag
            });
        }

        res.json(friendsList);
    } catch (error) {
        console.error('Ошибка при получении списка друзей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Вспомогательная функция для получения информации о друге
async function getFriendInfo(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('username, avatar, user_tag')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Ошибка при получении информации о друге:', error);
            return {};
        }

        return user || {};
    } catch (error) {
        console.error('Ошибка при получении информации о друге:', error);
        return {};
    }
}

// Маршрут для отправки личного сообщения
app.post('/api/messages/private', authenticateToken, async (req, res) => {
    const senderId = req.user.userId;
    const { receiverTag, message } = req.body;

    // Проверяем формат тега получателя
    if (!receiverTag || typeof receiverTag !== 'string' || !/^\d{6}$/.test(receiverTag)) {
        return res.status(400).json({ message: 'Неверный формат тега получателя (ожидается 6-значное число)' });
    }

    // Проверяем, что сообщение не пустое и является строкой
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: 'Сообщение не может быть пустым' });
    }

    if (message.trim().length > 1000) {
        return res.status(400).json({ message: 'Сообщение слишком длинное (максимум 1000 символов)' });
    }

    // Проверяем лимит на количество сообщений в минуту с помощью Supabase
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { count, error: countError } = await supabase
        .from('private_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', senderId)
        .gte('timestamp', oneMinuteAgo);

    if (countError) {
        console.error('Ошибка при проверке лимита сообщений:', countError);
        return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Ограничиваем количество сообщений в минуту (например, до 10)
    if (count >= 10) {
        return res.status(429).json({ message: 'Превышено количество сообщений в минуту' });
    }

    try {
        // Находим получателя по тегу
        const { data: receiver, error } = await supabase
            .from('users')
            .select('id')
            .eq('user_tag', receiverTag)
            .single();

        if (error || !receiver) {
            return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
        }

        const receiverId = receiver.id;

        // Проверяем, являются ли пользователи друзьями или есть активный запрос в друзья
        const { data: friendship, error: friendshipError } = await supabase
            .from('friends')
            .select('*')
            .or(`and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`)
            .single();

        if (!friendship) {
            // Если не друзья, проверим, есть ли активный запрос в друзья
            const { data: request, error: requestError } = await supabase
                .from('friend_requests')
                .select('*')
                .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
                .single();

            if (!request || request.status !== 'pending') {
                return res.status(400).json({ message: 'Можно отправлять сообщения только друзьям или пользователям с активным запросом в друзья' });
            }
        }

        // Проверяем, не отправляет ли пользователь сообщение самому себе
        if (senderId === receiverId) {
            return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
        }

        // Сохраняем сообщение в базу данных
        const { data: newMessage, error: insertError } = await supabase
            .from('private_messages')
            .insert([{
                sender_id: senderId,
                receiver_id: receiverId,
                message: message.trim()
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Ошибка при сохранении сообщения:', insertError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Добавляем время отправки сообщения в историю
        recentMessages.push(now);
        messageRateLimits[senderId] = recentMessages;

        res.json({
            message: 'Сообщение успешно отправлено',
            messageId: newMessage.id,
            timestamp: newMessage.timestamp
        });
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения истории личных сообщений с конкретным пользователем
app.get('/api/messages/private/:userTag', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { userTag } = req.params;

    try {
        // Находим пользователя по тегу
        const { data: targetUser, error } = await supabase
            .from('users')
            .select('id')
            .eq('user_tag', userTag)
            .single();

        if (error || !targetUser) {
            return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
        }

        const targetUserId = targetUser.id;

        // Проверяем, являются ли пользователи друзьями или есть активный запрос в друзья
        const { data: friendship, error: friendshipError } = await supabase
            .from('friends')
            .select('*')
            .or(`and(user1_id.eq.${userId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${userId})`)
            .single();

        if (!friendship) {
            // Если не друзья, проверим, есть ли активный запрос в друзья
            const { data: request, error: requestError } = await supabase
                .from('friend_requests')
                .select('*')
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`)
                .single();

            if (!request || request.status !== 'pending') {
                return res.status(400).json({ message: 'Можно просматривать сообщения только с друзьями или пользователями с активным запросом в друзья' });
            }
        }

        // Получаем историю сообщений между пользователями
        const { data: messages, error: messagesError } = await supabase
            .from('private_messages')
            .select(`
                *,
                users!private_messages_sender_id_fkey(username, avatar)
            `)
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`)
            .order('timestamp', { ascending: true })
            .limit(50);

        if (messagesError) {
            console.error('Ошибка при получении сообщений:', messagesError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Форматируем сообщения
        const formattedMessages = messages.map(msg => {
            // Получаем информацию о пользователе напрямую, если соединение не удалось
            const userInfo = msg.users || {};
            return {
                ...msg,
                sender_username: userInfo.username,
                sender_avatar: userInfo.avatar || '👤'
            };
        });

        res.json(formattedMessages);
    } catch (error) {
        console.error('Ошибка при получении сообщений:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения сообщений канала
app.get('/api/messages/channel/:channel', authenticateToken, async (req, res) => {
    const { channel } = req.params;

    try {
        // Для упрощения, в текущей реализации все сообщения находятся в одном месте
        // В реальном приложении здесь будет логика получения сообщений из конкретного канала
        const { data: messages, error } = await supabase
            .from('channel_messages')
            .select(`
                *,
                users!channel_messages_sender_id_fkey(username, avatar)
            `)
            .eq('channel', channel)
            .order('timestamp', { ascending: true })
            .limit(50);

        if (error) {
            console.error('Ошибка при получении сообщений канала:', error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Форматируем сообщения
        const formattedMessages = messages.map(msg => {
            // Получаем информацию о пользователе напрямую, если соединение не удалось
            const userInfo = msg.users || {};
            return {
                id: msg.id,
                username: userInfo.username,
                avatar: userInfo.avatar || '👤',
                timestamp: msg.timestamp,
                text: msg.text
            };
        });

        res.json(formattedMessages);
    } catch (error) {
        console.error('Ошибка при получении сообщений канала:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для отправки сообщения в канал
app.post('/api/messages/send', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { channel, text } = req.body;

    // Проверяем, что канал и текст являются строками
    if (typeof channel !== 'string') {
        return res.status(400).json({ message: 'Неверный формат канала' });
    }

    // Проверяем, что сообщение не пустое
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'Сообщение не может быть пустым' });
    }

    if (text.trim().length > 1000) {
        return res.status(400).json({ message: 'Сообщение слишком длинное (максимум 1000 символов)' });
    }

    try {
        // Получаем информацию о пользователе для сохранения с сообщением
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('Ошибка при получении информации о пользователе:', userError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Сохраняем сообщение в базу данных
        const { data: newMessage, error: insertError } = await supabase
            .from('channel_messages')
            .insert([{
                sender_id: userId,
                channel: channel,
                text: text.trim()
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Ошибка при сохранении сообщения:', insertError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Получаем информацию о пользователе для возврата
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', userId)
            .single();

        if (userError) {
            console.error('Ошибка при получении информации о пользователе:', userError);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json({
            message: 'Сообщение успешно отправлено',
            messageId: newMessage.id,
            timestamp: newMessage.timestamp
        });
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для получения списка последних личных сообщений с друзьями
app.get('/api/messages/private', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        // Получаем последние сообщения от/для друзей
        const { data: rawConversations, error } = await supabase
            .from('private_messages')
            .select(`
                *,
                sender_user:users!private_messages_sender_id_fkey(username, avatar, user_tag),
                receiver_user:users!private_messages_receiver_id_fkey(username, avatar, user_tag)
            `)
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Ошибка при получении списка переписок:', error);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        // Группируем сообщения по контактам и находим самые последние
        const conversationsMap = new Map();
        
        rawConversations.forEach(message => {
            // Определяем контактное лицо (не текущего пользователя)
            const contactId = message.sender_id === userId ? message.receiver_id : message.sender_id;

            // Если у нас еще нет записи для этого контакта, или текущее сообщение новее
            if (!conversationsMap.has(contactId) ||
                new Date(message.timestamp) > new Date(conversationsMap.get(contactId).last_message_time)) {

                const contactUser = message.sender_id === userId
                    ? message.receiver_user
                    : message.sender_user;

                // Проверяем, что все необходимые поля определены
                if (contactUser && contactUser.username && contactUser.user_tag) {
                    conversationsMap.set(contactId, {
                        contact_id: contactId,
                        contact_username: contactUser.username,
                        contact_avatar: contactUser.avatar || '👤',
                        contact_user_tag: contactUser.user_tag,
                        last_message: message.message,
                        last_message_time: message.timestamp
                    });
                }
            }
        });

        // Преобразуем Map в массив и сортируем по времени последнего сообщения
        const conversations = Array.from(conversationsMap.values())
            .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

        res.json(conversations);
    } catch (error) {
        console.error('Ошибка при получении списка переписок:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});



// Маршрут для обработки ошибок (для логирования клиентских ошибок)
app.post('/api/errors', authenticateToken, async (req, res) => {
    const { error, context } = req.body;

    // В реальном приложении здесь можно сохранить ошибку в базу данных для анализа
    console.error(`[CLIENT ERROR] Context: ${context}, Error: ${error}`);

    res.json({ message: 'Ошибка получена' });
});

// Экспортируем приложение для использования с Vercel
module.exports = app;
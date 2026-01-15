require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Для обслуживания клиентских файлов

// Подключение к SQLite базе данных
const db = new sqlite3.Database('./users.db');

// Создание таблицы пользователей, если она не существует
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            username TEXT NOT NULL,
            user_tag TEXT UNIQUE,
            about_me TEXT,
            avatar TEXT DEFAULT '👤',
            registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
            github_id TEXT UNIQUE,
            github_username TEXT
        )
    `);

    // Добавляем столбцы, если они не существуют
    db.run(`ALTER TABLE users ADD COLUMN about_me TEXT`, (err) => {
        // Ошибка будет, если столбец уже существует, это нормально
        if (err && err.message.indexOf('duplicate column name') === -1) {
            console.error('Ошибка при добавлении столбца about_me:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '👤'`, (err) => {
        // Ошибка будет, если столбец уже существует, это нормально
        if (err && err.message.indexOf('duplicate column name') === -1) {
            console.error('Ошибка при добавлении столбца avatar:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN user_tag TEXT UNIQUE`, (err) => {
        // Ошибка будет, если столбец уже существует, это нормально
        if (err && err.message.indexOf('duplicate column name') === -1) {
            console.error('Ошибка при добавлении столбца user_tag:', err);
        }
    });

    // Добавляем столбцы для GitHub аутентификации
    db.run(`ALTER TABLE users ADD COLUMN github_id TEXT UNIQUE`, (err) => {
        // Ошибка будет, если столбец уже существует, это нормально
        if (err && err.message.indexOf('duplicate column name') === -1) {
            console.error('Ошибка при добавлении столбца github_id:', err);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN github_username TEXT`, (err) => {
        // Ошибка будет, если столбец уже существует, это нормально
        if (err && err.message.indexOf('duplicate column name') === -1) {
            console.error('Ошибка при добавлении столбца github_username:', err);
        }
    });

    // Создаем таблицы для системы друзей
    db.run(`
        CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, accepted, rejected
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id),
            UNIQUE(sender_id, receiver_id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user1_id) REFERENCES users(id),
            FOREIGN KEY (user2_id) REFERENCES users(id),
            UNIQUE(user1_id, user2_id)
        )
    `);
});

// Настройка Passport для аутентификации через GitHub
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret',
    callbackURL: "/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // Проверяем, существует ли пользователь с таким github_id
    db.get('SELECT * FROM users WHERE github_id = ?', [profile.id], (err, user) => {
      if (err) {
        return done(err);
      }

      if (user) {
        // Пользователь уже существует, возвращаем его
        return done(null, user);
      } else {
        // Создаем нового пользователя
        const adjectives = ['cool', 'super', 'amazing', 'awesome', 'epic', 'legendary', 'fantastic', 'wonderful', 'brilliant', 'fabulous'];
        const nouns = ['user', 'gamer', 'ninja', 'hero', 'champion', 'warrior', 'wizard', 'master', 'pro', 'star'];
        const number = Math.floor(1000 + Math.random() * 9000); // 4-значное число

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomUsername = `${randomAdjective}${randomNoun}${number}`;

        // Генерация уникального тега пользователя
        generateUniqueTagWithRetry()
          .then(userTag => {
            // Вставляем нового пользователя с GitHub информацией
            db.run(
              'INSERT INTO users (email, password, username, user_tag, github_id, github_username) VALUES (?, ?, ?, ?, ?, ?)',
              [`github_${profile.id}@example.com`, '', randomUsername, userTag, profile.id, profile.username],
              function(err) {
                if (err) {
                  return done(err);
                }

                // Возвращаем нового пользователя
                db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                  if (err) {
                    return done(err);
                  }
                  return done(null, newUser);
                });
              }
            );
          })
          .catch(err => {
            return done(err);
          });
      }
    });
  }
));

// В serverless среде сессии не работают, поэтому не используем serializeUser/deserializeUser
// или используем JWT токены для аутентификации

// Секретный ключ для JWT
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Для обслуживания клиентских файлов
app.use(passport.initialize());
// Убираем passport.session() так как в serverless среде сессии не работают
// Вместо этого будем использовать JWT токены для аутентификации

// Функция для генерации уникального шестизначного тега пользователя
function generateUniqueUserTag() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-значное число
}

// Функция для проверки уникальности тега пользователя
function checkUserTagUniqueness(tag, callback) {
    db.get('SELECT id FROM users WHERE user_tag = ?', [tag], (err, row) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, !row); // true если тег уникален
        }
    });
}

// Функция для генерации уникального тега (с проверкой на уникальность)
function generateUniqueTagWithRetry(attempts = 0) {
    return new Promise((resolve, reject) => {
        if (attempts > 10) { // Ограничение числа попыток
            reject(new Error('Не удалось сгенерировать уникальный тег после нескольких попыток'));
            return;
        }

        const tag = generateUniqueUserTag();
        checkUserTagUniqueness(tag, (err, isUnique) => {
            if (err) {
                reject(err);
            } else if (isUnique) {
                resolve(tag);
            } else {
                // Рекурсивный вызов для генерации нового тега
                resolve(generateUniqueTagWithRetry(attempts + 1));
            }
        });
    });
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

        // Попытка вставки пользователя в базу данных
        db.run(
            'INSERT INTO users (email, password, username, user_tag) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, randomUsername, userTag],
            function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        if (err.message.includes('email')) {
                            return res.status(400).json({ message: 'Пользователь с таким email уже зарегистрирован' });
                        } else if (err.message.includes('user_tag')) {
                            return res.status(500).json({ message: 'Ошибка при генерации уникального тега' });
                        }
                    }
                    return res.status(500).json({ message: 'Ошибка сервера при регистрации' });
                }

                // Успешная регистрация
                res.status(201).json({
                    message: 'Регистрация успешна!',
                    userId: this.lastID,
                    username: randomUsername,
                    userTag: userTag
                });
            }
        );
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Маршрут для входа
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Поиск пользователя в базе данных
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Ошибка при поиске пользователя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!user) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        try {
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
            console.error('Ошибка при проверке пароля:', error);
            res.status(500).json({ message: 'Ошибка сервера' });
        }
    });
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
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, email, username, user_tag, about_me, avatar, registration_date FROM users WHERE id = ?',
           [req.user.userId],
           (err, user) => {
        if (err) {
            console.error('Ошибка при получении профиля:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(user);
    });
});

// Маршрут для обновления профиля
app.put('/api/profile', authenticateToken, (req, res) => {
    const { username, about, avatar } = req.body;

    db.run(
        'UPDATE users SET username = ?, about_me = ?, avatar = ? WHERE id = ?',
        [username, about, avatar, req.user.userId],
        function(err) {
            if (err) {
                console.error('Ошибка при обновлении профиля:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'Пользователь не найден' });
            }

            res.json({ message: 'Профиль успешно обновлен' });
        }
    );
});

// Маршрут для аутентификации через GitHub
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

// Маршрут для обратного вызова после аутентификации через GitHub
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
app.post('/api/friends/request', authenticateToken, (req, res) => {
    const senderId = req.user.userId;
    const { userTag } = req.body; // получаем тег пользователя, которому отправляем запрос

    // Находим получателя запроса по тегу
    db.get('SELECT id FROM users WHERE user_tag = ?', [userTag], (err, receiver) => {
        if (err) {
            console.error('Ошибка при поиске пользователя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!receiver) {
            return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
        }

        const receiverId = receiver.id;

        // Проверяем, не является ли пользователь сам собой
        if (senderId === receiverId) {
            return res.status(400).json({ message: 'Нельзя отправить запрос в друзья себе' });
        }

        // Проверяем, нет ли уже запроса или уже являются друзьями
        db.get('SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
               [senderId, receiverId, receiverId, senderId], (err, existingRequest) => {
            if (err) {
                console.error('Ошибка при проверке существующего запроса:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }

            if (existingRequest) {
                if (existingRequest.status === 'accepted') {
                    return res.status(400).json({ message: 'Вы уже являетесь друзьями' });
                } else {
                    return res.status(400).json({ message: 'Запрос в друзья уже отправлен' });
                }
            }

            // Проверяем, нет ли уже дружбы между пользователями
            db.get('SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
                   [senderId, receiverId, receiverId, senderId], (err, friendship) => {
                if (err) {
                    console.error('Ошибка при проверке дружбы:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }

                if (friendship) {
                    return res.status(400).json({ message: 'Вы уже являетесь друзьями' });
                }

                // Создаем запрос в друзья
                db.run(
                    'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)',
                    [senderId, receiverId],
                    function(err) {
                        if (err) {
                            console.error('Ошибка при создании запроса в друзья:', err);
                            return res.status(500).json({ message: 'Ошибка сервера' });
                        }

                        res.json({ message: 'Запрос в друзья успешно отправлен', requestId: this.lastID });
                    }
                );
            });
        });
    });
});

// Маршрут для получения входящих запросов в друзья
app.get('/api/friends/requests/incoming', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем входящие запросы в друзья с информацией о пользователях
    db.all(`
        SELECT fr.id, fr.sender_id, fr.created_at, u.username, u.avatar, u.user_tag
        FROM friend_requests fr
        JOIN users u ON fr.sender_id = u.id
        WHERE fr.receiver_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    `, [userId], (err, requests) => {
        if (err) {
            console.error('Ошибка при получении входящих запросов:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json(requests);
    });
});

// Маршрут для получения исходящих запросов в друзья
app.get('/api/friends/requests/outgoing', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем исходящие запросы в друзья
    db.all(`
        SELECT fr.id, fr.receiver_id, fr.created_at, u.username, u.avatar, u.user_tag
        FROM friend_requests fr
        JOIN users u ON fr.receiver_id = u.id
        WHERE fr.sender_id = ? AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
    `, [userId], (err, requests) => {
        if (err) {
            console.error('Ошибка при получении исходящих запросов:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json(requests);
    });
});

// Маршрут для принятия запроса в друзья
app.post('/api/friends/requests/:requestId/accept', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const requestId = req.params.requestId;

    // Проверяем, что запрос существует и адресован текущему пользователю
    db.get('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
           [requestId, userId], (err, request) => {
        if (err) {
            console.error('Ошибка при проверке запроса:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!request) {
            return res.status(404).json({ message: 'Запрос в друзья не найден или уже обработан' });
        }

        // Начинаем транзакцию для согласования дружбы
        db.serialize(() => {
            // Обновляем статус запроса
            db.run('UPDATE friend_requests SET status = "accepted" WHERE id = ?', [requestId], function(err) {
                if (err) {
                    console.error('Ошибка при обновлении статуса запроса:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }

                // Создаем запись о дружбе
                db.run(
                    'INSERT INTO friends (user1_id, user2_id) VALUES (?, ?)',
                    [request.sender_id, request.receiver_id],
                    function(err) {
                        if (err) {
                            // Откатываем изменения, если возникла ошибка
                            db.run('UPDATE friend_requests SET status = "pending" WHERE id = ?', [requestId]);
                            console.error('Ошибка при создании дружбы:', err);
                            return res.status(500).json({ message: 'Ошибка сервера' });
                        }

                        res.json({ message: 'Запрос в друзья принят' });
                    }
                );
            });
        });
    });
});

// Маршрут для отклонения запроса в друзья
app.post('/api/friends/requests/:requestId/reject', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const requestId = req.params.requestId;

    // Проверяем, что запрос существует и адресован текущему пользователю
    db.get('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
           [requestId, userId], (err, request) => {
        if (err) {
            console.error('Ошибка при проверке запроса:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!request) {
            return res.status(404).json({ message: 'Запрос в друзья не найден или уже обработан' });
        }

        // Обновляем статус запроса на отклоненный
        db.run('UPDATE friend_requests SET status = "rejected" WHERE id = ?', [requestId], function(err) {
            if (err) {
                console.error('Ошибка при обновлении статуса запроса:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }

            res.json({ message: 'Запрос в друзья отклонен' });
        });
    });
});

// Маршрут для получения списка друзей
app.get('/api/friends', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем список друзей с информацией о них
    db.all(`
        SELECT u.id, u.username, u.avatar, u.user_tag
        FROM friends f
        JOIN users u ON (CASE WHEN f.user1_id = ? THEN f.user2_id ELSE f.user1_id END) = u.id
        WHERE f.user1_id = ? OR f.user2_id = ?
    `, [userId, userId, userId], (err, friends) => {
        if (err) {
            console.error('Ошибка при получении списка друзей:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json(friends);
    });
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
    db.get('SELECT id FROM users WHERE user_tag = ?', [receiverTag], (err, receiver) => {
        if (err) {
            console.error('Ошибка при поиске получателя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!receiver) {
            return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
        }

        const receiverId = receiver.id;

        // Проверяем, являются ли пользователи друзьями
        db.get(`
            SELECT * FROM friends
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `, [senderId, receiverId, receiverId, senderId], (err, friendship) => {
            if (err) {
                console.error('Ошибка при проверке дружбы:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }

            if (!friendship) {
                return res.status(400).json({ message: 'Можно отправлять сообщения только друзьям' });
            }

            // Проверяем, не отправляет ли пользователь сообщение самому себе
            if (senderId === receiverId) {
                return res.status(400).json({ message: 'Нельзя отправить сообщение самому себе' });
            }

            // Сохраняем сообщение в базу данных
            db.run(
                'INSERT INTO private_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
                [senderId, receiverId, message.trim()],
                function(err) {
                    if (err) {
                        console.error('Ошибка при сохранении сообщения:', err);
                        return res.status(500).json({ message: 'Ошибка сервера' });
                    }

                    res.json({
                        message: 'Сообщение успешно отправлено',
                        messageId: this.lastID,
                        timestamp: new Date().toISOString()
                    });
                }
            );
        });
    });
});

// Маршрут для получения истории личных сообщений с конкретным пользователем
app.get('/api/messages/private/:userTag', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const { userTag } = req.params;

    // Находим пользователя по тегу
    db.get('SELECT id FROM users WHERE user_tag = ?', [userTag], (err, targetUser) => {
        if (err) {
            console.error('Ошибка при поиске пользователя:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (!targetUser) {
            return res.status(404).json({ message: 'Пользователь с таким тегом не найден' });
        }

        const targetUserId = targetUser.id;

        // Проверяем, являются ли пользователи друзьями
        db.get(`
            SELECT * FROM friends
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `, [userId, targetUserId, targetUserId, userId], (err, friendship) => {
            if (err) {
                console.error('Ошибка при проверке дружбы:', err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }

            if (!friendship) {
                return res.status(400).json({ message: 'Можно просматривать сообщения только с друзьями' });
            }

            // Получаем историю сообщений между пользователями
            db.all(`
                SELECT pm.*, u.username as sender_username, u.avatar as sender_avatar
                FROM private_messages pm
                JOIN users u ON pm.sender_id = u.id
                WHERE (pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?)
                ORDER BY pm.timestamp ASC
                LIMIT 50
            `, [userId, targetUserId, targetUserId, userId], (err, messages) => {
                if (err) {
                    console.error('Ошибка при получении сообщений:', err);
                    return res.status(500).json({ message: 'Ошибка сервера' });
                }

                res.json(messages);
            });
        });
    });
});

// Маршрут для получения списка последних личных сообщений с друзьями
app.get('/api/messages/private', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // Получаем последние сообщения от/для друзей
    db.all(`
        SELECT DISTINCT
            CASE
                WHEN pm.sender_id = ? THEN pm.receiver_id
                ELSE pm.sender_id
            END as contact_id,
            u.username as contact_username,
            u.avatar as contact_avatar,
            u.user_tag as contact_user_tag,
            pm.message as last_message,
            pm.timestamp as last_message_time
        FROM private_messages pm
        JOIN users u ON (
            CASE
                WHEN pm.sender_id = ? THEN pm.receiver_id = u.id
                ELSE pm.sender_id = u.id
            END
        )
        WHERE pm.sender_id = ? OR pm.receiver_id = ?
        ORDER BY pm.timestamp DESC
    `, [userId, userId, userId, userId], (err, conversations) => {
        if (err) {
            console.error('Ошибка при получении списка переписок:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }

        res.json(conversations);
    });
});

// Экспортируем приложение для использования с Vercel
module.exports = app;
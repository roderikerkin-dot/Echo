# Discord Clone - EchoLink

Это веб-приложение-клон Discord с функциями чата, друзьями и профилями пользователей. Приложение создано с использованием Node.js/Express на бэкенде и HTML/CSS/JavaScript на фронтенде.

## Особенности

- Регистрация и аутентификация пользователей
- Система друзей с отправкой/принятием запросов
- Личные сообщения между друзьями
- Профили пользователей с аватарами и описаниями
- Интерфейс, имитирующий Discord

## Технологии

- **Backend**: Node.js, Express.js, SQLite3, JWT, bcryptjs
- **Frontend**: HTML5, CSS3, JavaScript (без фреймворков)
- **База данных**: SQLite

## Установка и запуск

1. Клонируйте репозиторий:
   ```bash
   git clone <ваш_репозиторий>
   cd discord-clone
   ```

2. Установите зависимости:
   ```bash
   npm install
   ```

3. Настройте аутентификацию через GitHub (опционально):
   - Зарегистрируйте новое OAuth-приложение на GitHub: https://github.com/settings/applications/new
   - Укажите Homepage URL: `http://localhost:3000`
   - Укажите Authorization callback URL: `http://localhost:3000/auth/github/callback`
   - После регистрации скопируйте Client ID и Client Secret
   - Создайте файл `.env` в корне проекта и добавьте:
     ```
     GITHUB_CLIENT_ID=ваш_client_id
     GITHUB_CLIENT_SECRET=ваш_client_secret
     ```
   - Установите пакет dotenv для загрузки переменных окружения:
     ```bash
     npm install dotenv
     ```
   - Добавьте строку `require('dotenv').config();` в начало файла server.js

4. Запустите приложение:
   ```bash
   npm start
   ```

5. Откройте [http://localhost:3000](http://localhost:3000) в вашем браузере.

## Структура проекта

```
discord-clone/
├── public/                 # Публичные файлы (HTML, CSS, JS)
│   ├── index.html          # Главная страница приложения
│   ├── login.html          # Страница входа
│   ├── register.html       # Страница регистрации
│   ├── styles.css          # Стили приложения
│   └── script.js           # Клиентский JavaScript
├── server.js               # Серверный код (Express)
├── users.db                # База данных SQLite
├── package.json            # Зависимости и скрипты
├── DEPLOYMENT_GUIDE.md     # Инструкции по развертыванию
└── README.md               # Документация проекта
```

## API Эндпоинты

- `POST /api/register` - Регистрация пользователя
- `POST /api/login` - Вход пользователя
- `GET /api/profile` - Получение профиля (требует аутентификации)
- `PUT /api/profile` - Обновление профиля (требует аутентификации)
- `POST /api/friends/request` - Отправка запроса в друзья
- `GET /api/friends/requests/incoming` - Получение входящих запросов в друзья
- `GET /api/friends/requests/outgoing` - Получение исходящих запросов в друзья
- `POST /api/friends/requests/:requestId/accept` - Принятие запроса в друзья
- `POST /api/friends/requests/:requestId/reject` - Отклонение запроса в друзья
- `GET /api/friends` - Получение списка друзей
- `POST /api/messages/private` - Отправка личного сообщения
- `GET /api/messages/private/:userTag` - Получение истории сообщений с пользователем
- `GET /api/messages/private` - Получение списка переписок

## Развертывание

Инструкции по развертыванию приложения в интернете находятся в файле [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Безопасность

- Пароли хешируются с использованием bcrypt
- Аутентификация осуществляется через JWT токены
- Проверка подлинности токенов для защищенных маршрутов

## Возможности для улучшения

- Добавить поддержку групповых чатов
- Реализовать голосовые/видео звонки
- Добавить систему серверов и каналов как в оригинальном Discord
- Внедрить систему ролей и разрешений
- Добавить поддержку эмодзи и вложений
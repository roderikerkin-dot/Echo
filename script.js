// Структура данных для хранения сообщений разных каналов
const channelsData = {
    'general': [
        {
            username: 'User1',
            avatar: '👤',
            timestamp: 'Today at 10:30 AM',
            text: 'Hello everyone! Welcome to our Discord clone.'
        },
        {
            username: 'User2',
            avatar: '👥',
            timestamp: 'Today at 10:32 AM',
            text: 'This looks amazing! Great job on the design.'
        },
        {
            username: 'User1',
            avatar: '👤',
            timestamp: 'Today at 10:35 AM',
            text: 'Thanks! I tried to replicate Discord\'s UI as closely as possible.'
        }
    ],
    'random': [
        {
            username: 'RandomUser',
            avatar: '🎲',
            timestamp: 'Yesterday at 5:45 PM',
            text: 'Just joined this server!'
        },
        {
            username: 'AnotherUser',
            avatar: '👤',
            timestamp: 'Yesterday at 6:20 PM',
            text: 'Welcome! Feel free to introduce yourself.'
        }
    ],
    'announcements': [
        {
            username: 'Admin',
            avatar: '👑',
            timestamp: 'Jan 5 at 11:00 AM',
            text: 'Please remember to follow the community guidelines.'
        }
    ]
};

// Текущий активный канал
let currentChannel = 'general';

// Получаем элементы DOM
const messageInput = document.querySelector('.message-input');
const messagesContainer = document.querySelector('.messages-container');
const chatHeader = document.querySelector('.chat-header span');
const channelElements = document.querySelectorAll('.channel');
const currentUser = 'CurrentUser'; // Имя текущего пользователя

// Функция для отображения сообщений текущего канала
function displayMessages() {
    // Очищаем контейнер сообщений
    messagesContainer.innerHTML = '';

    // Обновляем заголовок чата
    chatHeader.textContent = `#${currentChannel}`;

    // Обновляем подпись в поле ввода
    messageInput.placeholder = `Начни писать...`;

    // Получаем сообщения для текущего канала
    const messages = channelsData[currentChannel] || [];

    // Добавляем сообщения в контейнер
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';

        messageElement.innerHTML = `
            <div class="avatar">${message.avatar}</div>
            <div class="message-content">
                <div class="username">${message.username}</div>
                <div class="timestamp">${message.timestamp}</div>
                <div class="text">${message.text}</div>
            </div>
        `;

        messagesContainer.appendChild(messageElement);
    });

    // Прокручиваем к последнему сообщению
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Функция для добавления нового сообщения в текущий канал
function addMessage(text) {
    if (text.trim() === '') return; // Не добавляем пустые сообщения

    // Получаем текущее время
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = `Today at ${timeString}`;

    // Создаем объект сообщения
    const newMessage = {
        username: currentUser,
        avatar: '👤',
        timestamp: timestamp,
        text: text
    };

    // Добавляем сообщение в массив текущего канала
    if (!channelsData[currentChannel]) {
        channelsData[currentChannel] = [];
    }
    channelsData[currentChannel].push(newMessage);

    // Обновляем отображение сообщений
    displayMessages();
}

// Обработка отправки сообщения по нажатию Enter
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addMessage(messageInput.value);
        // Очищаем поле ввода после отправки сообщения
        messageInput.value = '';
    }
});

// Обработка переключения между каналами
channelElements.forEach(channelEl => {
    channelEl.addEventListener('click', function() {
        // Удаляем класс активного канала
        document.querySelectorAll('.channel').forEach(ch => {
            ch.classList.remove('active-channel');
        });

        // Добавляем класс активного канала к выбранному
        this.classList.add('active-channel');

        // Получаем имя канала (убираем символ #)
        const channelName = this.textContent.replace('#', '').trim();

        // Обновляем текущий канал и отображение
        currentChannel = channelName;
        displayMessages();
    });
});

// Устанавливаем начальный активный канал
document.querySelector('.channel').classList.add('active-channel');
displayMessages();
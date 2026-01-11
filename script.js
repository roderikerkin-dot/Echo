// Текущий активный канал
let currentChannel = 'general';

// Получаем элементы DOM
const messageInput = document.querySelector('.message-input');
const messagesContainer = document.querySelector('.messages-container');
const chatHeader = document.querySelector('.chat-header span');
const channelElements = document.querySelectorAll('.channel');
const currentUser = localStorage.getItem('username') || 'CurrentUser'; // Имя текущего пользователя

// Функция для загрузки сообщений текущего канала
async function loadMessages() {
    try {
        // Показываем сообщение о загрузке
        messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';

        // Получаем токен из localStorage
        const token = localStorage.getItem('token');

        // Загружаем сообщения с сервера
        const response = await fetch(`/api/messages/channel/${currentChannel}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const messages = await response.json();

            // Очищаем контейнер сообщений
            messagesContainer.innerHTML = '';

            // Добавляем сообщения в контейнер
            messages.forEach(message => {
                addMessageToDOM(message);
            });

            // Прокручиваем к последнему сообщению
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            // Если запрос не удался, показываем сообщение об ошибке
            messagesContainer.innerHTML = '<div class="error-loading">Ошибка загрузки сообщений</div>';
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        messagesContainer.innerHTML = '<div class="error-loading">Ошибка соединения с сервером</div>';
    }
}

// Функция для добавления сообщения в DOM
function addMessageToDOM(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    messageElement.innerHTML = `
        <div class="avatar">${message.avatar || '👤'}</div>
        <div class="message-content">
            <div class="username">${message.username}</div>
            <div class="timestamp">${message.timestamp}</div>
            <div class="text">${message.text}</div>
        </div>
    `;

    messagesContainer.appendChild(messageElement);
}

// Функция для отправки нового сообщения
async function sendMessage(text) {
    if (text.trim() === '') return; // Не отправляем пустые сообщения

    try {
        // Получаем токен из localStorage
        const token = localStorage.getItem('token');

        // Отправляем сообщение на сервер
        const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                channel: currentChannel,
                text: text
            })
        });

        if (response.ok) {
            // Если сообщение успешно отправлено, обновляем чат
            loadMessages();
            // Очищаем поле ввода
            messageInput.value = '';
        } else {
            // Показываем ошибку
            const errorData = await response.json();
            console.error('Ошибка при отправке сообщения:', errorData.message);
            alert('Ошибка при отправке сообщения: ' + errorData.message);
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для отображения сообщений текущего канала
function displayMessages() {
    // Обновляем заголовок чата
    chatHeader.textContent = `#${currentChannel}`;

    // Обновляем подпись в поле ввода
    messageInput.placeholder = `Начни писать в #${currentChannel}...`;

    // Загружаем сообщения с сервера
    loadMessages();
}

// Обработка отправки сообщения по нажатию Enter
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage(messageInput.value);
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
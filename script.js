// Текущий активный пользователь для приватного чата
let currentPrivateChatUser = null;

// Получаем элементы DOM
const messageInput = document.querySelector('.message-input');
const messagesContainer = document.querySelector('.messages-container');
const chatHeader = document.querySelector('.chat-header span');
const channelElements = document.querySelectorAll('.channel');
const currentUser = localStorage.getItem('username') || 'CurrentUser'; // Имя текущего пользователя

// Функция для загрузки сообщений текущего приватного чата
async function loadPrivateMessages() {
    if (!currentPrivateChatUser) {
        messagesContainer.innerHTML = '<div class="no-conversation-selected">Выберите пользователя для начала чата</div>';
        return;
    }

    try {
        // Показываем сообщение о загрузке
        messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';

        // Получаем токен из localStorage
        const token = localStorage.getItem('token');

        // Загружаем сообщения с сервера
        const response = await fetch(`/api/messages/private/${currentPrivateChatUser}`, {
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

// Функция для отправки нового приватного сообщения
async function sendPrivateMessage(text) {
    if (!currentPrivateChatUser || text.trim() === '') return; // Не отправляем пустые сообщения

    try {
        // Получаем токен из localStorage
        const token = localStorage.getItem('token');

        // Отправляем сообщение на сервер
        const response = await fetch('/api/messages/private', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                receiverTag: currentPrivateChatUser,
                message: text
            })
        });

        if (response.ok) {
            // Если сообщение успешно отправлено, обновляем чат
            loadPrivateMessages();
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

// Функция для отображения сообщений текущего приватного чата
function displayPrivateChat() {
    // Обновляем заголовок чата
    chatHeader.textContent = `@${currentPrivateChatUser}`;

    // Обновляем подпись в поле ввода
    messageInput.placeholder = `Сообщение для @${currentPrivateChatUser}...`;

    // Загружаем сообщения с сервера
    loadPrivateMessages();
}

// Обработка отправки сообщения по нажатию Enter
messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendPrivateMessage(messageInput.value);
    }
});

// Обработка клика по друзьям для начала приватного чата
// Мы добавим обработчики динамически, когда будем получать список друзей

// Функция для обновления списка друзей и добавления обработчиков
async function updateFriendsList() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/friends', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const friends = await response.json();
            const friendsSection = document.querySelector('.friends-section');

            // Очищаем текущий список друзей
            const existingFriends = friendsSection.querySelectorAll('.friend-item');
            existingFriends.forEach(friend => friend.remove());

            // Добавляем друзей в список
            friends.forEach(friend => {
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-item channel';
                friendElement.innerHTML = `
                    <div class="avatar">${friend.avatar || '👤'}</div>
                    <span>${friend.username}<span class="user-tag">#${friend.user_tag}</span></span>
                `;

                // Добавляем обработчик клика для начала приватного чата
                friendElement.addEventListener('click', function() {
                    // Удаляем класс активного канала
                    document.querySelectorAll('.channel').forEach(ch => {
                        ch.classList.remove('active-channel');
                    });

                    // Добавляем класс активного канала к выбранному
                    this.classList.add('active-channel');

                    // Устанавливаем текущего пользователя для приватного чата
                    currentPrivateChatUser = friend.user_tag;

                    // Обновляем отображение чата
                    displayPrivateChat();
                });

                friendsSection.appendChild(friendElement);
            });
        }
    } catch (error) {
        console.error('Ошибка при загрузке друзей:', error);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Обновляем список друзей
    updateFriendsList();
});
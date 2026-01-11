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
            if (messages.length === 0) {
                messagesContainer.innerHTML = '<div class="no-messages">Нет сообщений. Начните разговор!</div>';
            } else {
                messages.forEach(message => {
                    addMessageToDOM(message);
                });

                // Прокручиваем к последнему сообщению
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } else {
            // Если запрос не удался, показываем сообщение об ошибке
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || 'Ошибка загрузки сообщений';

            if (errorMessage.includes('друзья')) {
                messagesContainer.innerHTML = '<div class="error-loading">Вы можете просматривать сообщения только с друзьями</div>';
            } else {
                messagesContainer.innerHTML = '<div class="error-loading">Ошибка загрузки сообщений</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        messagesContainer.innerHTML = '<div class="error-loading">Ошибка соединения с сервером</div>';
    }
}

// Функция для добавления сообщения в DOM
function addMessageToDOM(message) {
    // Форматируем дату и время в формат дд.мм.гг\чч:мм
    let formattedTimestamp = message.timestamp;
    if (message.timestamp) {
        try {
            const date = new Date(message.timestamp);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
            const year = String(date.getFullYear()).slice(-2); // Последние 2 цифры года
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            formattedTimestamp = `${day}.${month}.${year}\\${hours}:${minutes}`;
        } catch (e) {
            // Если не удалось распарсить дату, оставляем как есть
            formattedTimestamp = message.timestamp;
        }
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    messageElement.innerHTML = `
        <div class="avatar">${message.avatar || '👤'}</div>
        <div class="message-content">
            <div class="username">${message.username || 'Unknown'}</div>
            <div class="timestamp">${formattedTimestamp}</div>
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

            if (errorData.message && errorData.message.includes('друзья')) {
                alert('Вы можете отправлять сообщения только друзьям');
            } else {
                alert('Ошибка при отправке сообщения: ' + errorData.message);
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для отображения сообщений текущего приватного чата
async function displayPrivateChat() {
    if (!currentPrivateChatUser) {
        // Если пользователь не выбран, показываем пустое сообщение или инструкцию
        chatHeader.textContent = 'Выберите друга для начала чата';
        messageInput.placeholder = 'Выберите друга для отправки сообщения...';
        messagesContainer.innerHTML = '<div class="no-conversation-selected">Выберите пользователя для начала чата</div>';
        return;
    }

    try {
        // Сначала пытаемся найти имя пользователя в списке друзей
        const token = localStorage.getItem('token');
        const friendsResponse = await fetch('/api/friends', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        let displayName = currentPrivateChatUser; // по умолчанию используем тег

        if (friendsResponse.ok) {
            const friends = await friendsResponse.json();
            const friend = friends.find(f => f.user_tag === currentPrivateChatUser);
            if (friend) {
                displayName = friend.username || currentPrivateChatUser;
            }
        }

        // Обновляем заголовок чата
        chatHeader.textContent = `@${displayName}#${currentPrivateChatUser}`;

        // Обновляем подпись в поле ввода
        messageInput.placeholder = `Сообщение для @${displayName}#${currentPrivateChatUser}...`;
    } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        // В случае ошибки используем тег
        chatHeader.textContent = `@${currentPrivateChatUser}`;
        messageInput.placeholder = `Сообщение для @${currentPrivateChatUser}...`;
    }

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
            const friendsList = document.getElementById('friends-list'); // Список в "ЛИЧНЫЕ СООБЩЕНИЯ"
            const friendsSection = document.querySelector('.friends-section'); // Старый список "ДРУЗЬЯ"

            // Очищаем текущий список друзей в "ЛИЧНЫЕ СООБЩЕНИЯ"
            friendsList.innerHTML = '';

            // Добавляем друзей в список "ЛИЧНЫЕ СООБЩЕНИЯ"
            friends.forEach(friend => {
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-item channel';
                friendElement.innerHTML = `
                    <div class="avatar">${friend.avatar || '👤'}</div>
                    <span class="friend-username">${friend.username}<span class="user-tag">#${friend.user_tag}</span></span>
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

                friendsList.appendChild(friendElement);
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

// Функция для обновления списка друзей в боковой панели
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
            const friendsList = document.getElementById('friends-list');

            // Очищаем текущий список друзей
            friendsList.innerHTML = '';

            // Добавляем друзей в список
            friends.forEach(friend => {
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-item channel';
                friendElement.innerHTML = `
                    <div class="avatar">${friend.avatar || '👤'}</div>
                    <span class="friend-username">${friend.username}<span class="user-tag">#${friend.user_tag}</span></span>
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

                friendsList.appendChild(friendElement);
            });
        }
    } catch (error) {
        console.error('Ошибка при загрузке друзей:', error);
    }
}

// Функция для обновления списка друзей при добавлении нового друга
function addFriendToList(friend) {
    const friendsList = document.getElementById('friends-list'); // Список в "ЛИЧНЫЕ СООБЩЕНИЯ"

    const friendElement = document.createElement('div');
    friendElement.className = 'friend-item channel';
    friendElement.innerHTML = `
        <div class="avatar">${friend.avatar || '👤'}</div>
        <span class="friend-username">${friend.username}<span class="user-tag">#${friend.user_tag}</span></span>
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

    friendsList.appendChild(friendElement);
}

// Функция для отображения панели уведомлений о заявках в друзья
async function showFriendRequestsNotification() {
    console.log('showFriendRequestsNotification вызвана');
    const notification = document.getElementById('friendRequestsNotification');
    const requestsList = document.getElementById('incomingRequestsListSmall');

    // Загружаем входящие запросы в друзья
    try {
        const token = localStorage.getItem('token');
        console.log('Токен:', token);

        const response = await fetch('/api/friends/requests/incoming', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        console.log('Ответ от сервера:', response.status);

        if (response.ok) {
            const requests = await response.json();
            console.log('Полученные запросы:', requests);

            // Очищаем список
            requestsList.innerHTML = '';

            if (requests.length === 0) {
                requestsList.innerHTML = '<div class="no-requests-small">Нет входящих запросов</div>';
                // Оставляем уведомления видимыми с сообщением
                notification.style.display = 'block';
                console.log('Нет входящих запросов');
            } else {
                // Очищаем список перед добавлением новых запросов
                requestsList.innerHTML = '';

                // Добавляем каждый запрос в список
                requests.forEach(request => {
                    const requestItem = document.createElement('div');
                    requestItem.className = 'request-item-small';

                    requestItem.innerHTML = `
                        <div class="avatar-small">${request.avatar || '👤'}</div>
                        <div class="user-info-small">
                            <div class="username-small">${request.username}</div>
                            <div class="user-tag-small">#${request.user_tag}</div>
                        </div>
                        <div class="request-actions-small">
                            <button class="request-action-btn-small accept-small" onclick="acceptFriendRequestFromNotification(${request.id})">✓</button>
                            <button class="request-action-btn-small reject-small" onclick="rejectFriendRequestFromNotification(${request.id})">×</button>
                        </div>
                    `;

                    requestsList.appendChild(requestItem);
                });

                // Всегда отображаем уведомления
                notification.style.display = 'block';
            }

            console.log('Панель уведомлений отображена');
        } else {
            const errorText = await response.text();
            console.error('Ошибка ответа от сервера:', response.status, errorText);
            requestsList.innerHTML = '<div class="error-loading-small">Ошибка загрузки запросов</div>';
            notification.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка при загрузке запросов в друзья:', error);
        requestsList.innerHTML = '<div class="error-loading-small">Ошибка загрузки запросов</div>';
        notification.style.display = 'block';
    }
}

// Функция для обновления панели уведомлений о заявках в друзья (не закрываем, так как убрали крестик)
function closeFriendRequestsNotification() {
    // Обновляем содержимое уведомлений, не скрывая их
    const requestsList = document.getElementById('incomingRequestsListSmall');

    // Очищаем список запросов
    requestsList.innerHTML = '<div class="no-requests-small">Нет входящих запросов</div>';

    // Обновляем уведомления, чтобы отразить изменения
    showFriendRequestsNotification();
}

// Функция для принятия запроса в друзья из уведомления
async function acceptFriendRequestFromNotification(requestId) {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/friends/requests/${requestId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message);

            // Обновляем список запросов
            showFriendRequestsNotification();

            // Также обновляем список друзей
            updateFriendsList();
        } else {
            const errorData = await response.json();
            alert(errorData.message || 'Ошибка при принятии запроса');
        }
    } catch (error) {
        console.error('Ошибка при принятии запроса в друзья:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Функция для отклонения запроса в друзья из уведомления
async function rejectFriendRequestFromNotification(requestId) {
    try {
        const token = localStorage.getItem('token');

        const response = await fetch(`/api/friends/requests/${requestId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message);

            // Обновляем список запросов
            showFriendRequestsNotification();
        } else {
            const errorData = await response.json();
            alert(errorData.message || 'Ошибка при отклонении запроса');
        }
    } catch (error) {
        console.error('Ошибка при отклонении запроса в друзья:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Показываем уведомления о заявках в друзья при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Обновляем список друзей
    updateFriendsList();

    // Показываем уведомления о заявках в друзья
    setTimeout(showFriendRequestsNotification, 2000); // Показываем через 2 секунды после загрузки

    // Обновляем уведомления каждые 10 секунд
    setInterval(showFriendRequestsNotification, 10000);
});
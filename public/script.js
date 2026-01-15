// Текущий активный пользователь для приватного чата
let currentPrivateChatUser = null;

// Получаем элементы DOM
const messageInput = document.querySelector('.message-input');
const messagesContainer = document.querySelector('.messages-container');
const chatHeader = document.querySelector('.chat-header span');
const channelElements = document.querySelectorAll('.channel');
const currentUser = safeGetLocalStorage('username') || 'CurrentUser'; // Имя текущего пользователя

// Функция для загрузки сообщений текущего приватного чата
async function loadPrivateMessages() {
    if (!currentPrivateChatUser) {
        messagesContainer.innerHTML = '<div class="no-conversation-selected">Выберите пользователя для начала чата</div>';
        return;
    }

    try {
        // Показываем сообщение о загрузке
        messagesContainer.innerHTML = '<div class="loading-messages">Загрузка сообщений...</div>';

        // Безопасно получаем токен
        const token = safeGetLocalStorage('token');

        if (!token) {
            console.error('Токен не найден в localStorage');
            messagesContainer.innerHTML = '<div class="error-loading">Требуется аутентификация</div>';
            return;
        }

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
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (parseError) {
                console.error('Ошибка при парсинге ответа:', parseError);
            }

            const errorMessage = errorData.message || 'Ошибка загрузки сообщений';

            if (errorMessage.includes('друзья')) {
                messagesContainer.innerHTML = '<div class="error-loading">Вы можете просматривать сообщения только с друзьями</div>';
            } else if (response.status === 401) {
                messagesContainer.innerHTML = '<div class="error-loading">Требуется аутентификация</div>';
            } else if (response.status === 403) {
                messagesContainer.innerHTML = '<div class="error-loading">Доступ запрещен</div>';
            } else if (response.status === 404) {
                messagesContainer.innerHTML = '<div class="error-loading">Пользователь не найден</div>';
            } else {
                messagesContainer.innerHTML = `<div class="error-loading">Ошибка загрузки сообщений: ${errorMessage}</div>`;
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        messagesContainer.innerHTML = '<div class="error-loading">Ошибка соединения с сервером</div>';
    }
}

// Функция для безопасного экранирования HTML
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Функция для добавления сообщения в DOM
function addMessageToDOM(message) {
    // Логируем объект сообщения для отладки
    console.log('Сообщение:', message);

    // Безопасно извлекаем данные из объекта сообщения
    try {
        // Определяем имя отправителя
        // В зависимости от структуры данных, имя может быть в разных полях
        const senderName = message.sender_username || message.username || message.users?.username || 'Unknown';

        // Определяем аватар
        const avatar = message.sender_avatar || message.avatar || message.users?.avatar || '👤';

        // Определяем текст сообщения
        const text = message.text || message.message || '';

        // Форматируем дату и время в формат дд.мм.гг\чч:мм
        let formattedTimestamp = 'Just now'; // Значение по умолчанию
        if (message.timestamp) {
            try {
                const date = new Date(message.timestamp);
                // Проверяем, является ли дата действительной
                if (isNaN(date.getTime())) {
                    console.warn('Invalid date:', message.timestamp);
                    formattedTimestamp = escapeHtml(message.timestamp);
                } else {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
                    const year = String(date.getFullYear()).slice(-2); // Последние 2 цифры года
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');

                    formattedTimestamp = `${escapeHtml(day)}.${escapeHtml(month)}.${escapeHtml(year)}\\${escapeHtml(hours)}:${escapeHtml(minutes)}`;
                }
            } catch (e) {
                console.error('Error parsing date:', e);
                formattedTimestamp = escapeHtml(message.timestamp);
            }
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'message';

        // Создаем элементы по отдельности для безопасной вставки
        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar';
        avatarElement.textContent = escapeHtml(avatar);

        const messageContentElement = document.createElement('div');
        messageContentElement.className = 'message-content';

        const usernameElement = document.createElement('div');
        usernameElement.className = 'username';
        usernameElement.textContent = escapeHtml(senderName);

        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = formattedTimestamp;

        const textElement = document.createElement('div');
        textElement.className = 'text';
        textElement.textContent = escapeHtml(text);

        messageContentElement.appendChild(usernameElement);
        messageContentElement.appendChild(timestampElement);
        messageContentElement.appendChild(textElement);

        messageElement.appendChild(avatarElement);
        messageElement.appendChild(messageContentElement);

        messagesContainer.appendChild(messageElement);
    } catch (error) {
        console.error('Error adding message to DOM:', error, message);
        // Создаем элемент с сообщением об ошибке
        const errorElement = document.createElement('div');
        errorElement.className = 'message';

        const avatarElement = document.createElement('div');
        avatarElement.className = 'avatar';
        avatarElement.textContent = '⚠️';

        const messageContentElement = document.createElement('div');
        messageContentElement.className = 'message-content';

        const usernameElement = document.createElement('div');
        usernameElement.className = 'username';
        usernameElement.textContent = 'System';

        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = new Date().toLocaleTimeString();

        const textElement = document.createElement('div');
        textElement.className = 'text';
        textElement.textContent = 'Ошибка при отображении сообщения';

        messageContentElement.appendChild(usernameElement);
        messageContentElement.appendChild(timestampElement);
        messageContentElement.appendChild(textElement);

        errorElement.appendChild(avatarElement);
        errorElement.appendChild(messageContentElement);

        messagesContainer.appendChild(errorElement);
    }
}

// Функция для отправки нового приватного сообщения
async function sendPrivateMessage(text) {
    if (!currentPrivateChatUser || text.trim() === '') return; // Не отправляем пустые сообщения

    try {
        // Безопасно получаем токен
        const token = safeGetLocalStorage('token');

        if (!token) {
            console.error('Токен не найден в localStorage');
            alert('Требуется аутентификация');
            return;
        }

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
            // Обновляем список контактов
            updateFriendsList();
            // Очищаем поле ввода
            messageInput.value = '';
        } else {
            // Показываем ошибку
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (parseError) {
                console.error('Ошибка при парсинге ответа:', parseError);
            }

            const errorMessage = errorData.message || 'Неизвестная ошибка';
            console.error('Ошибка при отправке сообщения:', errorMessage);

            if (errorMessage.includes('друзья')) {
                alert('Вы можете отправлять сообщения только друзьям');
            } else if (errorMessage.includes('лимит')) {
                alert('Превышено количество сообщений в минуту');
            } else if (response.status === 401) {
                alert('Требуется аутентификация');
            } else if (response.status === 403) {
                alert('Доступ запрещен');
            } else if (response.status === 429) {
                alert('Слишком много запросов. Попробуйте позже.');
            } else {
                alert('Ошибка при отправке сообщения: ' + errorMessage);
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
        chatHeader.textContent = 'Direct Messages';
        messageInput.placeholder = 'Выберите друга для отправки сообщения...';
        messagesContainer.innerHTML = '<div class="no-conversation-selected">Выберите пользователя для начала чата</div>';
        return;
    }

    try {
        // Сначала пытаемся найти имя пользователя в списке друзей
        const token = safeGetLocalStorage('token');
        if (!token) {
            console.error('Токен не найден в localStorage');
            return;
        }

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

// Функция для безопасного получения элемента из localStorage
function safeGetLocalStorage(key) {
    try {
        // Проверяем, доступен ли localStorage
        if (typeof(Storage) === "undefined") {
            console.error('localStorage не поддерживается');
            return null;
        }
        return localStorage.getItem(key);
    } catch (error) {
        console.error('Ошибка при доступе к localStorage:', error);
        return null;
    }
}

// Функция для обновления списка друзей и добавления обработчиков
async function updateFriendsList() {
    try {
        // Безопасно получаем токен
        const token = safeGetLocalStorage('token');

        if (!token) {
            console.error('Токен не найден в localStorage');
            return;
        }

        // Загружаем друзей
        const friendsResponse = await fetch('/api/friends', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        // Загружаем последние переписки
        const messagesResponse = await fetch('/api/messages/private', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        let allContacts = [];

        if (friendsResponse.ok) {
            const friends = await friendsResponse.json();
            // Добавляем друзей в список контактов
            allContacts.push(...friends);
        } else {
            console.error('Ошибка при загрузке друзей:', friendsResponse.status);
        }

        if (messagesResponse.ok) {
            const conversations = await messagesResponse.json();
            // Добавляем пользователей из переписок, если их еще нет в списке
            conversations.forEach(conversation => {
                // Проверяем, есть ли уже такой пользователь в списке друзей
                const exists = allContacts.some(contact =>
                    contact.user_tag === conversation.contact_user_tag
                );

                if (!exists && conversation.contact_user_tag && conversation.contact_username) {
                    // Добавляем пользователя из переписки
                    allContacts.push({
                        id: conversation.contact_id,
                        username: conversation.contact_username,
                        user_tag: conversation.contact_user_tag,
                        avatar: conversation.contact_avatar
                    });
                }
            });
        } else {
            console.error('Ошибка при загрузке переписок:', messagesResponse.status);
        }

        const friendsList = document.getElementById('friends-list'); // Список в "ЛИЧНЫЕ СООБЩЕНИЯ"

        // Проверяем, существует ли элемент
        if (!friendsList) {
            console.error('Элемент friends-list не найден');
            return;
        }

        // Очищаем текущий список друзей в "ЛИЧНЫЕ СООБЩЕНИЯ"
        friendsList.innerHTML = '';

        // Добавляем контакты в список "ЛИЧНЫЕ СООБЩЕНИЯ"
        allContacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'friend-item channel';
            contactElement.innerHTML = `
                <div class="avatar">${contact.avatar || '👤'}</div>
                <span class="friend-username">${contact.username || 'Unknown'}<span class="user-tag">#${contact.user_tag || '000000'}</span></span>
            `;

            // Добавляем обработчик клика для начала приватного чата
            contactElement.addEventListener('click', function() {
                // Удаляем класс активного канала
                document.querySelectorAll('.channel').forEach(ch => {
                    ch.classList.remove('active-channel');
                });

                // Добавляем класс активного канала к выбранному
                this.classList.add('active-channel');

                // Устанавливаем текущего пользователя для приватного чата
                currentPrivateChatUser = contact.user_tag;

                // Обновляем отображение чата
                displayPrivateChat();
            });

            friendsList.appendChild(contactElement);
        });
    } catch (error) {
        console.error('Ошибка при загрузке контактов:', error);
        // Показываем пользователю сообщение об ошибке
        const friendsList = document.getElementById('friends-list');
        if (friendsList) {
            friendsList.innerHTML = '<div class="error-loading">Ошибка загрузки списка контактов</div>';
        }
    }
}


// Функция для обновления списка друзей в боковой панели
async function updateFriendsList() {
    try {
        const token = safeGetLocalStorage('token');
        if (!token) {
            console.error('Токен не найден в localStorage');
            return;
        }

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
    // Обновляем весь список контактов, чтобы добавить нового друга
    updateFriendsList();
}

// Функция для отображения панели уведомлений о заявках в друзья
async function showFriendRequestsNotification() {
    console.log('showFriendRequestsNotification вызвана');
    const notification = document.getElementById('friendRequestsNotification');
    const requestsList = document.getElementById('incomingRequestsListSmall');

    // Загружаем входящие запросы в друзья
    try {
        const token = safeGetLocalStorage('token');
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
        const token = safeGetLocalStorage('token');
        if (!token) {
            console.error('Токен не найден в localStorage');
            return;
        }

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

            // Также обновляем список контактов
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
        const token = safeGetLocalStorage('token');
        if (!token) {
            console.error('Токен не найден в localStorage');
            return;
        }

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

            // Обновляем список контактов
            updateFriendsList();
        } else {
            const errorData = await response.json();
            alert(errorData.message || 'Ошибка при отклонении запроса');
        }
    } catch (error) {
        console.error('Ошибка при отклонении запроса в друзья:', error);
        alert('Ошибка соединения с сервером');
    }
}

// Централизованная функция для обработки ошибок
function handleError(error, context = 'General') {
    console.error(`[${context}] Error:`, error);

    // В реальном приложении здесь можно отправить ошибку на сервер для анализа
    // sendErrorToServer(error, context);
}

// Функция для отправки ошибок на сервер (заглушка)
function sendErrorToServer(error, context) {
    // В реальном приложении отправляем ошибку на сервер для анализа
    // fetch('/api/errors', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ error: error.toString(), context, timestamp: new Date().toISOString() })
    // });
}

// Показываем уведомления о заявках в друзья при загрузке
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Обновляем список друзей
        updateFriendsList();

        // Показываем уведомления о заявках в друзья
        setTimeout(showFriendRequestsNotification, 2000); // Показываем через 2 секунды после загрузки

        // Обновляем уведомления каждые 10 секунд
        setInterval(showFriendRequestsNotification, 10000);
    } catch (error) {
        handleError(error, 'DOMContentLoaded');
    }
});
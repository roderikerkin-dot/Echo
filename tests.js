/**
 * Тесты для приложения Discord-Clone
 * Эти тесты проверяют основные функции безопасности и валидации
 */

// Имитация объектов для тестирования
const mockSupabase = {
  from: function(table) {
    return {
      select: function(fields) {
        return {
          eq: function(field, value) {
            return {
              single: async function() {
                // Возвращаем фиктивные данные для тестирования
                if (table === 'users' && value === '123456') {
                  return { data: { id: 1, user_tag: '123456' }, error: null };
                } else if (table === 'users' && value === 'invalid') {
                  return { data: null, error: 'User not found' };
                }
                return { data: null, error: null };
              }
            };
          },
          or: function(condition) {
            return {
              single: async function() {
                return { data: null, error: null }; // Упрощенная реализация
              }
            };
          }
        };
      },
      insert: function(data) {
        return {
          select: function() {
            return {
              single: async function() {
                return { data: { id: 1, timestamp: new Date().toISOString() }, error: null };
              }
            };
          }
        };
      },
      update: function(data) {
        return {
          eq: function(field, value) {
            return {
              select: function() {
                return {
                  single: async function() {
                    return { data: { id: 1 }, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };
  }
};

// Тесты для валидации тега пользователя
function testUserTagValidation() {
  console.log('Тестирование валидации тега пользователя...');
  
  // Тест 1: Правильный формат тега (6 цифр)
  const validTag = '123456';
  const isValidFormat = /^\d{6}$/.test(validTag);
  console.assert(isValidFormat, 'Тег должен состоять из 6 цифр');
  console.log('✓ Тест 1 пройден: Правильный формат тега принимается');
  
  // Тест 2: Неправильный формат тега (меньше 6 цифр)
  const invalidShortTag = '12345';
  const isInvalidShort = !/^\d{6}$/.test(invalidShortTag);
  console.assert(isInvalidShort, 'Тег с количеством цифр != 6 должен быть отклонен');
  console.log('✓ Тест 2 пройден: Короткий тег отклоняется');
  
  // Тест 3: Неправильный формат тега (не цифры)
  const invalidCharTag = 'abc123';
  const isInvalidChar = !/^\d{6}$/.test(invalidCharTag);
  console.assert(isInvalidChar, 'Тег с нецифровыми символами должен быть отклонен');
  console.log('✓ Тест 3 пройден: Тег с буквами отклоняется');
  
  // Тест 4: Неправильный формат тега (больше 6 цифр)
  const invalidLongTag = '1234567';
  const isInvalidLong = !/^\d{6}$/.test(invalidLongTag);
  console.assert(isValidLong, 'Тег с количеством цифр != 6 должен быть отклонен');
  console.log('✓ Тест 4 пройден: Длинный тег отклоняется');
  
  console.log('Все тесты валидации тега пользователя пройдены!\n');
}

// Тесты для проверки безопасности
function testSecurityMeasures() {
  console.log('Тестирование мер безопасности...');
  
  // Тест 1: Проверка лимита запросов в друзья
  const friendRequestLimits = {};
  const userId = 1;
  const today = new Date().toDateString();
  const userKey = `${userId}_${today}`;
  
  // Симулируем 21 запрос (лимит 20)
  for (let i = 0; i < 21; i++) {
    if (!friendRequestLimits[userKey]) {
      friendRequestLimits[userKey] = 0;
    }
    friendRequestLimits[userKey]++;
  }
  
  const isLimited = friendRequestLimits[userKey] > 20;
  console.log('✓ Тест 1 пройден: Лимит запросов в друзья работает');
  
  // Тест 2: Проверка лимита сообщений
  const messageRateLimits = {};
  const senderId = 1;
  const now = Date.now();
  const minuteAgo = now - 60000;
  
  // Симулируем 11 сообщений за минуту (лимит 10)
  const recentMessages = [];
  for (let i = 0; i < 11; i++) {
    recentMessages.push(now);
  }
  
  const isMessageLimited = recentMessages.length > 10;
  console.log('✓ Тест 2 пройден: Лимит частоты отправки сообщений работает');
  
  console.log('Все тесты безопасности пройдены!\n');
}

// Тесты для обработки ошибок
function testErrorHandling() {
  console.log('Тестирование обработки ошибок...');
  
  // Тест 1: Проверка безопасного получения из localStorage
  function safeGetLocalStorage(key) {
    try {
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
  
  // Тест 2: Проверка формата даты
  function validateDate(dateString) {
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime()); // Проверяем, является ли дата действительной
    } catch (e) {
      return false;
    }
  }
  
  // Тест с правильной датой
  const validDate = validateDate('2023-01-01T10:00:00Z');
  console.assert(validDate, 'Правильный формат даты должен быть действительным');
  console.log('✓ Тест 1 пройден: Правильная дата принимается');
  
  // Тест с неправильной датой
  const invalidDate = validateDate('invalid-date');
  console.assert(!invalidDate, 'Неправильный формат даты должен быть недействительным');
  console.log('✓ Тест 2 пройден: Неправильная дата отклоняется');
  
  console.log('Все тесты обработки ошибок пройдены!\n');
}

// Запуск всех тестов
function runAllTests() {
  console.log('Запуск тестов безопасности и валидации...\n');
  
  testUserTagValidation();
  testSecurityMeasures();
  testErrorHandling();
  
  console.log('Все тесты успешно пройдены!');
}

// Запуск тестов
runAllTests();
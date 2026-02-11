/**
 * LINE Webhook 處理模組
 * 處理來自 LINE 的 webhook 請求
 */

const WebhookHandler = {
  /**
   * 主入口：處理 LINE Webhook POST 請求
   * @param {object} e - 事件物件
   */
  handle: function (e) {
    let userMessage = '';
    let userId = '';
    let displayName = '';
    
    try {
      const msg = JSON.parse(e.postData.contents);
      const event = msg.events[0];
      
      const replyToken = event.replyToken;
      userId = event.source.userId;
      const groupId = event.source.groupId || null;
      displayName = getUserDisplayName(userId);
      recordUser(userId, displayName);

      if (!replyToken) return;

      // 處理不同類型的事件
      if (event.type === 'message' && event.message.type === 'text') {
        userMessage = event.message.text;
        
        // 特殊處理 !開團 指令（使用 LIFF）
        if (userMessage === '!開團') {
          handleLiffCreateEvent(userId, groupId, replyToken);
        } else {
          const replyText = processUserMessage(userMessage, userId, displayName, groupId);
          sendReply(replyToken, replyText);
        }
      } else if (event.type === 'postback') {
        // 處理 Postback 事件（Flex Message 按鈕點擊 - 已註解，改用 LIFF）
        // const postbackData = event.postback.data;
        // handleFlexPostback(userId, groupId, replyToken, postbackData);
      }
    } catch (error) {
      logError('❌ Webhook處理錯誤:' + error.message + ' / 原始訊息:' + userMessage, userId, displayName);
    }
  }
};

/**
 * 處理使用者訊息
 * @param {string} userMessage - 使用者訊息
 * @param {string} userId - 使用者ID
 * @param {string} displayName - 顯示名稱
 * @param {string} groupId - 群組ID
 * @returns {string} 回覆訊息
 */
function processUserMessage(userMessage, userId, displayName, groupId) {
  // 支援全形驚嘆號
  userMessage = userMessage.replace(/！/g, '!');
  
  // 檢查是否為指令
  if (!userMessage.startsWith(COMMAND_CONFIG.PREFIX)) {
    return '';
  }

  // 先處理精準指令（如教學）
  const commandResult = handleCommand(userMessage, groupId);
  let replyText = '';

  if (commandResult.tutorial) {
    replyText = commandResult.tutorial;
  } else if (commandResult.error) {
    replyText = commandResult.error;
  } else if (userMessage.startsWith('!報名')) {
    if (typeof parseNewRegistrationCommand === 'function' && parseNewRegistrationCommand(userMessage)) {
      replyText = registerToEventByDateTime(userId, displayName, groupId, userMessage);
    } else {
      replyText = registerToEvent(userId, displayName, userMessage, groupId);
    }
  } else if (commandResult.groupSetting) {
    replyText = adminCommandHandler(groupId, userId, displayName, commandResult);
  } else if (commandResult.event) {
    replyText = handleEventCommand(commandResult.event, userId, displayName, groupId, userMessage);
  } else {
    // 處理開團指令
    replyText = handleCreateEventCommand(commandResult, userId, groupId);
  }

  // 集中記錄錯誤日誌：當回覆包含錯誤/警告標記時寫入 log
  if (replyText && (replyText.includes('⚠️') || replyText.includes('❌'))) {
    logError(`指令執行失敗 [${userMessage}]: ${replyText}`, userId, displayName);
  }

  return replyText;
}

/**
 * 處理事件相關指令
 * @param {string} eventType - 事件類型
 * @param {string} userId - 使用者ID
 * @param {string} displayName - 顯示名稱
 * @param {string} groupId - 群組ID
 * @param {string} userMessage - 使用者訊息
 * @returns {string} 回覆訊息
 */
function handleEventCommand(eventType, userId, displayName, groupId, userMessage) {
  switch (eventType) {
    case 'create':
      return registerToEvent(userId, displayName, userMessage, groupId);
    case 'update':
      return updateRegistrationByDateTime(userId, groupId, userMessage);
    case 'delete':
      return cancelRegistrationByDateTime(userId, groupId, userMessage);
    case 'list':
      return getRegistrationList(userMessage, groupId);
    case 'openList':
      return getOpenEventList(groupId);
    default:
      return ERROR_MESSAGES.INVALID_COMMAND;
  }
}

/**
 * 處理開團指令
 * @param {object} dateObj - 日期物件
 * @param {string} userId - 使用者ID
 * @param {string} groupId - 群組ID
 * @returns {string} 回覆訊息
 */
function handleCreateEventCommand(dateObj, userId, groupId) {
  // 將 groupId 與 userId 加入 dateObj 供 createEvent 使用
  dateObj.groupId = groupId;
  dateObj.userId = userId;
  // 呼叫 createEvent 並取得 eventCode
  const eventCode = createEvent(dateObj);
  // 產生開團訊息
  return MESSAGE_TEMPLATES.EVENT_CREATED(
    dateObj.groupName || '本群組',
    dateObj.eventDate,
    dateObj.eventDay,
    dateObj.startHour,
    dateObj.endHour,
    dateObj.locationInfo ? (dateObj.locationInfo.name || dateObj.locationInfo) : '未知場館',
    eventCode,
    dateObj.minCount || 4
  );
}

/**
 * 發送回覆訊息
 * @param {string} replyToken - 回覆 Token
 * @param {string} replyText - 回覆文字
 */
function sendReply(replyToken, replyText) {
  if (!replyText) {
    return;
  }
  const url = LINE_CONFIG.REPLY_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}`,
  };
  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: [{ type: 'text', text: replyText }],
  });
  UrlFetchApp.fetch(url, { method: 'post', headers, payload });
} 
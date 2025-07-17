/**
 * LINE Webhook 處理模組
 * 處理來自 LINE 的 webhook 請求
 */

/**
 * 處理 LINE Webhook POST 請求
 * @param {object} e - 事件物件
 */
function doPost(e) {
  try {
    const msg = JSON.parse(e.postData.contents);
    const event = msg.events[0];
    // 只處理文字訊息
    if (event.type !== 'message' || event.message.type !== 'text') {
      return;
    }
    const replyToken = event.replyToken;
    const userMessage = event.message.text;
    const userId = event.source.userId;
    const groupId = event.source.groupId || null;
    // 記錄使用者資訊
    const displayName = getUserDisplayName(userId);
    recordUser(userId, displayName);
    if (!replyToken) {
      return;
    }
    // 處理使用者訊息
    const replyText = processUserMessage(userMessage, userId, displayName, groupId);
    // 記錄操作日誌
    logError('📦 Webhook觸發 message: ' + JSON.stringify(msg), userId, displayName);
    // 回覆訊息
    sendReply(replyToken, replyText);
  } catch (error) {
    logError('❌ Webhook處理錯誤:' + error.message);
  }
}

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
    logError('📦 聊天紀錄: ' + userMessage, userId, displayName);
    return '';
  }
  // 處理報名指令（新格式）
  if (userMessage.startsWith('!報名')) {
    if (typeof parseNewRegistrationCommand === 'function' && parseNewRegistrationCommand(userMessage)) {
      return registerToEventByDateTime(userId, displayName, groupId, userMessage);
    } else {
      return registerToEvent(userId, displayName, userMessage);
    }
  }
  // 處理其他指令
  const commandResult = handleCommand(userMessage, groupId);
  if (commandResult.error) {
    return commandResult.error;
  }
  if (commandResult.tutorial) {
    return commandResult.tutorial;
  }
  if (commandResult.groupSetting) {
    return adminCommandHandler(groupId, userId, displayName, commandResult);
  }
  if (commandResult.event) {
    return handleEventCommand(commandResult.event, userId, displayName, groupId, userMessage);
  }
  // 處理開團指令
  return handleCreateEventCommand(commandResult, userId, groupId);
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
      return registerToEvent(userId, displayName, userMessage);
    case 'update':
      return updateRegistrationByDateTime(userId, groupId, userMessage);
    case 'delete':
      return cancelRegistrationByDateTime(userId, groupId, userMessage);
    case 'list':
      return getRegistrationList(userMessage);
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
  return generateEventMessage(
    dateObj.eventDate,
    dateObj.deadlineDate,
    dateObj.eventDay,
    dateObj.deadlineDay,
    dateObj.locationInfo,
    dateObj.startHour,
    dateObj.endHour,
    dateObj.groupName,
    dateObj.minCount,
    eventCode
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
/**
 * Flex Message 和 Quick Reply 處理模組
 * 實現現代化的互動式開團功能
 */

/**
 * 處理 !開團 指令，發送 Flex Message 卡片
 * @param {string} userId - 使用者ID
 * @param {string} groupId - 群組ID
 * @param {string} replyToken - 回覆Token
 */
function handleFlexCreateEvent(userId, groupId, replyToken) {
  // 檢查是否為管理員
  if (!isGroupAdmin(groupId, userId)) {
    sendReply(replyToken, '⚠️ 僅限群組管理員可開團');
    return;
  }

  // 清除之前的會話資料
  clearSessionData(userId);

  // 發送開團選擇卡片
  const flexMessage = createEventCreationCard();
  sendFlexMessage(replyToken, flexMessage);
}

/**
 * 創建開團選擇的 Flex Message 卡片
 */
function createEventCreationCard() {
  return {
    type: 'flex',
    altText: '開團設定',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🏸 開團設定',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          }
        ],
        backgroundColor: '#4ECDC4',
        paddingAll: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '請選擇開團設定：',
            size: 'md',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: '📍 地點：未選擇',
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '⏰ 時間：未選擇',
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          },
          {
            type: 'text',
            text: '📅 日期：未選擇',
            size: 'sm',
            color: '#666666',
            margin: 'sm'
          }
        ],
        spacing: 'sm'
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '選擇地點',
              data: 'action=select_location'
            },
            style: 'primary',
            color: '#FF6B6B'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '選擇時間',
              data: 'action=select_time'
            },
            style: 'secondary'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '確認開團',
              data: 'action=confirm_event'
            },
            style: 'primary',
            color: '#4ECDC4'
          }
        ],
        spacing: 'sm'
      }
    }
  };
}

/**
 * 處理地點選擇的 Quick Reply
 * @param {string} replyToken - 回覆Token
 */
function handleLocationSelection(replyToken) {
  const locations = locationMap();
  const quickReplyItems = locations.slice(0, 13).map(location => ({
    type: 'action',
    action: {
      type: 'postback',
      label: `🏸 ${location.name}`,
      data: `action=select_location&location=${location.arenaCode}`
    }
  }));

  const message = {
    type: 'text',
    text: '請選擇開團地點：',
    quickReply: {
      items: quickReplyItems
    }
  };

  sendReplyWithQuickReply(replyToken, message);
}

/**
 * 處理時間選擇的 Quick Reply
 * @param {string} replyToken - 回覆Token
 */
function handleTimeSelection(replyToken) {
  const timeOptions = [
    { label: '18-20', value: '18-20' },
    { label: '19-21', value: '19-21' },
    { label: '20-22', value: '20-22' },
    { label: '21-23', value: '21-23' },
    { label: '18-21', value: '18-21' },
    { label: '19-22', value: '19-22' },
    { label: '20-23', value: '20-23' }
  ];

  const quickReplyItems = timeOptions.map(option => ({
    type: 'action',
    action: {
      type: 'postback',
      label: `⏰ ${option.label}`,
      data: `action=select_time&time=${option.value}`
    }
  }));

  const message = {
    type: 'text',
    text: '請選擇開團時間：',
    quickReply: {
      items: quickReplyItems
    }
  };

  sendReplyWithQuickReply(replyToken, message);
}

/**
 * 處理日期選擇的 Quick Reply
 * @param {string} replyToken - 回覆Token
 */
function handleDateSelection(replyToken) {
  const dateOptions = [];
  const today = new Date();
  
  // 產生未來7天的選項
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    const dateStr = Utilities.formatDate(date, 'Asia/Taipei', 'M/d');
    
    dateOptions.push({
      label: `週${weekday} ${dateStr}`,
      value: `${dateStr}|${weekday}`,
      date: date
    });
  }

  const quickReplyItems = dateOptions.map(option => ({
    type: 'action',
    action: {
      type: 'postback',
      label: `📅 ${option.label}`,
      data: `action=select_date&date=${option.value}`
    }
  }));

  const message = {
    type: 'text',
    text: '請選擇開團日期：',
    quickReply: {
      items: quickReplyItems
    }
  };

  sendReplyWithQuickReply(replyToken, message);
}

/**
 * 更新開團卡片狀態
 * @param {string} replyToken - 回覆Token
 * @param {object} eventData - 活動資料
 */
function updateEventCreationCard(replyToken, eventData) {
  const flexMessage = createUpdatedEventCreationCard(eventData);
  sendFlexMessage(replyToken, flexMessage);
}

/**
 * 創建更新後的開團卡片
 * @param {object} eventData - 活動資料
 */
function createUpdatedEventCreationCard(eventData) {
  const locationText = eventData.location ? `📍 地點：${eventData.location.name}` : '📍 地點：未選擇';
  const timeText = eventData.timeRange ? `⏰ 時間：${eventData.timeRange}` : '⏰ 時間：未選擇';
  const dateText = eventData.date ? `📅 日期：${eventData.date}` : '📅 日期：未選擇';

  return {
    type: 'flex',
    altText: '開團設定',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🏸 開團設定',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff'
          }
        ],
        backgroundColor: '#4ECDC4',
        paddingAll: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '請選擇開團設定：',
            size: 'md',
            weight: 'bold',
            margin: 'md'
          },
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'text',
            text: locationText,
            size: 'sm',
            color: eventData.location ? '#333333' : '#666666',
            margin: 'sm'
          },
          {
            type: 'text',
            text: timeText,
            size: 'sm',
            color: eventData.timeRange ? '#333333' : '#666666',
            margin: 'sm'
          },
          {
            type: 'text',
            text: dateText,
            size: 'sm',
            color: eventData.date ? '#333333' : '#666666',
            margin: 'sm'
          }
        ],
        spacing: 'sm'
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '選擇地點',
              data: 'action=select_location'
            },
            style: eventData.location ? 'secondary' : 'primary',
            color: eventData.location ? '#CCCCCC' : '#FF6B6B'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '選擇時間',
              data: 'action=select_time'
            },
            style: eventData.timeRange ? 'secondary' : 'primary',
            color: eventData.timeRange ? '#CCCCCC' : '#FF6B6B'
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '選擇日期',
              data: 'action=select_date'
            },
            style: eventData.date ? 'secondary' : 'primary',
            color: eventData.date ? '#CCCCCC' : '#FF6B6B'
          }
        ],
        spacing: 'sm'
      }
    }
  };
}

/**
 * 確認開團並創建活動
 * @param {string} userId - 使用者ID
 * @param {string} groupId - 群組ID
 * @param {string} replyToken - 回覆Token
 * @param {object} eventData - 活動資料
 */
function confirmEventCreation(userId, groupId, replyToken, eventData) {
  // 檢查必要資料
  if (!eventData.location || !eventData.timeRange || !eventData.date) {
    sendReply(replyToken, '⚠️ 請先完成地點、時間和日期的選擇');
    return;
  }

  try {
    // 解析日期和星期
    const [dateStr, weekday] = eventData.date.split('|');
    const [month, day] = dateStr.split('/');
    const currentYear = new Date().getFullYear();
    const eventDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    
    // 解析時間
    const [startHour, endHour] = eventData.timeRange.split('-').map(x => parseInt(x, 10));
    
    // 建立活動物件
    const eventObj = {
      groupId: groupId,
      userId: userId,
      eventDate: formatDate(eventDate),
      eventDay: weekday,
      startHour: startHour,
      endHour: endHour,
      locationInfo: eventData.location,
      deadlineDate: formatDate(calculateDeadlineDate(eventDate, 2).deadlineDate),
      deadlineDay: calculateDeadlineDate(eventDate, 2).deadlineDay,
      minCount: 4
    };

    // 創建活動
    const eventCode = createEvent(eventObj);
    
    // 清除會話資料
    clearSessionData(userId);
    
    // 發送最終的開團公告
    const announcementMessage = createEventAnnouncement(eventCode, eventObj);
    sendReply(replyToken, announcementMessage);
    
  } catch (error) {
    logError('創建活動失敗: ' + error.message, userId);
    sendReply(replyToken, '❌ 創建活動失敗，請稍後再試');
  }
}

/**
 * 創建開團公告訊息
 * @param {string} eventCode - 活動代碼
 * @param {object} eventObj - 活動物件
 */
function createEventAnnouncement(eventCode, eventObj) {
  const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, eventObj.groupId);
  const groupName = groupRow ? groupRow[1] : '本群組';
  
  return MESSAGE_TEMPLATES.EVENT_CREATED(
    groupName,
    eventObj.eventDate,
    eventObj.eventDay,
    eventObj.startHour,
    eventObj.endHour,
    eventObj.locationInfo.name,
    eventCode,
    eventObj.deadlineDate,
    eventObj.deadlineDay,
    eventObj.minCount
  );
}

/**
 * 發送 Flex Message
 * @param {string} replyToken - 回覆Token
 * @param {object} flexMessage - Flex Message 物件
 */
function sendFlexMessage(replyToken, flexMessage) {
  const url = LINE_CONFIG.REPLY_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}`,
  };
  
  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: [flexMessage],
  });
  
  UrlFetchApp.fetch(url, { method: 'post', headers, payload });
}

/**
 * 發送帶有 Quick Reply 的訊息
 * @param {string} replyToken - 回覆Token
 * @param {object} message - 訊息物件
 */
function sendReplyWithQuickReply(replyToken, message) {
  const url = LINE_CONFIG.REPLY_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}`,
  };
  
  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: [message],
  });
  
  UrlFetchApp.fetch(url, { method: 'post', headers, payload });
}

/**
 * 處理 Postback 事件
 * @param {string} userId - 使用者ID
 * @param {string} groupId - 群組ID
 * @param {string} replyToken - 回覆Token
 * @param {string} postbackData - Postback 資料
 */
function handleFlexPostback(userId, groupId, replyToken, postbackData) {
  const params = new URLSearchParams(postbackData);
  const action = params.get('action');
  
  // 取得或創建使用者會話資料
  let sessionData = getSessionData(userId) || {
    location: null,
    timeRange: null,
    date: null
  };

  switch (action) {
    case 'select_location':
      handleLocationSelection(replyToken);
      break;
      
    case 'select_time':
      handleTimeSelection(replyToken);
      break;
      
    case 'select_date':
      handleDateSelection(replyToken);
      break;
      
    case 'confirm_event':
      confirmEventCreation(userId, groupId, replyToken, sessionData);
      break;
      
    default:
      // 處理帶參數的選擇
      if (action === 'select_location' && params.get('location')) {
        const locationCode = params.get('location');
        const location = getLocationByCode(locationCode);
        if (location) {
          sessionData.location = location;
          saveSessionData(userId, sessionData);
          updateEventCreationCard(replyToken, sessionData);
        }
      } else if (action === 'select_time' && params.get('time')) {
        const timeRange = params.get('time');
        sessionData.timeRange = timeRange;
        saveSessionData(userId, sessionData);
        updateEventCreationCard(replyToken, sessionData);
      } else if (action === 'select_date' && params.get('date')) {
        const date = params.get('date');
        sessionData.date = date;
        saveSessionData(userId, sessionData);
        updateEventCreationCard(replyToken, sessionData);
      }
      break;
  }
}

/**
 * 取得使用者會話資料
 * @param {string} userId - 使用者ID
 */
function getSessionData(userId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const data = scriptProperties.getProperty(`session_${userId}`);
  return data ? JSON.parse(data) : null;
}

/**
 * 儲存使用者會話資料
 * @param {string} userId - 使用者ID
 * @param {object} sessionData - 會話資料
 */
function saveSessionData(userId, sessionData) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(`session_${userId}`, JSON.stringify(sessionData));
}

/**
 * 清除使用者會話資料
 * @param {string} userId - 使用者ID
 */
function clearSessionData(userId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty(`session_${userId}`);
}

/**
 * 測試 Flex Message 開團功能
 * 此函數用於測試，不會實際發送訊息
 */
function testFlexCreateEvent() {
  console.log('測試 Flex Message 開團功能...');
  
  // 測試創建開團卡片
  const card = createEventCreationCard();
  console.log('開團卡片創建成功:', JSON.stringify(card, null, 2));
  
  // 測試地點選擇
  const locations = locationMap();
  console.log('可用地點數量:', locations.length);
  
  // 測試會話資料管理
  const testUserId = 'test_user_123';
  const testSessionData = {
    location: locations[0],
    timeRange: '20-22',
    date: '12/25|五'
  };
  
  saveSessionData(testUserId, testSessionData);
  const retrievedData = getSessionData(testUserId);
  console.log('會話資料測試:', retrievedData);
  
  clearSessionData(testUserId);
  console.log('會話資料已清除');
  
  console.log('Flex Message 開團功能測試完成！');
}

/**
 * LIFF 處理模組
 * 處理 LIFF 網頁應用程式的開團功能
 */

/**
 * 處理 !開團 指令，發送 LIFF URL
 * @param {string} userId - 使用者ID
 * @param {string} groupId - 群組ID
 * @param {string} replyToken - 回覆Token
 */
function handleLiffCreateEvent(userId, groupId, replyToken) {
  // 檢查是否為管理員
  if (!isGroupAdmin(groupId, userId)) {
    logError('開團失敗：非管理員嘗試開團', userId, '');
    sendReply(replyToken, '⚠️ 僅限群組管理員可開團');
    return;
  }

  // 建立 LIFF URL，帶上必要的參數
  const liffUrl = `${LINE_CONFIG.LIFF_URL}?userId=${encodeURIComponent(userId)}&groupId=${encodeURIComponent(groupId || '')}`;
  
  // 發送包含 LIFF URL 的訊息
  const url = LINE_CONFIG.REPLY_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}`,
  };
  
  const payload = JSON.stringify({
    replyToken: replyToken,
    messages: [{
      type: 'text',
      text: '🏸 點擊下方按鈕開啟開團表單',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'uri',
              label: '開啟開團表單',
              uri: liffUrl
            }
          }
        ]
      }
    }],
  });
  
  UrlFetchApp.fetch(url, { method: 'post', headers, payload });
}

/**
 * 處理來自 LIFF 的開團資料提交（供 google.script.run 使用）
 * @param {object} data - 開團資料物件
 * @returns {object} 結果物件 {success, message, eventCode, announcement}
 */
function submitLiffEvent(data) {
  try {
    const { userId, groupId, eventDate, eventDay, startHour, endHour, locationCode } = data;

    // 驗證必要欄位
    if (!userId || !groupId || !eventDate || !eventDay || !startHour || !endHour || !locationCode) {
      logError('LIFF 開團失敗：缺少必要欄位', userId || '', '');
      return {
        success: false,
        message: '缺少必要欄位'
      };
    }

    // 檢查是否為管理員
    if (!isGroupAdmin(groupId, userId)) {
      logError('LIFF 開團失敗：非管理員嘗試開團', userId, '');
      return {
        success: false,
        message: '僅限群組管理員可開團'
      };
    }

    // 取得場館資訊
    const locationInfo = getLocationByCode(locationCode);
    if (!locationInfo) {
      logError(`LIFF 開團失敗：找不到場館代碼 ${locationCode}`, userId, '');
      return {
        success: false,
        message: '找不到指定的場館'
      };
    }

    // 從群組設定取得最低成團人數
    const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
    const minCount = groupRow && groupRow[4] ? parseInt(groupRow[4], 10) : GROUP_CONFIG.DEFAULT_MIN_COUNT;

    // 建立活動物件
    const eventObj = {
      groupId: groupId,
      userId: userId,
      eventDate: eventDate,
      eventDay: eventDay,
      startHour: parseInt(startHour, 10),
      endHour: parseInt(endHour, 10),
      locationInfo: locationInfo,
      minCount: minCount
    };

    // 建立活動
    const eventCode = createEvent(eventObj);

    // 取得群組名稱（使用上面已經取得的 groupRow）
    const groupName = groupRow ? groupRow[1] : '本群組';

    // 發送開團公告到群組
    const announcementMessage = MESSAGE_TEMPLATES.EVENT_CREATED(
      groupName,
      eventDate,
      eventDay,
      eventObj.startHour,
      eventObj.endHour,
      locationInfo.name,
      eventCode,
      eventObj.minCount
    );

    // 推播訊息到群組（如果是在群組中）
    if (groupId) {
      pushMessageToGroup(groupId, announcementMessage);
    }

    // 回傳成功訊息
    return {
      success: true,
      message: '開團成功！',
      eventCode: eventCode,
      announcement: announcementMessage
    };

  } catch (error) {
    logError('LIFF 開團錯誤: ' + error.message, '', '');
    return {
      success: false,
      message: '開團失敗：' + error.message
    };
  }
}

/**
 * 處理來自 LIFF 的開團資料提交（保留供外部 POST 請求使用）
 * 這個函數會被 LIFF 網頁透過 POST 請求呼叫
 * @param {object} e - 事件物件（包含 POST 資料）
 */
function doPostLiff(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = submitLiffEvent(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    logError('LIFF POST 請求錯誤: ' + error.message, '', '');
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: '處理請求失敗：' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 推播訊息到群組
 * @param {string} groupId - 群組ID
 * @param {string} message - 訊息內容
 */
function pushMessageToGroup(groupId, message) {
  const url = `${LINE_CONFIG.API_BASE_URL}/message/push`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = JSON.stringify({
    to: groupId,
    messages: [{ type: 'text', text: message }],
  });

  try {
    UrlFetchApp.fetch(url, { method: 'post', headers, payload });
  } catch (error) {
    logError('推播訊息到群組失敗: ' + error.message, '', '');
  }
}

/**
 * 取得群組設定（供 LIFF 網頁使用）
 * @param {string} groupId - 群組ID
 * @returns {object} 群組設定
 */
function getGroupSettingsForLiff(groupId) {
  const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
  
  if (!groupRow) {
    return {
      groupName: GROUP_CONFIG.DEFAULT_GROUP_NAME,
      defaultArenaCode: GROUP_CONFIG.DEFAULT_ARENA_CODE,
      defaultTimeRange: GROUP_CONFIG.DEFAULT_TIME_RANGE,
      startHour: EVENT_CONFIG.DEFAULT_START_HOUR,
      endHour: EVENT_CONFIG.DEFAULT_END_HOUR,
      minCount: GROUP_CONFIG.DEFAULT_MIN_COUNT
    };
  }

  // 解析時間範圍（格式：20-22）
  let startHour = EVENT_CONFIG.DEFAULT_START_HOUR;
  let endHour = EVENT_CONFIG.DEFAULT_END_HOUR;
  if (groupRow[3] && groupRow[3].includes('-')) {
    const timeParts = groupRow[3].split('-').map(x => parseInt(x.trim(), 10));
    if (timeParts.length === 2 && !isNaN(timeParts[0]) && !isNaN(timeParts[1])) {
      startHour = timeParts[0];
      endHour = timeParts[1];
    }
  }

  return {
    groupName: groupRow[1] || GROUP_CONFIG.DEFAULT_GROUP_NAME,
    defaultArenaCode: groupRow[2] || GROUP_CONFIG.DEFAULT_ARENA_CODE,
    defaultTimeRange: groupRow[3] || GROUP_CONFIG.DEFAULT_TIME_RANGE,
    startHour: startHour,
    endHour: endHour,
    minCount: parseInt(groupRow[4], 10) || GROUP_CONFIG.DEFAULT_MIN_COUNT
  };
}

/**
 * 取得所有場館列表（供 LIFF 網頁使用）
 * @returns {Array} 場館列表
 */
function getArenasForLiff() {
  return locationMap();
}

/**
 * 處理 LIFF 的 GET 請求（取得初始資料）
 * @param {object} e - 事件物件
 */
function doGetLiff(e) {
  const params = e.parameter;
  const groupId = params.groupId || '';
  const action = params.action || 'settings';

  try {
    if (action === 'settings') {
      const settings = getGroupSettingsForLiff(groupId);
      return ContentService.createTextOutput(JSON.stringify(settings))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'arenas') {
      const arenas = getArenasForLiff();
      return ContentService.createTextOutput(JSON.stringify(arenas))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    logError('LIFF GET 請求錯誤: ' + error.message, '', '');
    return ContentService.createTextOutput(JSON.stringify({
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    error: 'Unknown action'
  })).setMimeType(ContentService.MimeType.JSON);
}


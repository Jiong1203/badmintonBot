// 依賴 utils/date.gs, utils/location.gs, data/sheets.gs, user.gs, log.gs
// 請直接使用 getSheetData, appendRow, getWeekdayNumber, changeChinese, calculateDate, formatDate, locationMap, findLocationInfo 等工具

/**
 * 更新指定活動的總報名人數
 * @param {string} eventCode - 活動代碼
 */
function updateEventParticipantCount(eventCode, groupId) {
  const allRegistrations = getSheetData(SHEETS_CONFIG.SHEETS.REGISTRATIONS);
  const newTotal = allRegistrations.filter(row => row[1] === eventCode && row[2] === groupId).length;
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const eventRowIndex = allEvents.findIndex(row => row[1] === eventCode && row[2] === groupId);
  if (eventRowIndex !== -1) {
    setCellValue(SHEETS_CONFIG.SHEETS.EVENTS, eventRowIndex + 1, 9, newTotal);
  }
}

/**
 * 存取開團資訊
 */
function createEvent(obj) {
  // 1. 產生唯一 eventId
  const eventId = 'EVT' + new Date().getTime();
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);

  // 2. 找出目前 groupId 的最大 eventCode 序號
  const groupEvents = allEvents.filter(row => row[2] === obj.groupId);
  const codes = groupEvents.map(row => row[1]).filter(Boolean);
  let maxIndex = -1;
  codes.forEach(code => {
    const num = parseInt(code.substring(1), 10);
    if (!isNaN(num)) maxIndex = Math.max(maxIndex, num);
  });
  const nextCode = getDayCode(obj.eventDay) + String(maxIndex + 1).padStart(2, '0');

  // 3. 組出時間與地點資訊
  const timeRange = `${obj.startHour}-${obj.endHour}`;
  const location = obj.locationInfo || getDefaultLocation();
  const createDate = Utilities.formatDate(new Date(), USER_CONFIG.TIMEZONE, USER_CONFIG.DATE_FORMAT);

  // 4. 組一列資料
  const newEventRow = [
    eventId, nextCode, obj.groupId,
    obj.eventDate, obj.eventDay, timeRange,
    location.arenaCode, location.address,
    0, // joinedPeople
    EVENT_CONFIG.STATUS.OPEN, obj.userId, createDate
  ];

  // 5. 寫入資料並回傳 eventCode
  appendRow(SHEETS_CONFIG.SHEETS.EVENTS, newEventRow);
  return nextCode;
}

/**
 * 活動代碼轉換
 */
function getDayCode(dayChar) {
  const map = { '日': 'U', '一': 'M', '二': 'T', '三': 'W', '四': 'R', '五': 'F', '六': 'S' };
  return map[dayChar] || 'X';
}

/**
 * 檢查活動是否為 OPEN 狀態
 */
function isEventOpen(eventCode, groupId) {
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  return event && event[9] === EVENT_CONFIG.STATUS.OPEN;
}

/**
 * 報名功能
 */
function registerToEvent(userId, displayName, messageText, groupId) {
  const match = messageText.trim().match(COMMAND_CONFIG.PATTERNS.REGISTRATION);
  if (!match) return ERROR_MESSAGES.INVALID_REGISTRATION_FORMAT;
  const [, eventCode, nameInput, remark = ''] = match;
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  if (!event) return `⚠️ 找不到本群組的活動代碼 ${eventCode}`;
  if (!isEventOpen(eventCode, groupId)) return MESSAGE_TEMPLATES.ERROR_EVENT_CLOSED(eventCode);

  const nameMatch = nameInput.match(/^(.+?)(?:\+(\d+))?$/);
  if (!nameMatch) return ERROR_MESSAGES.INVALID_PARTICIPANT_FORMAT;
  const baseName = nameMatch[1].trim();
  const additionalCount = parseInt(nameMatch[2] || '0', 10);
  const totalParticipants = additionalCount == 0 ? additionalCount + 1 : additionalCount;
  const now = Utilities.formatDate(new Date(), USER_CONFIG.TIMEZONE, USER_CONFIG.DATE_FORMAT);

  const eventRegistrations = getSheetData(SHEETS_CONFIG.SHEETS.REGISTRATIONS)
    .filter(row => row[1] === eventCode && row[2] === groupId);
  const newNames = Array.from({ length: totalParticipants }, (_, i) => i === 0 ? baseName : `${baseName}${i + 1}`);
  
  // 檢查報名名稱是否重複（跨用戶檢查）
  for (const name of newNames) {
    // 檢查同一個用戶是否已使用該名稱
    if (eventRegistrations.some(row => row[4] === name && row[3] === userId)) {
      return MESSAGE_TEMPLATES.ERROR_ALREADY_REGISTERED(name, eventCode);
    }
    // 檢查其他用戶是否已使用該名稱（避免名稱衝突）
    if (eventRegistrations.some(row => row[4] === name && row[3] !== userId)) {
      return MESSAGE_TEMPLATES.ERROR_NAME_CONFLICT(name);
    }
  }
  let maxOrder = eventRegistrations.length > 0 ? Math.max(...eventRegistrations.map(row => parseInt(row[5] || 0, 10))) : 0;
  const rowsToAdd = newNames.map((name, i) => {
    const registerId = `R${new Date().getTime()}${i}`;
    return [registerId, eventCode, groupId, userId, name, ++maxOrder, remark.trim(), now];
  });
  rowsToAdd.forEach(row => appendRow(SHEETS_CONFIG.SHEETS.REGISTRATIONS, row));
  updateEventParticipantCount(eventCode, groupId);
  return getRegistrationList(`!查詢報名 ${eventCode}`, groupId);
}

/**
 * 查詢群組內開放中活動
 */
function getOpenEventList(groupId) {
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const openEvents = allEvents.filter(row => row[2] === groupId && row[9] === EVENT_CONFIG.STATUS.OPEN);

  if (openEvents.length === 0) return '📭 此群組目前沒有開放報名中的活動';

  const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
  const groupName = groupRow ? groupRow[1] : '此群組';
  const locationMapList = locationMap();

  let msg = `📌 ${groupName} 目前開放中的活動：\n`;
  for (const row of openEvents) {
    const [, eventCode, , rawDate, , timeRange, arenaCode, , joinedPeople] = row;
    const formattedDate = Utilities.formatDate(new Date(rawDate), 'Asia/Taipei', 'yyyy/MM/dd');
    const location = locationMapList.find(loc => loc.arenaCode === arenaCode);
    const arenaName = location ? location.name : '未知場館';
    const formattedTimeRange = formatTimeRange(timeRange);
    msg += `\n🔸 代碼：${eventCode}\n📅 日期：${formattedDate}\n⏰ 時間：${formattedTimeRange}\n🏸 場館：${arenaName}（${arenaCode}）\n👥 已報名：${joinedPeople} 人\n`;
  }

  return msg.trim();
}

/**
 * 查詢指定活動報名名單
 */
function getRegistrationList(userMessage, groupId) {
  const match = userMessage.trim().match(COMMAND_CONFIG.PATTERNS.QUERY_REGISTRATION);
  if (!match) return '❌ 指令格式錯誤，請使用: !查詢報名 F01';
  const eventCode = match[1];
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  if (!event) return `⚠️ 找不到本群組的活動代碼 ${eventCode}`;
  if (!isEventOpen(eventCode, groupId)) return `⚠️ 活動 ${eventCode} 已截止，無法查詢報名名單`;
  const [, , , eventDateRaw, , timeRange, arenaCode, address] = event;
  const eventDate = Utilities.formatDate(new Date(eventDateRaw), 'Asia/Taipei', 'yyyy/MM/dd');
  const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
  const groupName = groupRow ? groupRow[1] : '未命名隊伍';
  const location = findLocationInfo(arenaCode);
  const arenaName = location?.name || arenaCode;
  const eventRegs = getSheetData(SHEETS_CONFIG.SHEETS.REGISTRATIONS)
    .filter(row => row[1] === eventCode && row[2] === groupId)
    .map(row => ({ name: row[4], order: parseInt(row[5], 10) || 0, remark: row[6] }))
    .sort((a, b) => a.order - b.order);
  if (eventRegs.length === 0) return `📭 目前尚無人報名活動 ${eventCode}。`;
  const lines = eventRegs.map((reg, index) => `${index + 1}. ${reg.name} ${reg.remark}`);
  const formattedTimeRange = formatTimeRange(timeRange);
  return `📋 活動 ${eventCode} 報名名單（共 ${lines.length} 人）\n` +
    `🏷️ 球隊：${groupName}\n📅 日期：${eventDate}\n⏰ 時間：${formattedTimeRange}\n` +
    `🏸 場館：${arenaName}\n📍 地址：${address}\n\n` + lines.join('\n');
}

// ... 保持 updateRegistration, cancelRegistration, reorderRegistrations, closePastEvents, ...ByDateTime 等函式，
// 但內部資料操作需手動改為 getSheetData, setCellValue, appendRow, deleteRow 等
// 以下為示意，實際修改更複雜，暫時保留舊寫法，待後續優化
function updateRegistration(userId, messageText, groupId) {
  const match = messageText.trim().match(COMMAND_CONFIG.PATTERNS.UPDATE_REGISTRATION);
  if (!match) return '❌ 指令格式錯誤，請使用: !修改報名 F01 小明+2 備註內容';
  const [, eventCode, baseName, countStr, remark] = match;
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  if (!event) return `⚠️ 找不到本群組的活動代碼 ${eventCode}`;
  if (!isEventOpen(eventCode, groupId)) return `⚠️ 活動 ${eventCode} 已截止，無法修改報名`;
  const numberOfPeople = countStr ? parseInt(countStr, 10) : 1;
  const regSheet = onConn("registrations");
  let data = regSheet.getDataRange().getValues();
  
  // 檢查是否為管理員
  const isAdmin = isGroupAdmin(groupId, userId);
  
  // 找出該eventCode下所有baseName開頭的資料
  let allRegsWithName = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[4].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
  
  // 如果不是管理員，只能修改自己的報名
  let userRegs;
  let targetUserId;
  if (!isAdmin) {
    userRegs = allRegsWithName.filter(obj => obj.row[3] === userId);
    if (userRegs.length === 0) {
      return `⚠️ 您尚未以「${baseName}」的名義報名活動 ${eventCode}，無法修改`;
    }
    targetUserId = userId;
  } else {
    // 如果是管理員，可以修改任何用戶的報名
    // 如果有多個用戶使用相同的報名名稱，優先修改第一個找到的
    if (allRegsWithName.length === 0) {
      return `⚠️ 找不到活動 ${eventCode} 中以「${baseName}」報名的資料`;
    }
    // 找出第一個使用該名稱的用戶ID
    targetUserId = allRegsWithName[0].row[3];
    userRegs = allRegsWithName.filter(obj => obj.row[3] === targetUserId);
  }
  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  // 取得目前該活動最大orderNumber
  const eventRegs = data.filter(row => row[1] === eventCode && row[2] === groupId);
  let maxOrder = 0;
  if (eventRegs.length > 0) {
    maxOrder = Math.max(...eventRegs.map(row => parseInt(row[5] || 0, 10)));
  }
  // 1. 若新數量 < 原數量：只保留前n筆，多的刪除
  if (numberOfPeople < userRegs.length) {
    for (let i = userRegs.length - 1; i >= numberOfPeople; i--) {
      regSheet.deleteRow(userRegs[i].idx + 1);
    }
    // 可選：更新前n筆remark
    data = regSheet.getDataRange().getValues();
    userRegs = data
      .map((row, idx) => ({ row, idx }))
      .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[3] === targetUserId && obj.row[4].startsWith(baseName))
      .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
    for (let i = 0; i < numberOfPeople; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 8).setValue(now);
    }
  } else if (numberOfPeople > userRegs.length) {
    // 2. 若新數量 > 原數量：保留原有，新增報名名稱，避免與其他用戶衝突
    for (let i = 0; i < userRegs.length; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 8).setValue(now);
    }
    
    // 找出目標用戶現有的報名名稱（用於避免重複）
    const existingNames = userRegs.map(reg => reg.row[4]);
    // 找出所有其他用戶已使用的報名名稱（用於避免衝突）
    const otherUserNames = eventRegs
      .filter(row => row[3] !== targetUserId)
      .map(row => row[4]);
    
    // 找出目標用戶現有報名名稱的最大數字後綴
    // 例如：如果現有「小明」、「小明2」、「小明3」，最大後綴是 3
    let maxSuffix = 0;
    for (const name of existingNames) {
      if (name === baseName) {
        maxSuffix = Math.max(maxSuffix, 1);
      } else if (name.startsWith(baseName)) {
        const suffixStr = name.substring(baseName.length);
        const suffixNum = parseInt(suffixStr, 10);
        if (!isNaN(suffixNum)) {
          maxSuffix = Math.max(maxSuffix, suffixNum);
        }
      }
    }
    
    // 為新增的報名生成唯一的名稱，按照順序排列
    const needToAdd = numberOfPeople - userRegs.length;
    for (let i = 0; i < needToAdd; i++) {
      let newName;
      // 從最大後綴 + 1 開始嘗試（例如：最大後綴是3，下一個應該是4）
      let suffix = maxSuffix + 1;
      
      // 生成新名稱，確保不與目標用戶現有的報名重複，也不與其他用戶衝突
      // 優先使用 baseName + 數字 的格式（如 小明4, 小明5...）
      do {
        newName = suffix === 1 ? baseName : `${baseName}${suffix}`;
        suffix++;
        // 如果 suffix 超過 1000，改用時間戳避免無限循環
        if (suffix > 1000) {
          newName = `${baseName}_${new Date().getTime()}_${i}`;
          break;
        }
      } while (existingNames.includes(newName) || otherUserNames.includes(newName));
      
      const registerId = 'R' + new Date().getTime() + i;
      regSheet.appendRow([
        registerId,
        eventCode,
        groupId,
        targetUserId,
        newName,
        ++maxOrder,
        remark || '',
        now
      ]);
      // 將新名稱加入現有名稱列表，避免後續新增時重複
      existingNames.push(newName);
      // 更新最大後綴，確保後續新增時按照順序
      const newSuffixStr = newName.substring(baseName.length);
      const newSuffixNum = parseInt(newSuffixStr, 10);
      if (!isNaN(newSuffixNum)) {
        maxSuffix = Math.max(maxSuffix, newSuffixNum);
      } else if (newName === baseName) {
        maxSuffix = Math.max(maxSuffix, 1);
      }
    }
  } else {
    // 3. 數量相同，只更新remark
    for (let i = 0; i < userRegs.length; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 8).setValue(now);
    }
  }
  // 更新活動人數（重新統計該活動所有報名人數）
  data = regSheet.getDataRange().getValues();
  const newTotal = data.filter(row => row[1] === eventCode && row[2] === groupId).length;
  const eventSheet = onConn("events");
  const eventData = eventSheet.getDataRange().getValues();
  const eventRowIndex = eventData.findIndex(row => row[1] === eventCode && row[2] === groupId);
  if (eventRowIndex !== -1) {
    eventSheet.getRange(eventRowIndex + 1, 9).setValue(newTotal);
  }
  // 重新排序
  reorderRegistrations(eventCode, groupId);
  // return `✅ 已成功修改您於 ${eventCode} 的報名資訊：${baseName}+${numberOfPeople}`;
  return getRegistrationList(`!查詢報名 ${eventCode}`, groupId);
}

function cancelRegistration(userId, userMessage, groupId) {
  const match = userMessage.trim().match(COMMAND_CONFIG.PATTERNS.CANCEL_REGISTRATION);
  if (!match) {
    return '⚠️ 指令格式錯誤，請使用 "!取消報名 活動代碼 暱稱" 或 "!取消報名 活動代碼 暱稱-2"';
  }
  const eventCode = match[1];
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  if (!event) return `⚠️ 找不到本群組的活動代碼 ${eventCode}`;
  if (!isEventOpen(eventCode, groupId)) return `⚠️ 活動 ${eventCode} 已截止，無法取消報名`;
  const baseName = match[2].trim();
  const cancelCount = match[3] ? parseInt(match[3], 10) : 1;
  const regSheet = onConn("registrations");
  let data = regSheet.getDataRange().getValues();
  
  // 檢查是否為管理員
  const isAdmin = isGroupAdmin(groupId, userId);
  
  // 找出該eventCode下所有baseName開頭的資料
  let allRegsWithName = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[4].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
  
  // 如果不是管理員，只能取消自己的報名
  let userRegs;
  if (!isAdmin) {
    userRegs = allRegsWithName.filter(obj => obj.row[3] === userId);
    if (userRegs.length === 0) {
      return `⚠️ 您尚未以「${baseName}」的名義報名活動 ${eventCode}，無法取消`;
    }
  } else {
    // 如果是管理員，可以取消任何用戶的報名
    // 如果有多個用戶使用相同的報名名稱，優先取消第一個找到的
    if (allRegsWithName.length === 0) {
      return `⚠️ 找不到活動 ${eventCode} 中以「${baseName}」報名的資料`;
    }
    // 找出第一個使用該名稱的用戶ID
    const targetUserId = allRegsWithName[0].row[3];
    userRegs = allRegsWithName.filter(obj => obj.row[3] === targetUserId);
  }
  // 實際要刪除的數量
  const toDeleteCount = Math.min(cancelCount, userRegs.length);
  const deletedNames = [];
  for (let i = 0; i < toDeleteCount; i++) {
    const toDelete = userRegs[userRegs.length - 1 - i];
    regSheet.deleteRow(toDelete.idx + 1);
    deletedNames.push(toDelete.row[4]);
  }
  // 更新活動人數
  updateEventParticipantCount(eventCode, groupId);
  // 重新排序
  reorderRegistrations(eventCode, groupId);
  return getRegistrationList(`!查詢報名 ${eventCode}`, groupId);
}

function reorderRegistrations(eventCode, groupId) {
  const regSheet = onConn("registrations");
  const data = regSheet.getDataRange().getValues();
  const eventRegs = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === eventCode && data[i][2] === groupId) {
      eventRegs.push({ rowIndex: i + 1 });
    }
  }
  for (let i = 0; i < eventRegs.length; i++) {
    regSheet.getRange(eventRegs[i].rowIndex, 6).setValue(i + 1); // orderNumber 在第6欄
  }
}

function closePastEvents() {
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  
  for (let i = 1; i < allEvents.length; i++) {
    const row = allEvents[i];
    const status = row[9];
    if (status !== EVENT_CONFIG.STATUS.OPEN) continue;
    const eventDate = row[3];
    const timeRange = row[5];
    if (!eventDate || !timeRange) continue;
    const [startTime] = timeRange.split(/[-~]/).map(x => parseInt(x, 10));
    if (isNaN(startTime)) continue;
    
    // 解析開始時間：支援 19-21 和 1930-2130 兩種格式
    let startHour, startMinute;
    if (startTime >= 1000 && startTime <= 9999) {
      // 4 位數格式（1930）：前兩位是小時，後兩位是分鐘
      const timeStr = ('0000' + String(startTime)).slice(-4);
      startHour = parseInt(timeStr.substring(0, 2), 10);
      startMinute = parseInt(timeStr.substring(2, 4), 10);
    } else {
      // 1-3 位數格式（19）：只有小時，分鐘為 0
      startHour = startTime;
      startMinute = 0;
    }
    
    // 解析活動日期，處理跨年問題
    let eventStart;
    let eventMonth, eventDay;
    
    if (eventDate instanceof Date) {
      // 如果是 Date 物件，提取月/日
      eventMonth = eventDate.getMonth();
      eventDay = eventDate.getDate();
    } else {
      // 如果是字串格式（如 "01/02"），需要解析
      const dateStr = String(eventDate);
      
      if (dateStr.includes('/')) {
        // 格式為 "MM/DD" 或 "M/D"
        const parts = dateStr.split('/');
        eventMonth = parseInt(parts[0], 10) - 1; // JavaScript 月份從 0 開始
        eventDay = parseInt(parts[1], 10);
      } else {
        // 嘗試直接解析為 Date
        eventStart = new Date(eventDate);
        if (isNaN(eventStart.getTime())) continue;
        eventMonth = eventStart.getMonth();
        eventDay = eventStart.getDate();
      }
    }
    
    // 先假設是今年
    let eventYear = currentYear;
    eventStart = new Date(eventYear, eventMonth, eventDay);
    
    // 針對 11、12、1 月做跨年判斷
    // 因為開團是以週為單位，活動日期與今天不會差太多天
    
    const isMonthDayBeforeNow = eventMonth < currentMonth || 
                                 (eventMonth === currentMonth && eventDay < currentDate);
    
    if (currentMonth === 11) { // 12 月
      // 如果活動的月/日在當前月/日之前，需要判斷：
      // - 如果活動是 12 月，應該是今年的（過去）
      // - 如果活動是 1-11 月，應該是明年的
      // 例如：12/31 看到 12/30 -> 今年（應該關閉）
      // 例如：12/31 看到 01/02 -> 明年（不關閉）
      if (isMonthDayBeforeNow && eventMonth !== 11) {
        // 活動是 1-11 月，應該是明年的
        eventYear = currentYear + 1;
        eventStart = new Date(eventYear, eventMonth, eventDay);
      }
      // 如果活動是 12 月，保持今年的判斷（會正確關閉）
    } else if (currentMonth === 0) { // 1 月
      // 如果活動的月/日在當前月/日之前，且是 12 月，則活動應該是去年的
      // 例如：01/15 看到 12/30 -> 去年（應該關閉）
      if (isMonthDayBeforeNow && eventMonth === 11) { // 11 代表 12 月
        eventYear = currentYear - 1;
        eventStart = new Date(eventYear, eventMonth, eventDay);
      }
    } else if (currentMonth === 10) { // 11 月
      // 如果活動的月/日在當前月/日之前，且是 1 月或 2 月，則活動應該是明年的
      // 例如：11/15 看到 01/02 -> 明年（不太可能，因為開團以週為單位）
      // 但為了完整性，還是處理一下
      if (isMonthDayBeforeNow && (eventMonth === 0 || eventMonth === 1)) {
        eventYear = currentYear + 1;
        eventStart = new Date(eventYear, eventMonth, eventDay);
      }
    }
    
    eventStart.setHours(startHour, startMinute, 0);
    if (now >= eventStart) {
      setCellValue(SHEETS_CONFIG.SHEETS.EVENTS, i + 1, 10, EVENT_CONFIG.STATUS.CLOSED);
    }
  }
}

/**
 * 解析新格式報名指令
 * 格式: !報名 7/14 20-22 小明+2 會晚到
 */
function parseNewRegistrationCommand(message) {
  const match = message.match(/^!報名\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}-\d{1,2})\s+([^\s]+)\s*(.*)$/);
  if (!match) return null;
  return {
    date: match[1],
    timeRange: match[2],
    nicknameAndCount: match[3],
    note: match[4] || ''
  };
}

/**
 * 依 groupId, date, timeRange 查找 eventCode
 */
function findEventCodeByGroupDateTime(groupId, date, timeRange) {
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row =>
    row[2] == groupId &&
    formatSheetDate(row[3]) == date &&
    row[5] == timeRange
  );
  return event ? event[1] : null;
}

function formatSheetDate(sheetDate) {
  if (sheetDate instanceof Date) {
    // 轉成 "M/D" 格式
    return (sheetDate.getMonth() + 1) + '/' + sheetDate.getDate();
  }
  // 若已經是字串就直接回傳
  return sheetDate;
}

/**
 * 新格式報名主流程
 * @param {string} userId
 * @param {string} displayName
 * @param {string} groupId
 * @param {string} messageText
 * @returns {string} 報名結果訊息
 */
function registerToEventByDateTime(userId, displayName, groupId, messageText) {
  const parsed = parseNewRegistrationCommand(messageText);
  if (!parsed) {
    return '⚠️ 指令格式錯誤，請輸入如 "!報名 7/14 20-22 小明+2" 或 "!報名 7/14 20-22 小明+2 備註"';
  }
  const eventCode = findEventCodeByGroupDateTime(groupId, parsed.date, parsed.timeRange);
  if (!eventCode) {
    const formattedTimeRange = formatTimeRange(parsed.timeRange);
    return `⚠️ 找不到 ${parsed.date} ${formattedTimeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合原本報名格式 "!報名 eventCode 暱稱+人數 備註"
  const regMsg = `!報名 ${eventCode} ${parsed.nicknameAndCount} ${parsed.note}`.trim();
  return registerToEvent(userId, displayName, regMsg, groupId);
}

/**
 * 新格式取消報名主流程
 * 格式: !取消報名 7/16 18-21 小明-2
 */
function cancelRegistrationByDateTime(userId, groupId, messageText) {
  // 解析新格式
  const match = messageText.match(/^!取消報名\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}-\d{1,2})\s+([^\s]+)$/);
  if (!match) {
    return cancelRegistration(userId, messageText, groupId); // fallback 舊格式
  }
  const [, date, timeRange, nameAndCount] = match;
  const eventCode = findEventCodeByGroupDateTime(groupId, date, timeRange);
  if (!eventCode) {
    const formattedTimeRange = formatTimeRange(timeRange);
    return `⚠️ 找不到 ${date} ${formattedTimeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合舊格式 "!取消報名 eventCode 小明-2"
  const regMsg = `!取消報名 ${eventCode} ${nameAndCount}`;
  return cancelRegistration(userId, regMsg, groupId);
}

/**
 * 新格式修改報名主流程
 * 格式: !修改報名 7/16 18-21 小明+2 備註
 */
function updateRegistrationByDateTime(userId, groupId, messageText) {
  // 解析新格式
  const match = messageText.match(/^!修改報名\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}-\d{1,2})\s+([^\s]+)(?:\s+(.*))?$/);
  if (!match) {
    return updateRegistration(userId, messageText, groupId); // fallback 舊格式
  }
  const [, date, timeRange, nameAndCount, remark] = match;
  const eventCode = findEventCodeByGroupDateTime(groupId, date, timeRange);
  if (!eventCode) {
    const formattedTimeRange = formatTimeRange(timeRange);
    return `⚠️ 找不到 ${date} ${formattedTimeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合舊格式 "!修改報名 eventCode 小明+2 備註"
  const regMsg = `!修改報名 ${eventCode} ${nameAndCount}${remark ? ' ' + remark : ''}`;
  return updateRegistration(userId, regMsg, groupId);
}

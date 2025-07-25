// 依賴 utils/date.gs, utils/location.gs, data/sheets.gs, user.gs, log.gs
// 請直接使用 getSheetData, appendRow, getWeekdayNumber, changeChinese, calculateDate, calculateDeadlineDate, formatDate, locationMap, findLocationInfo 等工具

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
    setCellValue(SHEETS_CONFIG.SHEETS.EVENTS, eventRowIndex + 1, 10, newTotal);
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
    obj.deadlineDate, 0, // joinedPeople
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
  return event && event[10] === EVENT_CONFIG.STATUS.OPEN;
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
  const totalParticipants = additionalCount;
  const now = Utilities.formatDate(new Date(), USER_CONFIG.TIMEZONE, USER_CONFIG.DATE_FORMAT);

  const eventRegistrations = getSheetData(SHEETS_CONFIG.SHEETS.REGISTRATIONS)
    .filter(row => row[1] === eventCode && row[2] === groupId);
  const newNames = Array.from({ length: totalParticipants }, (_, i) => i === 0 ? baseName : `${baseName}${i + 1}`);
  for (const name of newNames) {
    if (eventRegistrations.some(row => row[4] === name && row[3] === userId)) {
      return ERROR_MESSAGES.ALREADY_REGISTERED(name, eventCode);
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
  const openEvents = allEvents.filter(row => row[2] === groupId && row[10] === EVENT_CONFIG.STATUS.OPEN);

  if (openEvents.length === 0) return '📭 此群組目前沒有開放報名中的活動';

  const groupRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
  const groupName = groupRow ? groupRow[1] : '此群組';
  const locationMapList = locationMap();

  let msg = `📌 ${groupName} 目前開放中的活動：\n`;
  for (const row of openEvents) {
    const [, eventCode, , rawDate, , timeRange, arenaCode, , , joinedPeople] = row;
    const formattedDate = Utilities.formatDate(new Date(rawDate), 'Asia/Taipei', 'yyyy/MM/dd');
    const location = locationMapList.find(loc => loc.arenaCode === arenaCode);
    const arenaName = location ? location.name : '未知場館';
    msg += `\n🔸 代碼：${eventCode}\n📅 日期：${formattedDate}\n⏰ 時間：${timeRange}\n🏸 場館：${arenaName}（${arenaCode}）\n👥 已報名：${joinedPeople} 人\n`;
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
    .map(row => ({ name: row[4], order: parseInt(row[5], 10) || 0 }))
    .sort((a, b) => a.order - b.order);
  if (eventRegs.length === 0) return `📭 目前尚無人報名活動 ${eventCode}。`;
  const lines = eventRegs.map((reg, index) => `${index + 1}. ${reg.name}`);
  return `📋 活動 ${eventCode} 報名名單（共 ${lines.length} 人）\n` +
    `🏷️ 球隊：${groupName}\n📅 日期：${eventDate}\n⏰ 時間：${timeRange}\n` +
    `🏸 場館：${arenaName}\n📍 地址：${address}\n\n` + lines.join('\n');
}

// ... 保持 updateRegistration, cancelRegistration, reorderRegistrations, closePastEvents, ...ByDateTime 等函式，
// 但內部資料操作需手動改為 getSheetData, setCellValue, appendRow, deleteRow 等
// 以下為示意，實際修改更複雜，暫時保留舊寫法，待後續優化
function updateRegistration(userId, messageText, groupId) {
  const match = messageText.match(/^!修改報名\s+(\w+)\s+(.+?)(?:\+(\d+))?(?:\s+(.*))?$/);
  if (!match) return '❌ 指令格式錯誤，請使用: !修改報名 F01 小明+2 備註內容';
  const [, eventCode, baseName, countStr, remark] = match;
  const allEvents = getSheetData(SHEETS_CONFIG.SHEETS.EVENTS);
  const event = allEvents.find(row => row[1] === eventCode && row[2] === groupId);
  if (!event) return `⚠️ 找不到本群組的活動代碼 ${eventCode}`;
  if (!isEventOpen(eventCode, groupId)) return `⚠️ 活動 ${eventCode} 已截止，無法修改報名`;
  const numberOfPeople = countStr ? parseInt(countStr, 10) : 1;
  const regSheet = onConn("registrations");
  let data = regSheet.getDataRange().getValues();
  // 找出該userId+eventCode下所有baseName開頭的資料，依orderNumber排序
  let userRegs = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[3] === userId && obj.row[4].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
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
      .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[3] === userId && obj.row[4].startsWith(baseName))
      .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
    for (let i = 0; i < numberOfPeople; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 8).setValue(now);
    }
  } else if (numberOfPeople > userRegs.length) {
    // 2. 若新數量 > 原數量：保留原有，新增 displayName（如小明3、小明4...），orderNumber 接在最大 orderNumber 後面
    for (let i = 0; i < userRegs.length; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 8).setValue(now);
    }
    for (let i = userRegs.length; i < numberOfPeople; i++) {
      const thisName = i === 0 ? baseName : baseName + (i + 1);
      const registerId = 'R' + new Date().getTime() + i;
      regSheet.appendRow([
        registerId,
        eventCode,
        groupId,
        userId,
        thisName,
        ++maxOrder,
        remark || '',
        now
      ]);
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
    eventSheet.getRange(eventRowIndex + 1, 10).setValue(newTotal);
  }
  // 重新排序
  reorderRegistrations(eventCode, groupId);
  // return `✅ 已成功修改您於 ${eventCode} 的報名資訊：${baseName}+${numberOfPeople}`;
  return getRegistrationList(`!查詢報名 ${eventCode}`, groupId);
}

function cancelRegistration(userId, userMessage, groupId) {
  const match = userMessage.match(/^!取消報名\s+([A-Z]\d{2})\s+(.+?)(?:-(\d+))?$/);
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
  // 找出該userId+eventCode下所有baseName開頭的資料，依orderNumber排序
  let userRegs = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === groupId && obj.row[3] === userId && obj.row[4].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[5], 10) - parseInt(b.row[5], 10));
  if (userRegs.length === 0) {
    return `⚠️ 您尚未以「${baseName}」的名義報名活動 ${eventCode}，無法取消`;
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
  for (let i = 1; i < allEvents.length; i++) {
    const row = allEvents[i];
    const status = row[10];
    if (status !== EVENT_CONFIG.STATUS.OPEN) continue;
    const eventDate = row[3];
    const timeRange = row[5];
    if (!eventDate || !timeRange) continue;
    const [startHour] = timeRange.split(/[-~]/).map(x => parseInt(x, 10));
    if (isNaN(startHour)) continue;
    const eventStart = new Date(eventDate);
    eventStart.setHours(startHour, 0, 0);
    if (now >= eventStart) {
      setCellValue(SHEETS_CONFIG.SHEETS.EVENTS, i + 1, 11, EVENT_CONFIG.STATUS.CLOSED);
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
    return `⚠️ 找不到 ${parsed.date} ${parsed.timeRange} 的開團，請確認日期與時間格式正確。`;
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
    return `⚠️ 找不到 ${date} ${timeRange} 的開團，請確認日期與時間格式正確。`;
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
    return `⚠️ 找不到 ${date} ${timeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合舊格式 "!修改報名 eventCode 小明+2 備註"
  const regMsg = `!修改報名 ${eventCode} ${nameAndCount}${remark ? ' ' + remark : ''}`;
  return updateRegistration(userId, regMsg, groupId);
}

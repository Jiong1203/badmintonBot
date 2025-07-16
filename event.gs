/**
 * 存取開團資訊
 */
function createEvent(obj) {
  const sheet = onConn("events");
  const data = sheet.getDataRange().getValues();

  // 1. 產生唯一 eventId（可用目前 timestamp）
  const eventId = 'EVT' + new Date().getTime();

  // 2. 找出目前 groupId 的最大 eventCode 序號，例如 F00, F01
  const groupEvents = data.filter(row => row[2] === obj.groupId);
  const codes = groupEvents.map(row => row[1]).filter(Boolean);
  let maxIndex = -1;
  codes.forEach(code => {
    const num = parseInt(code.substring(1), 10);
    if (!isNaN(num)) maxIndex = Math.max(maxIndex, num);
  });
  const nextCode = getDayCode(obj.eventDay) + String(maxIndex + 1).padStart(2, '0');

  // 3. 組出時間區段
  const timeRange = `${obj.startHour}-${obj.endHour}`;

  // 4. 取得場館代碼與地址
  const arenaCode = obj.locationInfo?.arenaCode || 'K00';
  const address = obj.locationInfo?.address || '大高雄羽球館大社館';

  // 5. 現在時間
  const createDate = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

  // 6. 組一列資料
  const row = [
    eventId,                 // eventId
    nextCode,                // eventCode
    obj.groupId,             // groupId
    obj.eventDate,           // date
    obj.eventDay,            // weekday
    timeRange,               // timeRange
    arenaCode,               // arenaCode
    address,                 // address
    obj.deadlineDate,        // deadline
    0,                       // joinedPeople（初始為0）
    'OPEN',                  // status
    obj.userId,              // createdBy
    createDate               // createDate
  ];

  // 7. 寫入資料
  sheet.appendRow(row);

  // 8. 回傳 eventCode 供公告使用
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
function isEventOpen(eventCode) {
  const sheet = onConn("events");
  const data = sheet.getDataRange().getValues();
  const row = data.find(row => row[1] === eventCode);
  return row && row[10] === "OPEN";
}

/**
 * 報名功能
 * 每一個人一筆資料，displayName自動編號，orderNumber自動遞增
 * 支援可選備註內容
 */
function registerToEvent(userId, displayName, messageText) {
  // 支援可選備註：!報名 F01 小明+2 備註內容
  const match = messageText.trim().match(/^!報名\s+([A-Z]\d{2})\s+(.+?)(?:\s+(.+))?$/);
  if (!match) {
    // return '你他媽是文盲還是閱讀障礙!';
    return '⚠️ 指令格式錯誤，請輸入如 "!報名 F01 小明+2" 或 "!報名 F01 小明+2 備註"';
  }
  const eventCode = match[1];
  const nameInput = match[2];
  const remark = match[3] ? match[3].trim() : '';
  if (!isEventOpen(eventCode)) return `⚠️ 活動 ${eventCode} 已截止報名`;

  // 解析人數
  const nameMatch = nameInput.match(/^(.+?)(?:\+(\d+))?$/);
  if (!nameMatch) {
    return '⚠️ 報名格式錯誤，請用「暱稱」或「暱稱+人數」格式';
  }
  const baseName = nameMatch[1].trim();
  const additional = parseInt(nameMatch[2] || '0', 10);
  const numberOfPeople = 0 + additional;
  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

  // 取得目前最大 orderNumber
  const regSheet = onConn("registrations");
  const regData = regSheet.getDataRange().getValues();
  const eventRegs = regData.filter(row => row[1] === eventCode);
  let maxOrder = 0;
  if (eventRegs.length > 0) {
    maxOrder = Math.max(...eventRegs.map(row => parseInt(row[4] || 0, 10)));
  }

  // 檢查是否已經報名過（同userId+eventCode+displayName）
  for (let i = 0; i < numberOfPeople; i++) {
    const thisName = i === 0 ? baseName : baseName + (i + 1);
    if (eventRegs.some(row => row[2] === userId && row[3] === thisName)) {
      return `⚠️ 您已經以「${thisName}」的名義報名過活動 ${eventCode}，如需修改請使用「!修改報名」指令`;
    }
  }

  // 寫入多筆資料
  for (let i = 0; i < numberOfPeople; i++) {
    const thisName = i === 0 ? baseName : baseName + (i + 1);
    const registerId = 'R' + new Date().getTime() + i;
    regSheet.appendRow([
      registerId,
      eventCode,
      userId,
      thisName,
      maxOrder + 1 + i,
      remark,
      now
    ]);
  }

  // 更新活動人數
  const eventSheet = onConn("events");
  const eventData = eventSheet.getDataRange().getValues();
  const eventRowIndex = eventData.findIndex(row => row[1] === eventCode);
  if (eventRowIndex !== -1) {
    const prevJoined = parseInt(eventData[eventRowIndex][9] || '0', 10);
    eventSheet.getRange(eventRowIndex + 1, 10).setValue(prevJoined + numberOfPeople);
  }

  return getRegistrationList(`!查詢報名 ${eventCode}`);
  // return `✅ ${baseName} 已成功報名 ${numberOfPeople} 人，活動代碼：${eventCode}`;
}

/**
 * 查詢群組內開放中活動（包含場館名稱解析）
 * @param {string} groupId 群組 ID
 */
function getOpenEventList(groupId) {
  const sheet = onConn("events");
  const data = sheet.getDataRange().getValues();

  const openEvents = data.filter((row, idx) =>
    idx > 0 &&
    row[2] === groupId &&  // 第3欄是 groupId
    row[10] === "OPEN"     // 第11欄是 status
  );

  if (openEvents.length === 0) return '📭 此群組目前沒有開放報名中的活動';

  // 嘗試取得群組名稱
  let groupName = '此群組';
  const groupSheet = onConn("group_settings");
  const groupSettings = groupSheet.getDataRange().getValues();
  const groupRow = groupSettings.find(row => row[0] === groupId);
  if (groupRow && groupRow[1]) {
    groupName = groupRow[1];
  }

  // 場館對照表
  const locationMapList = locationMap(); // [{ arenaCode, name, address }]

  let msg = `📌 ${groupName} 目前開放中的活動：\n`;

  for (const row of openEvents) {
    const eventCode = row[1];
    const rawDate = row[3]; // eventDate
    const formattedDate = Utilities.formatDate(new Date(rawDate), 'Asia/Taipei', 'yyyy/MM/dd');
    const timeRange = row[5];
    const arenaCode = row[6];
    const joinedPeople = row[9] || 0;

    // 查找中文場館名稱
    const location = locationMapList.find(loc => loc.arenaCode === arenaCode);
    const arenaName = location ? location.name : '未知場館';

    msg += `\n🔸 代碼：${eventCode}\n📅 日期：${formattedDate}\n⏰ 時間：${timeRange}\n🏸 場館：${arenaName}（${arenaCode}）\n👥 已報名：${joinedPeople} 人\n`;
  }

  return msg.trim();
}



/**
 * 查詢指定活動報名名單
 * 依 orderNumber 排序
 */
function getRegistrationList(userMessage) {
  const match = userMessage.trim().match(/^!查詢報名\s+([A-Z]\d{2})$/);
  if (!match) {
    return '❌ 指令格式錯誤，請使用: !查詢報名 F01';
  }
  const eventCode = match[1];
  if (!isEventOpen(eventCode)) return `⚠️ 活動 ${eventCode} 已截止，無法查詢報名名單`;

  // 讀取活動資訊
  const eventSheet = onConn("events");
  const eventData = eventSheet.getDataRange().getValues();
  const event = eventData.find(row => row[1] === eventCode);
  if (!event) return `⚠️ 找不到代碼為 ${eventCode} 的活動`;
  const groupId = event[2];
  const eventDateRaw = event[3];
  const eventDate = Utilities.formatDate(new Date(eventDateRaw), 'Asia/Taipei', 'yyyy/MM/dd');
  const timeRange = event[5];
  const arenaCode = event[6];
  const address = event[7];
  const settingsSheet = onConn("group_settings");
  const settingsData = settingsSheet.getDataRange().getValues();
  const groupRow = settingsData.find(row => row[0] === groupId);
  const groupName = groupRow ? groupRow[1] : '未命名隊伍';
  const location = findLocationInfo(arenaCode);
  const arenaName = location?.name || arenaCode;

  // 報名資料
  const regSheet = onConn("registrations");
  const data = regSheet.getDataRange().getValues();
  // 過濾並排序
  const eventRegs = data.filter(row => row[1] === eventCode)
    .map(row => ({ name: row[3], order: parseInt(row[4], 10) || 0 }))
    .sort((a, b) => a.order - b.order);
  let lines = [];
  let index = 1;
  for (const reg of eventRegs) {
    lines.push(`${index}. ${reg.name}`);
    index++;
  }
  if (lines.length === 0) {
    return `📭 目前尚無人報名活動 ${eventCode}。`;
  }
  return (
    `📋 活動 ${eventCode} 報名名單（共 ${lines.length} 人）\n` +
    `🏷️ 球隊：${groupName}\n` +
    `📅 日期：${eventDate}\n` +
    `⏰ 時間：${timeRange}\n` +
    `🏸 場館：${arenaName}\n` +
    `📍 地址：${address}\n\n` +
    lines.join('\n')
  );
}

/**
 * 修改報名
 * 只增減/補齊 displayName 筆數，不會全部刪除重建。
 */
function updateRegistration(userId, messageText) {
  const match = messageText.match(/^!修改報名\s+(\w+)\s+(.+?)(?:\+(\d+))?(?:\s+(.*))?$/);
  if (!match) return '❌ 指令格式錯誤，請使用: !修改報名 F01 小明+2 備註內容';
  const [, eventCode, baseName, countStr, remark] = match;
  if (!isEventOpen(eventCode)) return `⚠️ 活動 ${eventCode} 已截止，無法修改報名`;
  const numberOfPeople = countStr ? parseInt(countStr, 10) : 1;
  const regSheet = onConn("registrations");
  let data = regSheet.getDataRange().getValues();
  // 找出該userId+eventCode下所有baseName開頭的資料，依orderNumber排序
  let userRegs = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === userId && obj.row[3].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[4], 10) - parseInt(b.row[4], 10));
  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  // 取得目前該活動最大orderNumber
  const eventRegs = data.filter(row => row[1] === eventCode);
  let maxOrder = 0;
  if (eventRegs.length > 0) {
    maxOrder = Math.max(...eventRegs.map(row => parseInt(row[4] || 0, 10)));
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
      .filter(obj => obj.row[1] === eventCode && obj.row[2] === userId && obj.row[3].startsWith(baseName))
      .sort((a, b) => parseInt(a.row[4], 10) - parseInt(b.row[4], 10));
    for (let i = 0; i < numberOfPeople; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 6).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(now);
    }
  } else if (numberOfPeople > userRegs.length) {
    // 2. 若新數量 > 原數量：保留原有，新增 displayName（如小明3、小明4...），orderNumber 接在最大 orderNumber 後面
    for (let i = 0; i < userRegs.length; i++) {
      regSheet.getRange(userRegs[i].idx + 1, 6).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(now);
    }
    for (let i = userRegs.length; i < numberOfPeople; i++) {
      const thisName = i === 0 ? baseName : baseName + (i + 1);
      const registerId = 'R' + new Date().getTime() + i;
      regSheet.appendRow([
        registerId,
        eventCode,
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
      regSheet.getRange(userRegs[i].idx + 1, 6).setValue(remark || '');
      regSheet.getRange(userRegs[i].idx + 1, 7).setValue(now);
    }
  }
  // 更新活動人數（重新統計該活動所有報名人數）
  data = regSheet.getDataRange().getValues();
  const newTotal = data.filter(row => row[1] === eventCode).length;
  const eventSheet = onConn("events");
  const eventData = eventSheet.getDataRange().getValues();
  const eventRowIndex = eventData.findIndex(row => row[1] === eventCode);
  if (eventRowIndex !== -1) {
    eventSheet.getRange(eventRowIndex + 1, 10).setValue(newTotal);
  }
  // 重新排序
  reorderRegistrations(eventCode);
  // return `✅ 已成功修改您於 ${eventCode} 的報名資訊：${baseName}+${numberOfPeople}`;
  return getRegistrationList(`!查詢報名 ${eventCode}`);
}

/**
 * 取消報名
 * 支援「!取消報名 F00 小明-2」格式，從最後一位開始連續刪除N筆
 */
function cancelRegistration(userId, userMessage) {
  const match = userMessage.match(/^!取消報名\s+([A-Z]\d{2})\s+(.+?)(?:-(\d+))?$/);
  if (!match) {
    return '⚠️ 指令格式錯誤，請使用 "!取消報名 活動代碼 暱稱" 或 "!取消報名 活動代碼 暱稱-2"';
  }
  const eventCode = match[1];
  const baseName = match[2].trim();
  const cancelCount = match[3] ? parseInt(match[3], 10) : 1;
  const regSheet = onConn("registrations");
  let data = regSheet.getDataRange().getValues();
  // 找出該userId+eventCode下所有baseName開頭的資料，依orderNumber排序
  let userRegs = data
    .map((row, idx) => ({ row, idx }))
    .filter(obj => obj.row[1] === eventCode && obj.row[2] === userId && obj.row[3].startsWith(baseName))
    .sort((a, b) => parseInt(a.row[4], 10) - parseInt(b.row[4], 10));
  if (userRegs.length === 0) {
    return `⚠️ 您尚未以「${baseName}」的名義報名活動 ${eventCode}，無法取消`;
  }
  // 實際要刪除的數量
  const toDeleteCount = Math.min(cancelCount, userRegs.length);
  const deletedNames = [];
  for (let i = 0; i < toDeleteCount; i++) {
    const toDelete = userRegs[userRegs.length - 1 - i];
    regSheet.deleteRow(toDelete.idx + 1);
    deletedNames.push(toDelete.row[3]);
  }
  // 更新活動人數
  const eventSheet = onConn("events");
  const eventData = eventSheet.getDataRange().getValues();
  const eventRowIndex = eventData.findIndex(row => row[1] === eventCode);
  if (eventRowIndex !== -1) {
    const prevJoined = parseInt(eventData[eventRowIndex][9] || '0', 10);
    eventSheet.getRange(eventRowIndex + 1, 10).setValue(Math.max(0, prevJoined - toDeleteCount));
  }
  // 重新排序
  reorderRegistrations(eventCode);
  // return `✅ 您已成功取消「${deletedNames.reverse().join('、')}」在活動 ${eventCode} 的報名`;
  return getRegistrationList(`!查詢報名 ${eventCode}`);
}

/**
 * 重新分配指定活動的順序號碼
 */
function reorderRegistrations(eventCode) {
  const regSheet = onConn("registrations");
  const data = regSheet.getDataRange().getValues();
  // 過濾出該活動的所有報名記錄
  const eventRegs = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === eventCode) {
      eventRegs.push({ rowIndex: i + 1 });
    }
  }
  // 重新分配順序號碼
  for (let i = 0; i < eventRegs.length; i++) {
    regSheet.getRange(eventRegs[i].rowIndex, 5).setValue(i + 1); // 第5欄為orderNumber
  }
}

/**
 * 關閉活動
 */
function closePastEvents() {
  const sheet = onConn("events");
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const status = row[10];  // status (第11欄)
    if (status !== "OPEN") continue;  // 只處理還是 OPEN 的活動

    const date = row[3];      // 活動日期 (第4欄)
    const timeRange = row[5]; // 活動時間 (第6欄)，如 "20-22"

    if (!date || !timeRange) continue;  // 資料不完整跳過

    const [startHour] = timeRange.split(/[-~]/).map(x => parseInt(x, 10));
    if (isNaN(startHour)) continue;  // 時間格式錯誤跳過

    // 組成活動開始的時間點
    const eventStart = new Date(date);
    eventStart.setHours(startHour);
    eventStart.setMinutes(0);
    eventStart.setSeconds(0);

    if (now >= eventStart) {
      // 活動已經開始，更新 status 欄位為 CLOSE
      sheet.getRange(i + 1, 11).setValue("CLOSE");  // 第11欄是 status
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
  const sheet = onConn("events");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (
      row[2] == groupId &&
      formatSheetDate(row[3]) == date &&
      row[5] == timeRange
    ) {
      return row[1]; // eventCode
    }
  }
  return null;
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
  return registerToEvent(userId, displayName, regMsg);
}

/**
 * 新格式取消報名主流程
 * 格式: !取消報名 7/16 18-21 小明-2
 */
function cancelRegistrationByDateTime(userId, groupId, messageText) {
  // 解析新格式
  const match = messageText.match(/^!取消報名\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}-\d{1,2})\s+([^\s]+)$/);
  if (!match) {
    return cancelRegistration(userId, messageText); // fallback 舊格式
  }
  const [, date, timeRange, nameAndCount] = match;
  const eventCode = findEventCodeByGroupDateTime(groupId, date, timeRange);
  if (!eventCode) {
    return `⚠️ 找不到 ${date} ${timeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合舊格式 "!取消報名 eventCode 小明-2"
  const regMsg = `!取消報名 ${eventCode} ${nameAndCount}`;
  return cancelRegistration(userId, regMsg);
}

/**
 * 新格式修改報名主流程
 * 格式: !修改報名 7/16 18-21 小明+2 備註
 */
function updateRegistrationByDateTime(userId, groupId, messageText) {
  // 解析新格式
  const match = messageText.match(/^!修改報名\s+(\d{1,2}\/\d{1,2})\s+(\d{1,2}-\d{1,2})\s+([^\s]+)(?:\s+(.*))?$/);
  if (!match) {
    return updateRegistration(userId, messageText); // fallback 舊格式
  }
  const [, date, timeRange, nameAndCount, remark] = match;
  const eventCode = findEventCodeByGroupDateTime(groupId, date, timeRange);
  if (!eventCode) {
    return `⚠️ 找不到 ${date} ${timeRange} 的開團，請確認日期與時間格式正確。`;
  }
  // 組合舊格式 "!修改報名 eventCode 小明+2 備註"
  const regMsg = `!修改報名 ${eventCode} ${nameAndCount}${remark ? ' ' + remark : ''}`;
  return updateRegistration(userId, regMsg);
}

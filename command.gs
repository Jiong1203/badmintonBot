/**
 * command.gs
 * 指令統一處理模組
 */
// 依賴 utils/date.gs, utils/location.gs, data/sheets.gs, user.gs
// 請直接使用 getWeekdayNumber, changeChinese, calculateDate, formatDate, findLocationInfo, getSheetData, appendRow 等工具

// 教學與錯誤訊息集中
const HELP_TEXT = {
  teaching: `🏸 羽球人機器人教學選單 🏸\n\n請輸入以下指令獲得詳細說明：\n• !報名教學 － 報名/修改/取消/查詢等功能說明\n• !開團教學 － 如何開團與開團格式說明\n• !管理員教學 － 管理員權限與群組設定說明`,
  signup: `📝 報名功能教學\n\n• 報名：!報名 活動代碼 暱稱+人數 [備註]\n  例：!報名 F01 小明+2 會晚到\n  → 若報名2人，會產生「小明」、「小明2」兩筆資料\n\n• 修改報名：!修改報名 活動代碼 暱稱+人數 [備註]\n  例：!修改報名 F01 小明+3 改帶朋友\n  → 會自動增減/補齊人數，新增的排在最後\n\n• 取消報名：!取消報名 活動代碼 暱稱[-N]\n  例：!取消報名 F01 小明-2\n  → 會從最後一位開始連續刪除N筆（如小明2、小明）\n\n• 查詢報名：!查詢報名 活動代碼\n\n• 查詢活動：!查詢活動\n  → 查看目前本群組所有開放中的活動\n\n⚠️ 報名順序會自動分配，查詢時依順序顯示`,
  event: `📣 開團教學\n\n• 基本格式：\n  !週X開團 地點\n  !下週X開團 地點\n  !下下週X開團 地點\n\n• 指定時間：\n  !週五20-23開團 超速\n  !下週三18~21開團 大高雄\n\n• 地點可輸入關鍵字，系統自動比對場館\n\n• 範例：\n  !週五開團 大高雄\n  !下週日20-23開團 超速`,
  admin: `🛠️ 管理員功能教學 🛠️\n\n🔧 管理指令列表：\n!成為管理員 → 向群組申請為第一位管理員\n!加入管理員 @暱稱 → 將他人加入本群管理員（需為現任管理員）\n!退出管理員 → 放棄自己的管理員身分\n!移除管理員 @暱稱 → 將指定暱稱的管理員移除（需為 admin）\n\n⚙️ 群組預設設定指令：\n!設定球隊 團名 → 設定球隊名稱（如 一起打羽球羽球隊）\n!設定場館 關鍵字或代碼 → 設定開團預設場館（可用模糊比對）\n!設定時間 起始-結束 → 設定預設時段，如 20-22\n!設定人數 數量 → 設定最低成團人數（如 4）\n\n📋 查詢與重置：\n!查詢設定 → 檢視目前群組的預設值\n!重置設定 → 將預設值重設為 K00、20-22、4\n\n⚠️ 僅限管理員執行設定指令，其他使用者會被拒絕`
};

const ERROR_MSG = {
  parse: '無法解析指令，請輸入如 "!週五開團 大高雄" 等格式',
  weekday: '星期格式錯誤'
};

// 指令表（精準比對）
const COMMANDS = {
  '!教學': () => ({ tutorial: HELP_TEXT.teaching }),
  '!報名教學': () => ({ tutorial: HELP_TEXT.signup }),
  '!開團教學': () => ({ tutorial: HELP_TEXT.event }),
  '!管理員教學': () => ({ tutorial: HELP_TEXT.admin }),
  '!成為管理員': () => ({ groupSetting: '成為管理員' }),
  '!退出管理員': () => ({ groupSetting: '退出管理員' }),
  '!查詢設定': () => ({ groupSetting: '查詢設定' }),
  '!重置設定': () => ({ groupSetting: '重置設定' })
};

/**
 * 統一處理所有指令（含正則判斷）
 * @param {string} userCommand 使用者輸入的指令
 * @returns {object} 指令處理結果
 */
function handleCommand(userCommand, groupId = null) {
  const normalizedCommand = normalizeCommand(userCommand);

  // 精準匹配指令表
  if (COMMANDS[normalizedCommand]) {
    return COMMANDS[normalizedCommand]();
  }

  // 報名相關指令（統一 event key）
  if (normalizedCommand.startsWith('!報名 ')) return { event: 'create' };
  if (normalizedCommand.startsWith('!修改報名 ')) return { event: 'update' };
  if (normalizedCommand.startsWith('!取消報名 ')) return { event: 'delete' };
  if (normalizedCommand.startsWith('!查詢報名 ')) return { event: 'list' };
  if (normalizedCommand === '!查詢活動') return { event: 'openList' };

  // 管理設定指令
  if (normalizedCommand.startsWith('!設定球隊')) {
    const groupName = normalizedCommand.split(' ')[1]?.trim();
    return { groupSetting: '設定球隊', value: groupName, originalCommand: '!設定球隊 ' + groupName };
  }
  if (normalizedCommand.startsWith('!設定場館')) {
    const code = normalizedCommand.split(' ')[1]?.trim();
    return { groupSetting: '設定場館', value: code, originalCommand: '!設定場館 ' + code };
  }
  if (normalizedCommand.startsWith('!設定時間')) {
    const time = normalizedCommand.split(' ')[1]?.trim();
    return { groupSetting: '設定時間', value: time, originalCommand: '!設定時間 ' + time };
  }
  
  if (normalizedCommand.startsWith('!設定人數')) {
    const num = normalizedCommand.split(' ')[1]?.trim();
    return { groupSetting: '設定人數', value: num, originalCommand: '!設定人數 ' + num };
  }

  // 處理：!加入管理員 @暱稱 / !移除管理員 @暱稱
  const adminModifyMatch = normalizedCommand.match(/^!(加入|移除)管理員\s+@?(.+)$/);
  if (adminModifyMatch) {
    return {
      groupSetting: adminModifyMatch[1] === '加入' ? '加入管理員' : '移除管理員',
      targetName: adminModifyMatch[2].trim()
    };
  }

  // 報名相關指令（不帶參數時，給出對應的格式提示）
  if (normalizedCommand.startsWith('!報名')) {
    return { error: '⚠️ 報名格式錯誤，請使用：\n!報名 活動代碼 暱稱+人數 備註\n或 !報名 日期 時間 暱稱+人數 備註\n\n範例：\n!報名 F01 小明+2 會晚到\n!報名 7/14 20-22 小明+2' };
  }
  if (normalizedCommand.startsWith('!修改報名')) {
    return { error: '⚠️ 修改報名格式錯誤，請使用：\n!修改報名 活動代碼 暱稱+人數 備註\n\n範例：!修改報名 F01 小明+3 改帶朋友' };
  }
  if (normalizedCommand.startsWith('!取消報名')) {
    return { error: '⚠️ 取消報名格式錯誤，請使用：\n!取消報名 活動代碼 暱稱\n或 !取消報名 活動代碼 暱稱-數量\n\n範例：!取消報名 F01 小明-2' };
  }
  if (normalizedCommand.startsWith('!查詢報名')) {
    return { error: '⚠️ 查詢報名格式錯誤，請使用：\n!查詢報名 活動代碼\n\n範例：!查詢報名 F01' };
  }

  // 處理：!週五20-22開團 地點 或 !週二1930-2130開團 地點
  const openEventMatch = normalizedCommand.match(/^!(下下週|下週|週)([日一二三四五六])(?:(\d{1,4})[-~](\d{1,4}))?開團(?:\s+(.+))?$/);
  if (!openEventMatch) {
    return { error: ERROR_MSG.parse };
  }

  const weekPrefix = openEventMatch[1];       // 週、下週、下下週
  const dayChar = openEventMatch[2];          // 日～六
  let startHour = openEventMatch[3] ? parseInt(openEventMatch[3], 10) : null;
  let endHour = openEventMatch[4] ? parseInt(openEventMatch[4], 10) : null;
  const locationInput = openEventMatch[5] ? openEventMatch[5].trim() : null;

  const weekday = getWeekdayNumber(dayChar);
  if (weekday === -1) return { error: ERROR_MSG.weekday };

  let offset = 0;
  if (weekPrefix === '下週') offset = 1;
  if (weekPrefix === '下下週') offset = 2;

  const eventDateObj = calculateDate(weekday, offset);
  const eventDate = eventDateObj.targetDate;
  const eventDay = eventDateObj.targetDay;

  // 嘗試載入群組預設值
  let groupSettings = null;
  if (groupId) {
    const sheetData = getSheetData("group_settings");
    const row = sheetData.find(row => row[0] === groupId);
    if (row) {
      groupSettings = {
        groupName: row[1],
        defaultArenaCode: row[2],
        defaultDayTime: row[3],
        minCount: parseInt(row[4], 10)
      };
    }
  }

  // 若未指定時間則套用預設值
  if (!startHour || !endHour) {
    const defaultTime = groupSettings?.defaultDayTime || '';
    if (defaultTime.includes('-')) {
      const [sh, eh] = defaultTime.split('-').map(x => parseInt(x, 10));
      startHour = sh;
      endHour = eh;
    } else {
      startHour = 20;
      endHour = 22;
    }
  }

  // 若未指定地點則套用預設場館
  let locationInfo = findLocationInfo(locationInput);
  if (!locationInfo && groupSettings?.defaultArenaCode) {
    locationInfo = findLocationInfo(groupSettings.defaultArenaCode);
  }

  return {
    eventDate: formatDate(eventDate),
    eventDay,
    locationInfo,
    startHour,
    endHour,
    groupName: (groupSettings?.groupName && groupSettings.groupName !== 'XX羽球隊') ? groupSettings.groupName : null,
    minCount: groupSettings?.minCount || null
  };
}

/**
 * 指令字串標準化（處理週、下週等同義字）
 */
function normalizeCommand(userCommand) {
  return userCommand
    .replace(/^!(周|星期|禮拜)/, '!週')
    .replace(/^!下(周|星期|禮拜)/, '!下週')
    .replace(/^!下下(周|星期|禮拜)/, '!下下週')
    .trim();
}

/**
 * 專門處理管理員相關指令
 */
function adminCommandHandler(groupId, userId, displayName, groupSettingObj) {
  const action = groupSettingObj.groupSetting;
  const targetName = groupSettingObj.targetName || null;
  const value = groupSettingObj.value || null;

  if (action === '成為管理員') {
    return tryBecomeAdmin(groupId, userId, displayName);
  }

  if (action === '加入管理員') {
    if (!targetName) return '⚠️ 請輸入欲加入的 @暱稱';
    if (!isUserExist(targetName)) return `⚠️ 無法找到使用者「${targetName}」，請確認該使用者是否曾與機器人互動過。`;
    return addGroupAdmin(groupId, userId, targetName);
  }

  if (action === '退出管理員') {
    return leaveAdmin(groupId, userId);
  }

  if (action === '移除管理員') {
    if (!targetName) return '⚠️ 請輸入欲移除的 @暱稱';
    if (!isUserExist(targetName)) return `⚠️ 無法找到使用者「${targetName}」，請確認該使用者是否曾與機器人互動過。`;
    return removeGroupAdmin(groupId, userId, targetName);
  }

  // 處理群組設定指令
  if (!isGroupAdmin(groupId, userId)) {
    return '⚠️ 僅限群組管理員可設定群組預設值';
  }
  // ⏬ 使用完整指令交由 groupSettingHandler 處理
  const originalCommandText = groupSettingObj.originalCommand || `!${action} ${value || ''}`.trim();
  return groupSettingHandler(groupId, userId, originalCommandText);
}

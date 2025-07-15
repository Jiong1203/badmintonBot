/**
 * command.gs
 * 指令統一處理模組
 */
// 指令表（精準比對）
const COMMANDS = {
  '!教學': () => teaching(),
  '!報名教學': () => signupTeaching(),
  '!開團教學': () => eventTeaching(),
  '!管理員教學': () => adminTeaching(),
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
  // 支援全形驚嘆號
  userCommand = userCommand.replace(/！/g, "!");
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
  if (normalizedCommand.startsWith('!設定截止')) {
    const days = normalizedCommand.split(' ')[1]?.trim();
    return { groupSetting: '設定截止', value: days, originalCommand: '!設定截止 ' + days };
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

  // 處理：!週五20-22開團 地點
  const match = normalizedCommand.match(/^!(下下週|下週|週)([日一二三四五六])(?:(\d{1,2})[-~](\d{1,2}))?開團(?:\s+(.+))?$/);
  if (!match) {
    return { error: '無法解析指令，請輸入如 "!週五開團 大高雄" 等格式' };
  }

  const weekPrefix = match[1];       // 週、下週、下下週
  const dayChar = match[2];          // 日～六
  let startHour = match[3] ? parseInt(match[3], 10) : null;
  let endHour = match[4] ? parseInt(match[4], 10) : null;
  const locationInput = match[5] ? match[5].trim() : null;

  const weekday = getWeekdayNumber(dayChar);
  if (weekday === -1) return { error: '星期格式錯誤' };

  let offset = 0;
  if (weekPrefix === '下週') offset = 1;
  if (weekPrefix === '下下週') offset = 2;

  const event = calculateDate(weekday, offset);
  const eventDate = event.targetDate;
  const eventDay = event.targetDay;

  // 嘗試載入群組預設值
  let groupSettings = null;
  if (groupId) {
    const sheetData = onConn("group_settings").getDataRange().getValues();
    const row = sheetData.find(row => row[0] === groupId);
    if (row) {
      groupSettings = {
        groupName: row[1],
        defaultArenaCode: row[2],
        defaultDayTime: row[3],
        deadlineDays: isNaN(parseInt(row[4], 10)) ? 2 : parseInt(row[4], 10),
        minCount: parseInt(row[5], 10)
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

  // 統計截止日
  const deadline = calculateDeadlineDate(eventDate, groupSettings?.deadlineDays || 2);

  return {
    eventDate: formatDate(eventDate),
    eventDay,
    deadlineDate: formatDate(deadline.deadlineDate),
    deadlineDay: deadline.deadlineDay,
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
  const originalCommandText = groupSettingObj.originalCommand || `${action} ${value || ''}`.trim();
  return groupSettingHandler(groupId, userId, originalCommandText);
}

/**
 * 「!教學」回應內容（主選單）
 */
function teaching() {
  return {
    tutorial:
`🎾 羽球人機器人教學選單 🎾

請輸入以下指令獲得詳細說明：
• !報名教學 － 報名/修改/取消/查詢等功能說明
• !開團教學 － 如何開團與開團格式說明
• !管理員教學 － 管理員權限與群組設定說明`
  };
}

/**
 * 「!報名教學」回應內容
 */
function signupTeaching() {
  return {
    tutorial:
`📝 報名功能教學

• 報名：!報名 活動代碼 暱稱+人數 [備註]
  例：!報名 F01 小明+2 會晚到
  → 若報名2人，會產生「小明」、「小明2」兩筆資料

• 修改報名：!修改報名 活動代碼 暱稱+人數 [備註]
  例：!修改報名 F01 小明+3 改帶朋友
  → 會自動增減/補齊人數，新增的排在最後

• 取消報名：!取消報名 活動代碼 暱稱[-N]
  例：!取消報名 F01 小明-2
  → 會從最後一位開始連續刪除N筆（如小明2、小明）

• 查詢報名：!查詢報名 活動代碼

• 查詢活動：!查詢活動
  → 查看目前本群組所有開放中的活動

⚠️ 報名順序會自動分配，查詢時依順序顯示`
  };
}

/**
 * 「!開團教學」回應內容
 */
function eventTeaching() {
  return {
    tutorial:
`📣 開團教學

• 基本格式：
  !週X開團 地點
  !下週X開團 地點
  !下下週X開團 地點

• 指定時間：
  !週五20-23開團 超速
  !下週三18~21開團 大高雄

• 地點可輸入關鍵字，系統自動比對場館

• 範例：
  !週五開團 大高雄
  !下週日20-23開團 超速`
  };
}

/**
 * 「!管理員教學」回應內容
 */
function adminTeaching() {
  return {
    tutorial:
`🛠️ 管理員功能教學 🛠️

🔧 管理指令列表：
!成為管理員 → 向群組申請為第一位管理員
!加入管理員 @暱稱 → 將他人加入本群管理員（需為現任管理員）
!退出管理員 → 放棄自己的管理員身分
!移除管理員 @暱稱 → 將指定暱稱的管理員移除（需為 admin）

⚙️ 群組預設設定指令：
!設定球隊 團名 → 設定球隊名稱（如 一起打羽球羽球隊）
!設定場館 關鍵字或代碼 → 設定開團預設場館（可用模糊比對）
!設定時間 起始-結束 → 設定預設時段，如 20-22
!設定截止 天數 → 設定統計截止為活動日前 X 天（例如 2）
!設定人數 數量 → 設定最低成團人數（如 4）

📋 查詢與重置：
!查詢設定 → 檢視目前群組的預設值
!重置設定 → 將預設值重設為 K00、20-22、2、4

⚠️ 僅限管理員執行設定指令，其他使用者會被拒絕`
  };
}

// 依賴 utils/location.gs, data/sheets.gs, user.gs
// 請直接使用 locationMap, findLocationInfo, getSheetData, appendRow 等工具

/**
 * 檢查是否為管理員
 */
function isGroupAdmin(groupId, userId) {
  const admins = getSheetData(SHEETS_CONFIG.SHEETS.GROUP_ADMINS);
  return admins.slice(1).some(row => row[0] === groupId && row[1] === userId);
}


/**
 * 成為管理員
 */
function tryBecomeAdmin(groupId, userId, userName) {
  const admins = getSheetData(SHEETS_CONFIG.SHEETS.GROUP_ADMINS);
  const hasAdmin = admins.slice(1).some(row => row[0] === groupId);
  if (hasAdmin) {
    return '⚠️ 本群組已經有管理員囉，如需加入請洽現有管理員協助 🙇';
  }

  // 若無任何管理員，允許此用戶自動成為 admin
  appendRow(SHEETS_CONFIG.SHEETS.GROUP_ADMINS, [groupId, userId, userName, GROUP_CONFIG.ADMIN_ROLES.ADMIN, '自動加入']);

  // 檢查 group_settings 是否已有該群資料，若無就初始化
  if (!containsValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId)) {
    const defaultSettings = [
      groupId,
      GROUP_CONFIG.DEFAULT_GROUP_NAME,
      GROUP_CONFIG.DEFAULT_ARENA_CODE,
      GROUP_CONFIG.DEFAULT_TIME_RANGE,
      GROUP_CONFIG.DEFAULT_DEADLINE_DAYS,
      GROUP_CONFIG.DEFAULT_MIN_COUNT
    ];
    appendRow(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, defaultSettings);
  }

  return `✅ 您已成為本群組的管理員 🎉\n現在可以開始使用 !設定 開頭的指令來設定群組開團偏好囉！`;
}

/**
 * 新增管理員
 */
function addGroupAdmin(groupId, operatorId, targetName) {
  if (!isGroupAdmin(groupId, operatorId)) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }
  const user = findRowByValue(SHEETS_CONFIG.SHEETS.USERS, 1, targetName);
  if (!user) {
    return `⚠️ 找不到暱稱為 @${targetName} 的使用者，請確認對方是否已說過話`;
  }
  const targetUserId = user[0];
  if (isGroupAdmin(groupId, targetUserId)) {
    return `⚠️ 使用者 @${targetName} 已是管理員`;
  }
  appendRow(SHEETS_CONFIG.SHEETS.GROUP_ADMINS, [groupId, targetUserId, targetName, GROUP_CONFIG.ADMIN_ROLES.EDITOR, '由其他管理員加入']);
  return SUCCESS_MESSAGES.ADMIN_ADDED(targetName);
}

/**
 * 退出管理員 
 */
function leaveAdmin(groupId, userId) {
  const admins = getSheetData(SHEETS_CONFIG.SHEETS.GROUP_ADMINS);
  const rowIndex = admins.findIndex(row => row[0] === groupId && row[1] === userId);
  if (rowIndex > 0) {
    deleteRow(SHEETS_CONFIG.SHEETS.GROUP_ADMINS, rowIndex + 1);
    return '✅ 您已成功退出本群組的管理員身份';
  }
  return '⚠️ 您目前不是本群組的管理員';
}

/**
 * 刪除管理員
 */
function removeGroupAdmin(groupId, operatorId, targetName) {
  const admins = getSheetData(SHEETS_CONFIG.SHEETS.GROUP_ADMINS);
  const operatorRow = admins.find(row => row[0] === groupId && row[1] === operatorId);
  if (!operatorRow || operatorRow[3] !== GROUP_CONFIG.ADMIN_ROLES.ADMIN) {
    return '⚠️ 只有 admin 才能移除管理員';
  }
  const targetRowIndex = admins.findIndex(row => row[0] === groupId && row[2] === targetName);
  if (targetRowIndex > 0) {
    deleteRow(SHEETS_CONFIG.SHEETS.GROUP_ADMINS, targetRowIndex + 1);
    return SUCCESS_MESSAGES.ADMIN_REMOVED(targetName);
  }
  return `⚠️ 找不到名稱為 @${targetName} 的管理員`;
}


/**
 * 處理群組設定的指令
 * @param {string} groupId 
 * @param {string} userId 
 * @param {string} commandText 
 * @returns {string}
 */
function groupSettingHandler(groupId, userId, commandText) {
  if (!isGroupAdmin(groupId, userId)) {
    return ERROR_MESSAGES.ADMIN_ONLY;
  }

  const command = commandText.split(' ')[0];
  const value = commandText.substring(command.length).trim();
  let rowIndex = findRowIndexByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);

  if (rowIndex === -1) {
    appendRow(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, [
      groupId,
      GROUP_CONFIG.DEFAULT_GROUP_NAME,
      GROUP_CONFIG.DEFAULT_ARENA_CODE,
      GROUP_CONFIG.DEFAULT_TIME_RANGE,
      GROUP_CONFIG.DEFAULT_DEADLINE_DAYS,
      GROUP_CONFIG.DEFAULT_MIN_COUNT
    ]);
    rowIndex = getLastRow(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS);
  }

  switch (command) {
    case '!設定球隊':
      setCellValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 2, value);
      return SUCCESS_MESSAGES.SETTING_UPDATED('球隊名稱', value);
    
    case '!設定場館':
      if (!value) return '⚠️ 請提供場館代碼或關鍵字';
      const locationInfo = findLocationInfo(value);
      if (!locationInfo) return ERROR_MESSAGES.INVALID_ARENA;
      setCellValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 3, locationInfo.arenaCode);
      return SUCCESS_MESSAGES.SETTING_UPDATED('預設場館', `${locationInfo.name} (${locationInfo.arenaCode})`);

    case '!設定時間':
      if (!/^\d{1,2}-\d{1,2}$/.test(value)) return ERROR_MESSAGES.INVALID_TIME;
      setCellValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 4, value);
      return SUCCESS_MESSAGES.SETTING_UPDATED('預設時間', value);

    case '!設定截止':
      const days = parseInt(value, 10);
      if (isNaN(days)) return ERROR_MESSAGES.INVALID_NUMBER;
      setCellValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 5, days);
      return `✅ 截止規則已設定為活動日前 ${days} 天`;

    case '!設定人數':
      const num = parseInt(value, 10);
      if (isNaN(num)) return ERROR_MESSAGES.INVALID_NUMBER;
      setCellValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 6, num);
      return SUCCESS_MESSAGES.SETTING_UPDATED('最低成團人數', num);
    
    case '!查詢設定':
      const settingsRow = findRowByValue(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, 0, groupId);
      if (!settingsRow) return '⚠️ 查無本群組設定，請先由管理員設定！';
      const arenaInfo = getLocationByCode(settingsRow[2]);
      const arenaDisplay = arenaInfo ? `${arenaInfo.name}(${settingsRow[2]})` : `（找不到代碼 ${settingsRow[2]} 的場館）`;
      return `📋 群組目前設定：\n- 球隊名稱：${settingsRow[1]}\n- 預設場館：${arenaDisplay}\n- 時間區段：${settingsRow[3]}\n- 截止日：活動日 -${settingsRow[4]} 天\n- 成團人數：${settingsRow[5]} 人`;

    case '!重置設定':
      const defaultValues = [[
        GROUP_CONFIG.DEFAULT_GROUP_NAME,
        GROUP_CONFIG.DEFAULT_ARENA_CODE,
        GROUP_CONFIG.DEFAULT_TIME_RANGE,
        GROUP_CONFIG.DEFAULT_DEADLINE_DAYS,
        GROUP_CONFIG.DEFAULT_MIN_COUNT
      ]];
      setRangeData(SHEETS_CONFIG.SHEETS.GROUP_SETTINGS, rowIndex, 2, defaultValues);
      return '🔄 群組設定已重置為預設值';

    default:
      return '⚠️ 無法辨識設定指令，請確認格式是否正確';
  }
}


// 依賴 utils/location.gs, data/sheets.gs, user.gs
// 請直接使用 locationMap, findLocationInfo, getSheetData, appendRow 等工具

/**
 * 檢查是否為管理員
 */
function isGroupAdmin(groupId, userId) {
  const sheet = onConn("group_admins");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupId) {
      if (data[i][1] === userId) return true;
    }
  }
  return false;
}


/**
 * 成為管理員
 */
function tryBecomeAdmin(groupId, userId, userName) {
  const sheet = onConn("group_admins");
  const data = sheet.getDataRange().getValues();

  // 先檢查此群組是否已經有管理員
  const hasAdmin = data.some(row => row[0] === groupId && (row[3] === 'admin' || row[3] === 'editor'));

  if (hasAdmin) {
    return '⚠️ 本群組已經有管理員囉，如需加入請洽現有管理員協助 🙇';
  }

  // 若無任何管理員，允許此用戶自動成為 admin
  sheet.appendRow([groupId, userId, userName, 'admin', '自動加入']);

  // ⏬ 檢查 group_settings 是否已有該群資料，若無就初始化
  const settingsSheet = onConn("group_settings");
  const settingsData = settingsSheet.getDataRange().getValues();
  const exists = settingsData.some(row => row[0] === groupId);

  if (!exists) {
    settingsSheet.appendRow([groupId, 'XX羽球隊', 'K00', '20-22', 2, 4]); 
  }

  return `✅ 您已成為本群組的管理員 🎉\n現在可以開始使用 !設定 開頭的指令來設定群組開團偏好囉！`;
}

/**
 * 新增管理員
 */
function addGroupAdmin(groupId, operatorId, targetName) {
  const sheet = onConn("group_admins");

  // 先確認 operator 是有權限的
  if (!isGroupAdmin(groupId, operatorId)) {
    return '⚠️ 您沒有權限新增管理員';
  }

  const userSheet = onConn("users");
  const users = userSheet.getDataRange().getValues();
  const matchedUser = users.find(row => row[1] === targetName);

  if (!matchedUser) {
    return `⚠️ 找不到暱稱為 @${targetName} 的使用者，請確認對方是否已說過話`;
  }

  const targetUserId = matchedUser[0];

  // 檢查是否已存在
  const admins = sheet.getDataRange().getValues();
  for (let i = 1; i < admins.length; i++) {
    if (admins[i][0] === groupId && admins[i][1] === targetUserId) {
      return `⚠️ 使用者 @${targetName} 已是管理員`;
    }
  }

  // 加入為 editor 預設
  sheet.appendRow([groupId, targetUserId, targetName, 'editor', '由其他管理員加入']);
  return `✅ 已成功將 @${targetName} 加入為管理員！`;
}

/**
 * 退出管理員 
 */
function leaveAdmin(groupId, userId) {
  const sheet = onConn("group_admins");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupId && data[i][1] === userId) {
      sheet.deleteRow(i + 1);
      return '✅ 您已成功退出本群組的管理員身份';
    }
  }
  return '⚠️ 您目前不是本群組的管理員';
}

/**
 * 刪除管理員
 */
function removeGroupAdmin(groupId, operatorId, targetName) {
  const sheet = onConn("group_admins");
  const data = sheet.getDataRange().getValues();

  // 確認執行者是 admin（不能只是 editor）
  const operatorRow = data.find(row => row[0] === groupId && row[1] === operatorId);
  if (!operatorRow || operatorRow[3] !== 'admin') {
    return '⚠️ 只有 admin 才能移除管理員';
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupId && data[i][2] === targetName) {
      sheet.deleteRow(i + 1);
      return `✅ 已成功移除 @${targetName} 的管理員權限`;
    }
  }
  return `⚠️ 找不到名稱為 @${targetName} 的管理員`;
}

/**
 * 群組設定
 */
function groupSettingHandler(groupId, userId, commandText) {
  if (!isGroupAdmin(groupId, userId)) {
    return '⚠️ 只有管理員可以設定群組參數';
  }

  const sheet = onConn("group_settings");
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;

  // 找到該群組設定 row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupId) {
      rowIndex = i + 1; // for setValue (1-based)
      break;
    }
  }

  if (rowIndex === -1) {
    sheet.appendRow([groupId, new Date(), '', '', -2, 4]);
    rowIndex = sheet.getLastRow();
  }

  if (rowIndex === -1) return '⚠️ 找不到該群組設定，請先申請為管理員';

  if (commandText.startsWith('!設定球隊')) {
    const groupName = commandText.split(' ')[1]?.trim();
    sheet.getRange(rowIndex, 2).setValue(groupName); // 第3欄 groupName
    return `✅ 球隊名稱已更新為 ${groupName}`;
  }

  if (commandText.startsWith('!設定場館')) {
    const input = commandText.split(' ')[1]?.trim();
    if (!input) return '⚠️ 請提供場館代碼或關鍵字，如：!設定場館 超速';

    const locationInfo = findLocationInfo(input); // 🔍 使用內建模糊比對方法
    if (!locationInfo) return `⚠️ 找不到符合「${input}」的場館，請重新輸入`;

    sheet.getRange(rowIndex, 3).setValue(locationInfo.arenaCode); // 寫入代碼
    return `✅ 預設場館已更新為：${locationInfo.name}（${locationInfo.arenaCode}）`;
  }

  if (commandText.startsWith('!設定時間')) {
    const time = commandText.split(' ')[1]?.trim();
    sheet.getRange(rowIndex, 4).setValue(time); // 第4欄 defaultDayTime
    return `✅ 預設時間已更新為 ${time}`;
  }

  if (commandText.startsWith('!設定截止')) {
    const days = parseInt(commandText.split(' ')[1]?.trim());
    if (isNaN(days)) return '⚠️ 請輸入數字天數，如 -2';
    sheet.getRange(rowIndex, 5).setValue(days);
    return `✅ 截止規則已設定為活動日前 ${-days} 天`;
  }

  if (commandText.startsWith('!設定人數')) {
    const num = parseInt(commandText.split(' ')[1]?.trim());
    if (isNaN(num)) return '⚠️ 請輸入數字';
    sheet.getRange(rowIndex, 6).setValue(num);
    return `✅ 最低成團人數已設定為 ${num}`;
  }

  if (commandText === '查詢設定') {
    const settings = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];
    const arenaCode = settings[2];
    const locationInfo = locationMap().find(loc => loc.arenaCode === arenaCode);

    const arenaDisplay = locationInfo ? `${locationInfo.name}(${arenaCode})` : `（找不到代碼 ${arenaCode} 的場館）`;

    return `📋 群組目前設定：
- 球隊名稱：${settings[1]}
- 預設場館：${arenaDisplay}
- 時間區段：${settings[3]}
- 截止日：活動日 -${settings[4]} 天
- 成團人數：${settings[5]} 人`;
  }

  if (commandText === '重置設定') {
    sheet.getRange(rowIndex, 2).setValue('XX羽球隊');  // 群組名稱
    sheet.getRange(rowIndex, 3).setValue('K00');        // 場館代碼
    sheet.getRange(rowIndex, 4).setValue('20-22');      // 時間區段
    sheet.getRange(rowIndex, 5).setValue(2);            // 截止日（活動日前 X 天）
    sheet.getRange(rowIndex, 6).setValue(4);            // 最低成團人數

    return '🔄 群組設定已重置為預設值';
  }

  return '⚠️ 無法辨識設定指令，請確認格式是否正確';
}


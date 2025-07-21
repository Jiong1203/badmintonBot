// 依賴 data/sheets.gs, config/constants.gs
// 請直接使用 getSheetData, appendRow, findRowIndexByValue, setCellValue 等工具

/**
 * 記錄使用者資訊，若已存在且暱稱不同則更新
 */
function recordUser(userId, displayName) {
  const now = Utilities.formatDate(new Date(), USER_CONFIG.TIMEZONE, USER_CONFIG.DATE_FORMAT);
  const rowIndex = findRowIndexByValue(SHEETS_CONFIG.SHEETS.USERS, 0, userId);

  if (rowIndex > 0) {
    const existingUser = getSheetData(SHEETS_CONFIG.SHEETS.USERS)[rowIndex - 1];
    if (existingUser[1] !== displayName) {
      setCellValue(SHEETS_CONFIG.SHEETS.USERS, rowIndex, 2, displayName);
      setCellValue(SHEETS_CONFIG.SHEETS.USERS, rowIndex, 3, now);
    }
  } else {
    appendRow(SHEETS_CONFIG.SHEETS.USERS, [userId, displayName, now]);
  }
}

/**
 * 透過 LINE API 取得使用者顯示名稱
 */
function getUserDisplayName(userId) {
  const url = `${LINE_CONFIG.PROFILE_URL}${userId}`;
  const options = {
    method: 'get',
    headers: { 'Authorization': `Bearer ${LINE_CONFIG.CHANNEL_ACCESS_TOKEN}` },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const profile = JSON.parse(response.getContentText());
      return profile.displayName;
    }
  } catch (e) {
    logError(`取得使用者名稱失敗 for userId: ${userId}, error: ${e.toString()}`);
  }
  return USER_CONFIG.UNKNOWN_USER;
}

/** 
 * 檢查指定暱稱的使用者是否存在
 */
function isUserExist(displayName) {
  const users = getSheetData(SHEETS_CONFIG.SHEETS.USERS);
  return users.slice(1).some(row => row[1] === displayName);
}

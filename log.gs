// 依賴 data/sheets.gs
// 請直接使用 getSheetData, appendRow 等工具

// 操作記錄
function logError(message, userId = '', displayName = '') {
  const sheet = onConn("logs");
  const timestamp = new Date();
  sheet.appendRow([timestamp, message, userId, displayName]);
}
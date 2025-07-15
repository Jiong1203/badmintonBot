// 操作記錄
function logError(message, userId = '', displayName = '') {
  const sheet = onConn("logs");
  const timestamp = new Date();
  sheet.appendRow([timestamp, message, userId, displayName]);
}
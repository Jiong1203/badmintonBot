// 依賴 data/sheets.gs, config/constants.gs

/**
 * 寫入操作日誌
 * @param {string} message - 日誌訊息
 * @param {string} [userId=''] - 使用者ID
 * @param {string} [displayName=''] - 使用者暱稱
 */
function logError(message, userId = '', displayName = '') {
  try {
    const timestamp = new Date();
    appendRow(SHEETS_CONFIG.SHEETS.LOGS, [timestamp, message, userId, displayName]);
  } catch (e) {
    // 如果連寫入日誌都失敗，就在 Apps Script 的日誌中記錄下來
    console.error("Failed to write to log sheet:", e);
  }
}
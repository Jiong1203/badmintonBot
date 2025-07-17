/**
 * Google Sheets 操作抽象層
 * 集中管理所有 Google Sheets 相關操作
 */

/**
 * 開啟指定工作表
 * @param {string} sheetName - 工作表名稱
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 工作表物件
 */
function onConn(sheetName) {
  return SpreadsheetApp.openById(SHEETS_CONFIG.SPREADSHEET_ID).getSheetByName(sheetName);
}

/**
 * 取得工作表所有資料
 * @param {string} sheetName - 工作表名稱
 * @returns {Array} 資料陣列
 */
function getSheetData(sheetName) {
  const sheet = onConn(sheetName);
  return sheet.getDataRange().getValues();
}

/**
 * 新增一列資料
 * @param {string} sheetName - 工作表名稱
 * @param {Array} rowData - 列資料陣列
 */
function appendRow(sheetName, rowData) {
  const sheet = onConn(sheetName);
  sheet.appendRow(rowData);
}

/**
 * 更新指定儲存格
 * @param {string} sheetName - 工作表名稱
 * @param {number} row - 列號 (1-based)
 * @param {number} col - 欄號 (1-based)
 * @param {*} value - 新值
 */
function setCellValue(sheetName, row, col, value) {
  const sheet = onConn(sheetName);
  sheet.getRange(row, col).setValue(value);
}

/**
 * 刪除指定列
 * @param {string} sheetName - 工作表名稱
 * @param {number} row - 列號 (1-based)
 */
function deleteRow(sheetName, row) {
  const sheet = onConn(sheetName);
  sheet.deleteRow(row);
}

/**
 * 根據條件查找資料列
 * @param {string} sheetName - 工作表名稱
 * @param {number} searchCol - 搜尋欄位 (0-based)
 * @param {*} searchValue - 搜尋值
 * @returns {Array|null} 找到的資料列或 null
 */
function findRowByValue(sheetName, searchCol, searchValue) {
  const data = getSheetData(sheetName);
  for (let i = 1; i < data.length; i++) {
    if (data[i][searchCol] === searchValue) {
      return data[i];
    }
  }
  return null;
}

/**
 * 根據條件查找資料列索引
 * @param {string} sheetName - 工作表名稱
 * @param {number} searchCol - 搜尋欄位 (0-based)
 * @param {*} searchValue - 搜尋值
 * @returns {number} 找到的列索引 (1-based) 或 -1
 */
function findRowIndexByValue(sheetName, searchCol, searchValue) {
  const data = getSheetData(sheetName);
  for (let i = 1; i < data.length; i++) {
    if (data[i][searchCol] === searchValue) {
      return i + 1; // 轉換為 1-based 索引
    }
  }
  return -1;
}

/**
 * 根據條件篩選資料
 * @param {string} sheetName - 工作表名稱
 * @param {number} searchCol - 搜尋欄位 (0-based)
 * @param {*} searchValue - 搜尋值
 * @returns {Array} 符合條件的資料陣列
 */
function filterRowsByValue(sheetName, searchCol, searchValue) {
  const data = getSheetData(sheetName);
  return data.filter((row, index) => index > 0 && row[searchCol] === searchValue);
}

/**
 * 檢查工作表是否包含指定值
 * @param {string} sheetName - 工作表名稱
 * @param {number} searchCol - 搜尋欄位 (0-based)
 * @param {*} searchValue - 搜尋值
 * @returns {boolean} 是否包含
 */
function containsValue(sheetName, searchCol, searchValue) {
  const data = getSheetData(sheetName);
  return data.some((row, index) => index > 0 && row[searchCol] === searchValue);
}

/**
 * 取得工作表最後一列
 * @param {string} sheetName - 工作表名稱
 * @returns {number} 最後一列號碼
 */
function getLastRow(sheetName) {
  const sheet = onConn(sheetName);
  return sheet.getLastRow();
}

/**
 * 批次更新多個儲存格
 * @param {string} sheetName - 工作表名稱
 * @param {Array} updates - 更新陣列 [{row, col, value}, ...]
 */
function batchUpdate(sheetName, updates) {
  const sheet = onConn(sheetName);
  updates.forEach(update => {
    sheet.getRange(update.row, update.col).setValue(update.value);
  });
}

/**
 * 取得指定範圍的資料
 * @param {string} sheetName - 工作表名稱
 * @param {number} startRow - 開始列 (1-based)
 * @param {number} startCol - 開始欄 (1-based)
 * @param {number} numRows - 列數
 * @param {number} numCols - 欄數
 * @returns {Array} 資料陣列
 */
function getRangeData(sheetName, startRow, startCol, numRows, numCols) {
  const sheet = onConn(sheetName);
  return sheet.getRange(startRow, startCol, numRows, numCols).getValues();
}

/**
 * 設定指定範圍的資料
 * @param {string} sheetName - 工作表名稱
 * @param {number} startRow - 開始列 (1-based)
 * @param {number} startCol - 開始欄 (1-based)
 * @param {Array} values - 資料陣列
 */
function setRangeData(sheetName, startRow, startCol, values) {
  const sheet = onConn(sheetName);
  const numRows = values.length;
  const numCols = values[0] ? values[0].length : 0;
  if (numRows > 0 && numCols > 0) {
    sheet.getRange(startRow, startCol, numRows, numCols).setValues(values);
  }
} 
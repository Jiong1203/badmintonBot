/**
 * 場館查詢工具模組
 * 集中管理所有場館相關的查詢和轉換邏輯
 */

/**
 * 取得場館對照表
 * @returns {Array} 場館資料陣列
 */
function locationMap() {
  const sheet = onConn("arena");
  const data = sheet.getDataRange().getValues();
  const result = [];
  // 從第2列開始（因為第1列是欄位名稱）
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] && row[1] && row[2] && row[3]) { // 確保欄位都有資料
      result.push({
        arenaCode: row[0].toString().trim(),
        keyword: row[1].toString().trim(),
        name: row[2].toString().trim(),
        address: row[3].toString().trim(),
      });
    }
  }
  return result;
}

/**
 * 根據輸入查詢場館資訊
 * @param {string} input - 查詢關鍵字（代碼、關鍵字或名稱）
 * @returns {object|null} 場館資訊物件或 null
 */
function findLocationInfo(input) {
  if (!input) return null;
  const keyword = input.trim().toLowerCase();
  const locations = locationMap();
  // 支援 code / keyword / name 三種查找方式
  const found = locations.find(loc =>
    loc.arenaCode?.toLowerCase() === keyword ||
    loc.keyword.toLowerCase().includes(keyword) ||
    loc.name.toLowerCase().includes(keyword)
  );
  return found || null;
}

/**
 * 根據場館代碼取得場館資訊
 * @param {string} arenaCode - 場館代碼
 * @returns {object|null} 場館資訊物件或 null
 */
function getLocationByCode(arenaCode) {
  if (!arenaCode) return null;
  const locations = locationMap();
  return locations.find(loc => loc.arenaCode === arenaCode) || null;
}

/**
 * 取得預設場館資訊
 * @returns {object} 預設場館資訊
 */
function getDefaultLocation() {
  return {
    arenaCode: "K00",
    keyword: "大高雄",
    name: '大高雄羽球館大社館',
    address: "高雄市大社區和平路一段851號"
  };
}

/**
 * 格式化場館顯示字串
 * @param {object} locationInfo - 場館資訊物件
 * @returns {string} 格式化後的場館字串
 */
function formatLocationDisplay(locationInfo) {
  if (!locationInfo) {
    const defaultLoc = getDefaultLocation();
    return `🔆${defaultLoc.name}🔆${defaultLoc.address}`;
  }
  return `🔆${locationInfo.name}🔆${locationInfo.address}`;
}

/**
 * 驗證場館代碼是否有效
 * @param {string} arenaCode - 場館代碼
 * @returns {boolean} 是否有效
 */
function isValidArenaCode(arenaCode) {
  if (!arenaCode) return false;
  const location = getLocationByCode(arenaCode);
  return location !== null;
}

/**
 * 取得所有場館代碼列表
 * @returns {Array} 場館代碼陣列
 */
function getAllArenaCodes() {
  const locations = locationMap();
  return locations.map(loc => loc.arenaCode);
}

/**
 * 搜尋場館（模糊搜尋）
 * @param {string} searchTerm - 搜尋關鍵字
 * @returns {Array} 符合條件的場館陣列
 */
function searchLocations(searchTerm) {
  if (!searchTerm) return [];
  const keyword = searchTerm.trim().toLowerCase();
  const locations = locationMap();
  return locations.filter(loc =>
    loc.arenaCode.toLowerCase().includes(keyword) ||
    loc.keyword.toLowerCase().includes(keyword) ||
    loc.name.toLowerCase().includes(keyword) ||
    loc.address.toLowerCase().includes(keyword)
  );
} 
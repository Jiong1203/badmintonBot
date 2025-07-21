/**
 * 日期處理工具模組
 * 集中管理所有日期相關的計算和轉換邏輯
 */

/**
 * 把中文星期轉換成 JS 的 weekday 數值
 */
function getWeekdayNumber(weekdayText) {
  const map = {
    '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6
  };
  return map[weekdayText] ?? -1;
}

/**
 * 星期轉中文
 */
function changeChinese(day) {
  const map = {
    0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六'
  };
  return map[day] || '未知';
}

/**
 * 計算指定星期的日期
 * @param {number} weekday - 目標星期 (0-6)
 * @param {number} weekOffset - 週數偏移 (0=本週,1=下週,2=下下週)
 * @returns {object} { targetDate, targetDay }
 */
function calculateDate(weekday, weekOffset = 0) {
  const today = new Date();
  const currentDay = today.getDay();
  // 計算距離目標日的天數
  let diff = weekday - currentDay + (weekOffset * 7);
  if (diff <= 0) {
    diff += 7; // 往後跳到下一次目標 weekday
  }
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    targetDate: targetDate,
    targetDay: days[targetDate.getDay()]
  };
}

/**
 * 計算報名截止日
 * @param {Date} eventDate - 活動日期
 * @param {number} daysBefore - 活動日前幾天截止
 * @returns {object} { deadlineDate, deadlineDay }
 */
function calculateDeadlineDate(eventDate, daysBefore) {
  const deadline = new Date(eventDate);
  deadline.setDate(eventDate.getDate() - daysBefore);
  const day = deadline.getDay();
  return {
    deadlineDate: deadline,
    deadlineDay: day
  };
}

/**
 * 格式化日期為 MM/DD
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * 格式化日期為完整格式
 * @param {Date} date - 日期物件
 * @returns {string} yyyy/MM/dd 格式
 */
function formatFullDate(date) {
  return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy/MM/dd');
}

/**
 * 格式化時間為 HH:MM
 * @param {number} hour - 小時
 * @returns {string} 格式化後的時間字串
 */
function formatTime(hour) {
  return String(hour).padStart(2, '0') + ':00';
}

/**
 * 解析時間範圍字串
 * @param {string} timeRange - 時間範圍字串 (如 "20-22")
 * @returns {object} { startHour, endHour }
 */
function parseTimeRange(timeRange) {
  if (!timeRange || !timeRange.includes('-')) {
    return { startHour: 20, endHour: 22 }; // 預設值
  }
  const [start, end] = timeRange.split('-').map(x => parseInt(x, 10));
  return {
    startHour: start || 20,
    endHour: end || 22
  };
} 
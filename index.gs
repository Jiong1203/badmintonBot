// 入口檔案，將 webhook 處理導向 handlers/webhook.gs
// 其餘邏輯請於 handlers/webhook.gs 及各模組維護

// Google Apps Script 會自動呼叫 doPost
// 此處僅作為導向
function doPost(e) {
  return doPost(e); // handlers/webhook.gs 需有同名 function
}

/**
 * 開啟指定 TABLE
 */
function onConn(name) {
  return SpreadsheetApp.openById("1j6fozbv2TgjfbnNlQBIxrn109o6fxUQyq7es2m9g09Q").getSheetByName(name);
}

// 把中文星期轉換成 JS 的 weekday 數值
function getWeekdayNumber(weekdayText) {
  const map = {
    '日': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6
  };
  return map[weekdayText] ?? -1;
}

function locationMap() {
  const sheet = onConn("arena");
  const data = sheet.getDataRange().getValues(); // 讀取所有資料
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

// 計算報名截止日（活動日前兩天）
function calculateDeadlineDate(eventDate, daysBefore) {
  const deadline = new Date(eventDate);
  deadline.setDate(eventDate.getDate() - daysBefore);
  const day = deadline.getDay();
  return { deadlineDate: deadline, deadlineDay: day };
}

// 格式化日期為 MM/DD
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function calculateDate(weekday, weekOffset = 0) {
  const today = new Date();
  const currentDay = today.getDay(); // 今天星期幾（0~6）

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
 * 星期轉中文
 */
function changeChinese(day) {
  switch (day) {
          case 1:
              day = "一";
              break;
          case 2:
              day = "二";
              break;
          case 3:
              day = "三";
              break;
          case 4:
              day = "四";
              break;
          case 5:
              day = "五";
              break;
          case 6:
              day = "六";
              break;
          case 0:
              day = "日";
              break;
  }
  return day;
}

/**
 * 生成開團訊息
 */
function generateEventMessage(
  eventDate, deadlineDate, weekdayText, weekdayEnd, locationInfo = null, startHour = 20, endHour = 22, groupName, minCount = 4, eventCode) {
  const weekday = changeChinese(weekdayText);
  const endDay = changeChinese(weekdayEnd);

  const start = String(startHour).padStart(2, '0') + ':00';
  const end = String(endHour).padStart(2, '0') + ':00';

  const returnStr = `📣 ${groupName} 開團囉！
📅 日期：${eventDate}（星期${weekday}）
🕒 時間：${start}～${end}
📍 地點：${locationInfo ? '🔆' + locationInfo.name + '🔆' + locationInfo.address : '🔆大高雄羽球館大社館🔆高雄市大社區和平路一段85-1號'}
📝 活動代碼：${eventCode}
⏳ 截止時間：${deadlineDate}（${endDay}）
📊 成團人數門檻：${minCount || 4}人
請使用 "!報名 ${eventCode} 小明+2" 來報名 🙌`;

  logError(returnStr);

  return returnStr;

//   return `⚠️⚠️⚠️⚠️⚠️⚠️
// ${groupName}開團囉
// 開團時間：${eventDate}（${weekday}）${start}～${end}
// 統計一下會出現的人數哦🤗     

// 地點：${locationInfo ? '🔆' + locationInfo.name + '🔆' + locationInfo.address : '🔆大高雄羽球館大社館🔆高雄市大社區和平路一段85-1號'}

// *為方便場地安排，請盡量於${deadlineDate}（${ endDay }）前報名。
// *如人數未達${minCount}人，則取消開團。

// ⚠️請各位依照順序報下去‼️

// 1.
// 2.
// 3.
// 4.
// 5.
// 6.
// 7.
// 8.
// 9.
// 10.
// 11.
// 12.

// 回報請走格式📝     
// 謝謝配合唷👍`;
}

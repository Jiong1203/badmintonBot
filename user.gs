// 依賴 data/sheets.gs
// 請直接使用 getSheetData, appendRow 等工具

/**
 * 用戶新增 / 用戶名稱更新
 */
function recordUser(userId, displayName) {
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

  // 檢查這個 userId 是否已經存在（避免重複記錄）
  const sheet = onConn("users");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    const rowUserId = data[i][0];
    const rowDisplayName = data[i][1];

    if (rowUserId === userId) {
      // 如果 displayName 不一樣，則更新該列的 displayName 與時間
      if (rowDisplayName !== displayName) {
        sheet.getRange(i + 1, 2).setValue(displayName); // 第2欄：displayName
        sheet.getRange(i + 1, 3).setValue(now);         // 第3欄：時間
      }
      return; // 無論是否更新，這筆已存在就結束
    }
  }

  // 新增一筆紀錄
  sheet.appendRow([userId, displayName, now]);
}

/**
 * 取得用戶名稱
 */
function getUserDisplayName(userId) {
  var CHANNEL_ACCESS_TOKEN = 'TW2Hr46MLsq+Ue7P6PfJhPzVuOk4MZsrSh+KXLGCtgwyhzHth0BJh16thF1/+8VG4Z2FX4Sw1p3/nwko7UPNyBzxFD51NDihPRwA3GrIBOtlQWaPyNqchi1v0Kz5oRGAWujGuYttUWhBlagKhXEkbQdB04t89/1O/w1cDnyilFU=';
  var url = `https://api.line.me/v2/bot/profile/${userId}`;
  var options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    var profile = JSON.parse(response.getContentText());
    return profile.displayName;
  } else {
    return "未知使用者";
  }
}

/** 
 * 檢查 @暱稱 人員有無在users名單內 
 */
function isUserExist(displayName) {
  const sheet = onConn("users");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === displayName) {
      return true;
    }
  }
  return false;
}

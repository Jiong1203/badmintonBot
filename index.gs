// 入口檔案，將 webhook 處理導向 handlers/webhook.gs
// 其餘邏輯請於 handlers/webhook.gs 及各模組維護

function doPost(e) {
  // 判斷是來自 LINE Webhook 還是 LIFF 的請求
  // LINE Webhook 的請求會有 events 欄位
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.events) {
      // 這是 LINE Webhook 請求
      return WebhookHandler.handle(e);
    } else {
      // 這是 LIFF 的 POST 請求（開團資料提交）
      return doPostLiff(e);
    }
  } catch (error) {
    // 如果解析失敗，預設為 Webhook 請求
    return WebhookHandler.handle(e);
  }
}

// 處理 LIFF 的 GET 請求
function doGet(e) {
  // 如果請求參數中有 view=liff，則顯示 HTML 頁面
  if (e.parameter.view === 'liff') {
    // 嘗試使用 'liff' 或 'liff.html'，根據實際檔案名稱調整
    try {
      return HtmlService.createHtmlOutputFromFile('liff')
        .setTitle('開團表單 - 羽球人')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (e) {
      // 如果 'liff' 找不到，嘗試 'liff.html'
      return HtmlService.createHtmlOutputFromFile('liff.html')
        .setTitle('開團表單 - 羽球人')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }
  // 否則處理 API 請求（取得初始資料）
  return doGetLiff(e);
}

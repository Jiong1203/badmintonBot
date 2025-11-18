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

// 處理 LIFF 的 GET 請求（取得初始資料）
function doGet(e) {
  return doGetLiff(e);
}

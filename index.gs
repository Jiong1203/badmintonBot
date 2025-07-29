// 入口檔案，將 webhook 處理導向 handlers/webhook.gs
// 其餘邏輯請於 handlers/webhook.gs 及各模組維護

function doPost(e) {
  return WebhookHandler.handle(e);
}

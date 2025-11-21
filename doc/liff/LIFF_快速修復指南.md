# LIFF 快速修復指南

## 🔍 問題確認

您目前看到的 JSON 回應：
```json
{"groupName":"XX羽球隊","defaultArenaCode":"K00","defaultTimeRange":"20-22","startHour":20,"endHour":22,"minCount":4}
```

這表示 `doGet` 函數沒有正確判斷要顯示 HTML，而是直接執行了 `doGetLiff` 返回 JSON。

## ✅ 解決步驟

### 步驟 1：確認 HTML 檔案已建立

1. 在 Google Apps Script 專案中，確認是否有名為 **`liff`** 的 HTML 檔案
   - 檔案名稱必須是 `liff`（不是 `liff.html`）
   - 如果沒有，請新增一個 HTML 檔案，名稱設為 `liff`
   - 將 `liff.html` 的內容複製貼上（**只複製 `<html>` 標籤內的內容**）

### 步驟 2：更新 LINE Developer Console 的 LIFF Endpoint URL

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 進入「LIFF」頁籤
4. 找到您的 LIFF App（ID: `2008546267-jay6E0A4`）
5. 點擊「Edit」
6. 在 **Endpoint URL** 欄位中，**必須加上 `?view=liff` 參數**：

   **❌ 錯誤（目前設定）：**
   ```
   https://script.google.com/macros/s/AKfycbxJLQYms8XmxFSGxD94aKBnM4eCs77TNMMrJ7w-F-VTBwpk7hMyAZxcwn5TJG3_vhKr/exec
   ```

   **✅ 正確（應該設定為）：**
   ```
   https://script.google.com/macros/s/AKfycbxJLQYms8XmxFSGxD94aKBnM4eCs77TNMMrJ7w-F-VTBwpk7hMyAZxcwn5TJG3_vhKr/exec?view=liff
   ```

   注意：在 URL 最後加上 `?view=liff`

7. 點擊「Update」儲存

### 步驟 3：測試

1. 等待 1-2 分鐘讓設定生效
2. 在 LINE 中輸入 `!開團`
3. 點擊「開啟開團表單」按鈕
4. 應該看到完整的表單，而不是 JSON

## 🔍 如何確認 HTML 檔案是否正確

1. 在 Google Apps Script 編輯器中，左側檔案列表應該有：
   - `liff`（HTML 類型，圖示是 `</>`）
2. 點擊 `liff` 檔案，應該看到 HTML 內容
3. 如果沒有，請新增一個 HTML 檔案，名稱設為 `liff`

## 📝 重要提醒

- **HTML 檔案名稱必須是 `liff`**（在 Apps Script 中，HTML 檔案不需要 `.html` 副檔名）
- **LIFF Endpoint URL 必須包含 `?view=liff` 參數**
- **`webAppUrl` 在 `liff.html` 中應該指向完整的 Web App URL**（不包含 `?view=liff`）

## 🐛 如果還是看到 JSON

1. **檢查 HTML 檔案名稱**：必須是 `liff`，不是 `liff.html`
2. **檢查 LIFF Endpoint URL**：必須包含 `?view=liff`
3. **清除快取**：關閉並重新開啟 LINE
4. **檢查 Apps Script 執行記錄**：
   - 在 Apps Script 編輯器中，點擊「執行」→「查看執行記錄」
   - 看看是否有錯誤訊息

## 📋 完整設定檢查清單

- [ ] Google Apps Script 中有名為 `liff` 的 HTML 檔案
- [ ] HTML 檔案內容正確（包含完整的表單 HTML）
- [ ] LIFF Endpoint URL 設定為：`https://script.google.com/macros/s/.../exec?view=liff`
- [ ] `liff.html` 中的 `webAppUrl` 設定為：`https://script.google.com/macros/s/.../exec`（不包含 `?view=liff`）
- [ ] Web App 已部署且權限設為「所有人」


# LIFF 問題排除：顯示 JSON 而非表單

## 🔍 問題描述

點擊「開啟開團表單」按鈕後，LIFF 網頁開啟但只顯示 JSON 資料：
```json
{"groupName": "XX羽球隊","defaultArenaCode": "K00", "defaultTimeRange":"20-22","minCount":4}
```

而不是顯示表單。

## ❌ 問題原因

**LIFF 的 Endpoint URL 設定錯誤**：在 LINE Developer Console 中，LIFF App 的 Endpoint URL 指向了處理 API 的 Web App URL，而不是 HTML 頁面的 URL。

當開啟 LIFF 時，實際上是開啟了 Web App，而 Web App 的 `doGet` 函數返回的是 JSON 資料（群組設定），所以只看到 JSON。

## ✅ 解決方案

### 步驟 1：部署 HTML 頁面

您需要將 `liff.html` 部署為一個獨立的網頁。有兩種方式：

#### 方式 A：使用 Google Apps Script HTML Service（推薦）

1. 在 Google Apps Script 專案中，點擊「+」新增檔案
2. 選擇「HTML」類型
3. 檔案名稱設為 `liff`（或您喜歡的名稱）
4. 將 `liff.html` 的內容複製貼上（**只複製 `<html>` 標籤內的內容**，不需要 `<!DOCTYPE html>` 等）
5. 點擊「部署」→「新增部署作業」
6. 類型選擇「網頁應用程式」
7. 設定：
   - **執行身分**：我
   - **存取權限**：所有人
   - **應用程式**：選擇 `liff`（您剛建立的 HTML 檔案）
8. 點擊「部署」
9. **複製部署後的 URL**（這會是類似 `https://script.google.com/macros/s/.../exec` 的 URL）

#### 方式 B：使用外部託管服務

1. 將 `liff.html` 上傳到 GitHub Pages、Netlify、Vercel 等服務
2. 取得公開的網頁 URL（必須是 HTTPS）

### 步驟 2：更新 LINE Developer Console

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 進入「LIFF」頁籤
4. 找到您的 LIFF App（ID: `2008546267-jay6E0A4`）
5. 點擊「Edit」
6. 在 **Endpoint URL** 欄位中：
   - ❌ **錯誤**：`https://script.google.com/macros/s/.../exec`（這是 Web App URL，處理 API 的）
   - ✅ **正確**：`https://script.google.com/macros/s/.../exec`（但必須是 HTML 頁面的 URL，不是 API 的 URL）

   如果您使用方式 A（Apps Script HTML Service），應該會是：
   ```
   https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
   
   如果您使用方式 B（外部託管），應該是：
   ```
   https://your-domain.com/liff.html
   ```

7. 點擊「Update」儲存

### 步驟 3：確認設定

- ✅ LIFF Endpoint URL = HTML 頁面的 URL（顯示表單）
- ✅ `liff.html` 中的 `webAppUrl` = Web App URL（處理 API，提交資料）

## 📝 重要區分

### LIFF Endpoint URL（在 LINE Developer Console 設定）
- **用途**：LIFF 網頁的入口，顯示 HTML 表單
- **應該指向**：HTML 頁面的 URL
- **範例**：`https://script.google.com/macros/s/.../exec`（HTML Service）或 `https://your-domain.com/liff.html`

### Web App URL（在 liff.html 中設定）
- **用途**：處理 API 請求（取得資料、提交表單）
- **應該指向**：處理 `doGetLiff` 和 `doPostLiff` 的 Web App URL
- **範例**：`https://script.google.com/macros/s/AKfycbxJLQYms8XmxFSGxD94aKBnM4eCs77TNMMrJ7w-F-VTBwpk7hMyAZxcwn5TJG3_vhKr/exec`

## 🔄 如果使用同一個 Web App

如果您想在同一個 Web App 中同時處理 HTML 和 API，需要修改 `index.gs`：

```javascript
function doGet(e) {
  // 檢查是否有指定要顯示 HTML
  if (e.parameter.view === 'liff') {
    return HtmlService.createHtmlOutputFromFile('liff');
  }
  // 否則處理 API 請求
  return doGetLiff(e);
}
```

然後在 LINE Developer Console 中設定：
```
https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec?view=liff
```

## ✅ 驗證步驟

1. 更新 LIFF Endpoint URL 後，等待幾分鐘讓設定生效
2. 在 LINE 中輸入 `!開團`
3. 點擊「開啟開團表單」按鈕
4. 應該看到完整的表單（日期、時間、場館、人數欄位）
5. 不應該只看到 JSON 資料

## 🐛 如果還是看到 JSON

1. 清除 LINE 快取：關閉並重新開啟 LINE
2. 確認 LIFF Endpoint URL 是否正確
3. 檢查 Apps Script 的執行記錄，看是否有錯誤
4. 確認 HTML 檔案是否正確部署


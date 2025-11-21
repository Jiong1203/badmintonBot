# LIFF 開團功能設定說明

## 📋 概述

已將「!開團」指令改為使用 LIFF (LINE Front-end Framework) 網頁應用程式的方式。使用者點擊按鈕後會開啟一個網頁表單，填寫完成後即可開團。

## 🔧 設定步驟

### 步驟 1：建立 LIFF App

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 進入「LIFF」頁籤
4. 點擊「Add」新增 LIFF App
5. 填寫以下資訊：
   - **LIFF app name**: 開團表單（或您喜歡的名稱）
   - **Size**: Full（全螢幕）或 Tall（高型）
   - **Endpoint URL**: 您的 LIFF HTML 檔案網址
     - 建議使用 GitHub Pages、Netlify、Vercel 等服務託管
     - 或使用 Google Apps Script 的 HTML 服務（見下方說明）
   - **Scope**: 選擇「chat_message.write」（如果要在群組中推播訊息）
   - **Bot feature**: 啟用「Send messages」

6. 建立後，複製 **LIFF ID**

### 步驟 2：設定 Google Apps Script

#### 選項 A：使用 Google Apps Script 託管 HTML

1. 在 Google Apps Script 專案中，點擊「+」新增檔案
2. 選擇「HTML」類型
3. 將 `liff.html` 的內容貼上
4. 部署為網頁應用程式：
   - 點擊「部署」→「新增部署作業」
   - 類型選擇「網頁應用程式」
   - 執行身分：我
   - 存取權限：所有人
   - 點擊「部署」
5. 複製部署後的網頁 URL

#### 選項 B：使用外部託管服務

1. 將 `liff.html` 上傳到 GitHub Pages、Netlify、Vercel 等服務
2. 取得公開的網頁 URL

### 步驟 3：更新設定檔

1. 開啟 `constants.gs`
2. 更新以下常數：
   ```javascript
   LIFF_ID: 'YOUR_LIFF_ID_HERE', // 替換為步驟 1 取得的 LIFF ID
   LIFF_URL: 'https://liff.line.me/YOUR_LIFF_ID_HERE' // 替換為完整的 LIFF URL
   ```

3. 開啟 `liff.html`
4. 更新以下設定：
   ```javascript
   // 第 89 行附近
   liff.init({ liffId: 'YOUR_LIFF_ID_HERE' }) // 替換為您的 LIFF ID
   
   // 第 98 行附近
   webAppUrl = 'YOUR_WEB_APP_URL_HERE'; // 替換為您的 Apps Script Web App URL
   ```

### 步驟 4：部署 Web App（處理 LIFF 提交的資料）

1. 在 Google Apps Script 中，點擊「部署」→「管理部署作業」
2. 如果已有部署，點擊「編輯」；如果沒有，點擊「新增部署作業」
3. 類型選擇「網頁應用程式」
4. 設定：
   - **執行身分**：我
   - **存取權限**：所有人
5. 點擊「部署」
6. 複製部署後的 **Web App URL**，更新到 `liff.html` 的 `webAppUrl` 變數

## 📝 使用流程

1. 管理員在群組中輸入 `!開團`
2. Bot 回覆一個包含「開啟開團表單」按鈕的訊息
3. 使用者點擊按鈕，開啟 LIFF 網頁
4. 在網頁中填寫：
   - 日期
   - 時間（開始-結束）
   - 場館
   - 最低成團人數
5. 點擊「確認開團」
6. 系統建立活動並推播開團公告到群組
7. LIFF 網頁顯示成功訊息並自動關閉

## 🔍 測試步驟

1. 確保您已設定好所有常數和 URL
2. 在 LINE 中輸入 `!開團`
3. 點擊「開啟開團表單」按鈕
4. 確認 LIFF 網頁正常開啟
5. 填寫表單並提交
6. 確認活動成功建立並推播到群組

## ⚠️ 注意事項

1. **LIFF ID 和 URL 必須正確**：否則無法開啟網頁
2. **Web App URL 必須正確**：否則無法提交資料
3. **權限設定**：確保 Web App 的存取權限設為「所有人」
4. **CORS 問題**：如果使用外部託管，可能需要設定 CORS 標頭
5. **HTTPS 要求**：LIFF 必須使用 HTTPS，確保您的網頁 URL 是 HTTPS

## 🔄 恢復 Flex Message 版本

如果需要恢復原本的 Flex Message 版本：

1. 在 `webhook.gs` 中，將 `handleLiffCreateEvent` 改回 `handleFlexCreateEvent`
2. 在 `flexmessage.gs` 中，取消註解 `handleFlexCreateEvent` 和 `handleFlexPostback` 函數
3. 在 `webhook.gs` 中，取消註解 Postback 處理的程式碼

## 🐛 疑難排解

### 問題：點擊按鈕沒有反應
- 檢查 LIFF ID 是否正確
- 檢查 LIFF App 是否已啟用
- 確認使用者已加入 Bot 為好友

### 問題：無法載入場館列表
- 檢查 Web App URL 是否正確
- 檢查 `doGetLiff` 函數是否正常運作
- 查看 Apps Script 的執行記錄

### 問題：提交表單後沒有反應
- 檢查 Web App URL 是否正確
- 檢查 `doPostLiff` 函數是否正常運作
- 查看 Apps Script 的執行記錄和錯誤訊息
- 確認群組 ID 是否正確傳遞

### 問題：無法推播訊息到群組
- 確認 LIFF App 的 Scope 包含 `chat_message.write`
- 確認 Bot 有推播權限
- 檢查 `pushMessageToGroup` 函數的實作

## 📚 相關文件

- [LINE LIFF 官方文件](https://developers.line.biz/zh-hant/docs/liff/)
- [Google Apps Script HTML Service](https://developers.google.com/apps-script/guides/html)


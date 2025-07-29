# badmintonBot
羽球人_LINE BOT

## 專案架構

### 目前架構 (重構後)
```
badmintonBot/
├── index.gs              # 主要入口點 (簡化)
├── webhook.gs            # LINE Webhook 處理
├── command.gs            # 指令解析與路由
├── event.gs              # 活動相關業務邏輯
├── group.gs              # 群組相關業務邏輯
├── user.gs               # 使用者相關業務邏輯
├── date.gs               # 日期處理工具
├── location.gs           # 場館查詢工具
├── sheets.gs             # Google Sheets 操作抽象層
├── constants.gs          # 所有常數與設定
└── log.gs                # 日誌記錄
```

## 設計原則

### 1. 分層架構 (Layered Architecture)
- **表現層**: `webhook.gs` - 處理外部請求，並將請求分派給指令處理層。
- **指令層**: `command.gs` - 解析使用者指令，並呼叫對應的業務邏輯。
- **業務層**: `event.gs`, `group.gs`, `user.gs` - 處理核心業務邏輯。
- **資料層**: `sheets.gs` - 封裝所有 Google Sheets 的資料存取操作。
- **工具層**: `date.gs`, `location.gs` - 提供共用的工具函式。
- **設定層**: `constants.gs` - 集中管理所有常數、API 金鑰和設定值。

### 2. 單一職責原則 (Single Responsibility Principle)
- 每個檔案專注於單一功能領域，例如 `date.gs` 只處理日期，`sheets.gs` 只處理資料存取。
- 這樣可以減少檔案間的耦合度，並提高程式碼的可讀性和可維護性。

## 重構狀態

- **[✓] 高優先級**: 已提取共用工具函數 (`date.gs`, `location.gs`)。
- **[✓] 高優先級**: 已重構資料存取層 (`sheets.gs`)。
- **[✓] 高優先級**: 已將所有常數與設定集中管理 (`constants.gs`)。
- **[✓] 中優先級**: 已將 `index.gs` 拆分，並將 Webhook 邏輯移至 `webhook.gs`。
- **[✓] 中優先級**: 已將 `command.gs`, `event.gs`, `group.gs`, `user.gs` 重構，移除重複程式碼。
- **[ ] 低優先級**: `event.gs` 中的 `updateRegistration` 和 `cancelRegistration` 仍有優化空間。

## 技術債務 (已解決)

- **[✓] `index.gs` 檔案過大**: 已拆分。
- **[✓] 日期處理邏輯重複**: 已集中到 `date.gs`。
- **[✓] 硬編碼的設定值**: 已集中到 `constants.gs`。
- **[✓] 缺乏統一的錯誤處理**: 已在各模組加入基本的錯誤處理與常數。
- **[✓] Google Sheets 操作分散**: 已集中到 `sheets.gs`。

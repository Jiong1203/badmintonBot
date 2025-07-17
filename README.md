# badmintonBot
羽球人_LINE BOT

## 專案架構

### 目前架構
```
badmintonBot/
├── index.gs    # 主要入口點 (273行)
├── event.gs    # 活動管理 (534行)
├── command.gs  # 指令處理 (288行)
├── group.gs    # 群組管理 (209行)
├── user.gs     # 使用者管理 (64行)
└── log.gs      # 日誌記錄 (6行)
```

### 建議的改進架構
```
badmintonBot/
├── index.gs              # 主要入口點 (簡化)
├── handlers/
│   ├── webhook.gs        # LINE Webhook 處理
│   └── command.gs        # 指令路由處理
├── services/
│   ├── event.gs          # 活動業務邏輯
│   ├── group.gs          # 群組業務邏輯
│   ├── user.gs           # 使用者業務邏輯
│   └── notification.gs   # 訊息生成服務
├── utils/
│   ├── date.gs           # 日期處理工具
│   ├── location.gs       # 場館查詢工具
│   └── validation.gs     # 資料驗證工具
├── data/
│   ├── repository.gs     # 資料存取層
│   └── sheets.gs         # Google Sheets 操作
└── config/
    ├── constants.gs      # 常數定義
    └── settings.gs       # 設定管理
```

## 架構改進建議

### 1. 分層架構 (Layered Architecture)
- **表現層**: `handlers/` - 處理外部請求
- **業務層**: `services/` - 核心業務邏輯
- **資料層**: `data/` - 資料存取
- **工具層**: `utils/` - 共用工具函數

### 2. 單一職責原則
- 每個檔案專注於單一功能領域
- 減少檔案間的耦合度
- 提高程式碼的可讀性和可維護性

### 3
- 將 Google Sheets 操作抽象化
- 便於測試和模組替換

###4. 錯誤處理
- 統一的錯誤處理機制
- 更好的日誌記錄

## 重構優先順序
1. **高優先級**: 提取共用工具函數 (`utils/`)
2. **中優先級**: 重構資料存取層 (`data/`)
3. **低優先級**: 重構業務邏輯層 (`services/`)

## 技術債務

- `index.gs` 檔案過大，需要拆分
- 日期處理邏輯重複
- 缺乏統一的錯誤處理
- 硬編碼的設定值需要外部化

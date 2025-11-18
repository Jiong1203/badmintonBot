/**
 * 常數定義模組
 * 集中管理所有系統常數和設定值
 */

// LINE Bot 相關常數
const LINE_CONFIG = {
  CHANNEL_ACCESS_TOKEN: 'TW2Hr46MLsq+Ue7P6PfJhPzVuOk4MZsrSh+KXLGCtgwyhzHth0BJh16thF1/+8VG4Z2FX4Sw1p3/nwko7UPNyBzxFD51NDihPRwA3GrIBOtlQWaPyNqchi1v0Kz5oRGAWujGuYttUWhBlagKhXEkbQdB04t89/1O/w1cDnyilFU=',
  API_BASE_URL: 'https://api.line.me/v2/bot',
  REPLY_URL: 'https://api.line.me/v2/bot/message/reply',
  PROFILE_URL: 'https://api.line.me/v2/bot/profile/',
  // LIFF 相關設定（需要在 LINE Developer Console 建立 LIFF App 後填入）
  LIFF_ID: 'YOUR_LIFF_ID_HERE', // 請替換為您的 LIFF ID
  LIFF_URL: 'https://liff.line.me/YOUR_LIFF_ID_HERE' // 請替換為您的 LIFF URL
};

// Google Sheets 相關常數
const SHEETS_CONFIG = {
  SPREADSHEET_ID: '1j6fozbv2TgjfbnNlQBIxrn109o6fxUQyq7es2m9g09Q',
  SHEETS: {
    USERS: 'users',
    EVENTS: 'events',
    REGISTRATIONS: 'registrations',
    GROUP_ADMINS: 'group_admins',
    GROUP_SETTINGS: 'group_settings',
    ARENA: 'arena',
    LOGS: 'logs'
  }
};

// 活動相關常數
const EVENT_CONFIG = {
  DEFAULT_START_HOUR: 20,
  DEFAULT_END_HOUR: 22,
  DEFAULT_DEADLINE_DAYS: 2,
  DEFAULT_MIN_COUNT: 4,
  STATUS: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED'
  }
};

// 群組管理相關常數
const GROUP_CONFIG = {
  DEFAULT_GROUP_NAME: 'XX羽球隊',
  DEFAULT_ARENA_CODE: 'K00',
  DEFAULT_TIME_RANGE: '20-22',
  DEFAULT_DEADLINE_DAYS: 2,
  DEFAULT_MIN_COUNT: 4,
  ADMIN_ROLES: {
    ADMIN: 'admin',
    EDITOR: 'editor'
  }
};

// 使用者相關常數
const USER_CONFIG = {
  UNKNOWN_USER: '未知使用者',
  TIMEZONE: 'Asia/Taipei',
  DATE_FORMAT: 'yyyy/MM/dd HH:mm:ss'
};

// 指令相關常數
const COMMAND_CONFIG = {
  PREFIX: '!',
  PATTERNS: {
    REGISTRATION: /^!報名\s+([A-Z]\d{2})\s+(.+?)(?:\s+(.+))?$/,
    UPDATE_REGISTRATION: /^!修改報名\s+([A-Z]\d{2})\s+(.+?)(?:\+(\d+))?(?:\s+(.+))?$/,
    CANCEL_REGISTRATION: /^!取消報名\s+([A-Z]\d{2})\s+(.+?)(?:-(\d+))?$/,
    QUERY_REGISTRATION: /^!查詢報名\s+([A-Z]\d{2})$/,
    CREATE_EVENT: /^!(下下週|下週|週)([日一二三四五六])(?:(\d{1,4})[-~](\d{1,4}))?開團(?:\s+(.+))?$/,
    ADMIN_MODIFY: /^!(加入|移除)管理員\s+@?(.+)$/
  }
};

// 訊息模板常數
const MESSAGE_TEMPLATES = {
  EVENT_CREATED: (groupName, eventDate, weekday, startTime, endTime, location, eventCode, minCount) => {
    const formattedStartTime = formatTime(startTime);
    const formattedEndTime = formatTime(endTime);
    return `📣 ${groupName} 開團囉！\n📅 日期：${eventDate}（星期${weekday}）\n🕒 時間：${formattedStartTime}-${formattedEndTime}\n📍 地點：${location}\n📝 活動代碼：${eventCode}\n📊 成團人數門檻：${minCount}人\n請使用 "!報名 ${eventCode} 小明+2" 來報名 🙌`;
  },
  ERROR_INVALID_FORMAT: '⚠️ 指令格式錯誤，請輸入"!教學" 來查看系統指令',
  ERROR_EVENT_CLOSED: (eventCode) => `⚠️ 活動 ${eventCode} 已截止報名`,
  ERROR_ALREADY_REGISTERED: (name, eventCode) => `⚠️ 您已經以「${name}」的名義報名過活動 ${eventCode}，如需修改請使用「!修改報名」指令`,
  SUCCESS_REGISTRATION: (name, count, eventCode) => `✅ ${name} 已成功報名 ${count} 人，活動代碼：${eventCode}`
};

// 錯誤訊息常數
const ERROR_MESSAGES = {
  INVALID_COMMAND: '指令格式錯誤，請輸入!教學 來查看系統指令',
  USER_NOT_FOUND: '⚠️ 無法找到使用者，請確認該使用者是否曾與機器人互動過',
  PERMISSION_DENIED: '⚠️ 您沒有權限執行此操作',
  ADMIN_ONLY: '⚠️ 僅限群組管理員可執行此操作',
  INVALID_ARENA: '⚠️ 找不到符合的場館，請重新輸入',
  INVALID_TIME: '⚠️ 時間格式錯誤，請使用如 20-22 的格式',
  INVALID_NUMBER: '⚠️ 請輸入有效的數字'
};

// 成功訊息常數
const SUCCESS_MESSAGES = {
  ADMIN_ADDED: (name) => `✅ 已成功將 @${name} 加入為管理員！`,
  ADMIN_REMOVED: (name) => `✅ 已成功移除 @${name} 的管理員權限`,
  SETTING_UPDATED: (setting, value) => `✅ ${setting}已更新為 ${value}`,
  USER_RECORDED: '✅ 使用者資訊已記錄'
}; 
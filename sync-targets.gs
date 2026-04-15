// ============================================================
// 実績スプレッドシート → TaskFlow 目標自動同期
// ============================================================
// このスクリプトをApps Scriptに貼り付けて実行、
// またはトリガーで毎月1日に自動実行

const SYNC_CONFIG = {
  // 実績スプレッドシート
  SPREADSHEET_ID: '1vcPZ9Z2_XwoOy0Nlov5gMKC1BXraHKwcr5-Bo3cBE98',
  SHEET_NAME: '実績',
  // TaskFlow API
  TASKFLOW_URL: 'https://task-manager-50i0.onrender.com',
  // セル位置（0始まり）
  STAFF_COL: 0,       // A列: 担当者名
  STAFF_START_ROW: 33, // 行34（0始まりで33）
  STAFF_END_ROW: 41,   // 行42（0始まりで41）
  FAX_COL: 12,         // M列: FAX受電
  KADEN_COL: 13,       // N列: 架電バイト
  HITO_COL: 14,        // O列: ヒトキワ広告
};

function syncTargetsToTaskFlow() {
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SYNC_CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const now = new Date();
  const month = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM');

  const targets = [];
  for (let i = SYNC_CONFIG.STAFF_START_ROW; i <= SYNC_CONFIG.STAFF_END_ROW; i++) {
    const name = String(data[i][SYNC_CONFIG.STAFF_COL] || '').trim();
    if (!name) continue;
    const fax = parseInt(data[i][SYNC_CONFIG.FAX_COL]) || 0;
    const kaden = parseInt(data[i][SYNC_CONFIG.KADEN_COL]) || 0;
    const hito = parseInt(data[i][SYNC_CONFIG.HITO_COL]) || 0;
    targets.push({ name, fax, kaden, hito });
    Logger.log(`${name}: FAX=${fax}, 架電=${kaden}, 広告=${hito}`);
  }

  // TaskFlowに送信
  const url = SYNC_CONFIG.TASKFLOW_URL + '/api/case-targets/sync';
  const payload = JSON.stringify({ month, data: targets });
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true,
  };

  const res = UrlFetchApp.fetch(url, options);
  Logger.log('Response: ' + res.getContentText());
  return res.getContentText();
}

// テスト実行用
function testSync() {
  const result = syncTargetsToTaskFlow();
  Logger.log('Sync result: ' + result);
}

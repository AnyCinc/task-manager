/**
 * 営業分析スプレッドシート 自動構築スクリプト
 *
 * 使い方:
 *   1. 新規スプレッドシートを作成 → 拡張機能 → Apps Script
 *   2. ⚠️ エディタの既存コード(function myFunction(){})を全て削除
 *      (Ctrl+A → Delete)。残したまま貼ると関数がネストされ構文エラーになります。
 *   3. 本ファイルの内容を丸ごと貼り付け
 *   4. 下記 SOURCE_URL に元スプレッドシートのURLを設定
 *      ⚠️ URLは必ずシングルクォート ' で囲うこと
 *   5. buildAll() を実行
 *   6. 戻って 01_データ抽出 のA1で「アクセスを許可」をクリック
 */

// ===== 設定 =====
const SOURCE_URL  = 'https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit'; // ← 元データURL
const SOURCE_TAB  = '受電報告';
const COL_DATE    = 1;   // A列 = 日付
const COL_REP     = 8;   // H列 = 営業担当者
const COL_TYPE    = 9;   // I列 = 種類
const MATCH_VALUE = '案件化';

// シート名
const SH_EXTRACT  = '01_データ抽出';
const SH_DASH     = '02_分析ダッシュボード';
const SH_CONFIG   = '03_設定';

/** メインエントリ：全シートを構築 */
function buildAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildConfigSheet_(ss);
  buildExtractSheet_(ss);
  buildDashboardSheet_(ss);
  cleanupDefaultSheet_(ss);
  SpreadsheetApp.getUi().alert(
    '✅ 構築完了\n\n' +
    '01_データ抽出 のA1セルをクリックし「アクセスを許可」をクリックしてください。\n' +
    'その後、02_分析ダッシュボード のB3/D3に日付を入力すると集計が開始されます。'
  );
}

/* ------------------------------------------------------------------ */
/* 03_設定シート                                                        */
/* ------------------------------------------------------------------ */
function buildConfigSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_CONFIG);
  sh.clear();
  sh.getRange('A1').setValue('設定項目').setFontWeight('bold');
  sh.getRange('B1').setValue('値').setFontWeight('bold');

  const rows = [
    ['元スプレッドシートURL', SOURCE_URL],
    ['対象タブ名',            SOURCE_TAB],
    ['日付列',                `${columnToLetter_(COL_DATE)}列`],
    ['営業担当者列',          `${columnToLetter_(COL_REP)}列`],
    ['種類列',                `${columnToLetter_(COL_TYPE)}列`],
    ['判定文字列',            MATCH_VALUE],
  ];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 480);
  sh.getRange('A:A').setBackground('#f3f3f3');
  sh.setTabColor('#9e9e9e');
  sh.protect().setDescription('設定シート（管理者用）').setWarningOnly(true);
}

/* ------------------------------------------------------------------ */
/* 01_データ抽出シート                                                  */
/* ------------------------------------------------------------------ */
function buildExtractSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_EXTRACT);
  sh.clear();

  const range = `${SOURCE_TAB}!A:${columnToLetter_(Math.max(COL_DATE, COL_REP, COL_TYPE))}`;
  const query = `SELECT Col${COL_DATE}, Col${COL_REP}, Col${COL_TYPE} ` +
                `WHERE Col${COL_DATE} IS NOT NULL ` +
                `LABEL Col${COL_DATE} '日付', Col${COL_REP} '営業担当者', Col${COL_TYPE} '種類'`;

  const formula =
    `=QUERY(IMPORTRANGE("${SOURCE_URL}","${range}"),"${query}",1)`;

  sh.getRange('A1').setFormula(formula);

  // 列幅・書式
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.getRange('A:A').setNumberFormat('yyyy/mm/dd');
  sh.getRange('1:1').setFontWeight('bold').setBackground('#cfe2f3');
  sh.setFrozenRows(1);
  sh.setTabColor('#1565c0');

  // 保護（警告のみ）
  sh.protect().setDescription('データ抽出（編集不可）').setWarningOnly(true);
}

/* ------------------------------------------------------------------ */
/* 02_分析ダッシュボードシート                                          */
/* ------------------------------------------------------------------ */
function buildDashboardSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_DASH);
  sh.clear();
  sh.clearConditionalFormatRules();
  // 既存のグラフ削除
  sh.getCharts().forEach(c => sh.removeChart(c));

  // --- ヘッダーエリア ---
  sh.getRange('A1').setValue('【営業分析ダッシュボード】')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1b5e20');
  sh.getRange('A1:D1').merge();

  sh.getRange('A3').setValue('開始日:').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('C3').setValue('終了日:').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('B3').setValue(new Date(new Date().getFullYear(), 0, 1))
    .setNumberFormat('yyyy/mm/dd').setBackground('#fff9c4');
  sh.getRange('D3').setValue(new Date())
    .setNumberFormat('yyyy/mm/dd').setBackground('#fff9c4');

  // 日付バリデーション
  const rule = SpreadsheetApp.newDataValidation()
    .requireDate().setAllowInvalid(false).setHelpText('日付を入力してください').build();
  sh.getRange('B3').setDataValidation(rule);
  sh.getRange('D3').setDataValidation(rule);

  // 使い方メモ
  sh.getRange('F3').setValue(
    '① B3に開始日、D3に終了日を入力\n' +
    '② 下の集計表とグラフが自動更新されます'
  ).setFontColor('#555').setWrap(true);
  sh.getRange('F3:H3').merge();

  // --- 集計テーブル ---
  const headers = ['営業担当者', '受電数', '案件化数', '案件化率'];
  sh.getRange('A5:D5').setValues([headers])
    .setFontWeight('bold').setBackground('#c8e6c9').setHorizontalAlignment('center');

  // A6：担当者UNIQUE
  sh.getRange('A6').setFormula(
    `=SORT(UNIQUE(FILTER('${SH_EXTRACT}'!B2:B, '${SH_EXTRACT}'!B2:B<>"")))`
  );

  // B6:D6 に COUNTIFS / IFERROR を入力し、ARRAYFORMULA化せず下にコピーする方式
  // 保守性重視のため 200行分プレフィル
  const MAX_ROWS = 200;
  const dateCol = `'${SH_EXTRACT}'!$A:$A`;
  const repCol  = `'${SH_EXTRACT}'!$B:$B`;
  const typeCol = `'${SH_EXTRACT}'!$C:$C`;

  for (let i = 0; i < MAX_ROWS; i++) {
    const row = 6 + i;
    sh.getRange(`B${row}`).setFormula(
      `=IF($A${row}="","",COUNTIFS(${dateCol},">="&$B$3,${dateCol},"<="&$D$3,${repCol},$A${row}))`
    );
    sh.getRange(`C${row}`).setFormula(
      `=IF($A${row}="","",COUNTIFS(${dateCol},">="&$B$3,${dateCol},"<="&$D$3,${repCol},$A${row},${typeCol},"${MATCH_VALUE}"))`
    );
    sh.getRange(`D${row}`).setFormula(
      `=IF(OR($A${row}="",B${row}=0),"",C${row}/B${row})`
    );
  }
  sh.getRange(`D6:D${5 + MAX_ROWS}`).setNumberFormat('0.0%');

  // 合計行（テーブル最下部の少し下）
  const totalRow = 6 + MAX_ROWS + 2;
  sh.getRange(`A${totalRow}`).setValue('合計').setFontWeight('bold').setBackground('#ffe0b2');
  sh.getRange(`B${totalRow}`).setFormula(`=SUM(B6:B${5 + MAX_ROWS})`).setFontWeight('bold').setBackground('#ffe0b2');
  sh.getRange(`C${totalRow}`).setFormula(`=SUM(C6:C${5 + MAX_ROWS})`).setFontWeight('bold').setBackground('#ffe0b2');
  sh.getRange(`D${totalRow}`).setFormula(`=IFERROR(C${totalRow}/B${totalRow},0)`)
    .setNumberFormat('0.0%').setFontWeight('bold').setBackground('#ffe0b2');

  // 条件付き書式：案件化率にカラースケール
  const dRange = sh.getRange(`D6:D${5 + MAX_ROWS}`);
  const cfRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#f8696b', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#ffeb84', SpreadsheetApp.InterpolationType.NUMBER, '0.25')
    .setGradientMaxpointWithValue('#63be7b', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setRanges([dRange])
    .build();
  sh.setConditionalFormatRules([cfRule]);

  // 列幅
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 110);
  sh.setFrozenRows(5);
  sh.setTabColor('#2e7d32');

  // --- グラフ生成 ---
  // 動的な担当者数に追従するため、名前付き範囲ではなくFILTERベースのヘルパー列を使わず、
  // 集計テーブル範囲をそのまま指定
  const dataRange = sh.getRange(`A5:D${5 + MAX_ROWS}`);

  // ① 横棒：受電数ランキング
  const bar = sh.newChart()
    .asBarChart()
    .addRange(sh.getRange(`A5:B${5 + MAX_ROWS}`))
    .setPosition(6, 6, 0, 0)
    .setOption('title', '担当者別 受電数')
    .setOption('legend', { position: 'none' })
    .setOption('hAxis', { title: '受電数' })
    .build();
  sh.insertChart(bar);

  // ② 積み上げ縦棒：受電数 vs 案件化数
  const column = sh.newChart()
    .asColumnChart()
    .addRange(sh.getRange(`A5:C${5 + MAX_ROWS}`))
    .setPosition(24, 6, 0, 0)
    .setOption('title', '受電数と案件化数')
    .setOption('isStacked', false)
    .setOption('colors', ['#42a5f5', '#ef5350'])
    .build();
  sh.insertChart(column);

  // ③ 複合：案件化率
  const line = sh.newChart()
    .asLineChart()
    .addRange(sh.getRange(`A5:A${5 + MAX_ROWS}`))
    .addRange(sh.getRange(`D5:D${5 + MAX_ROWS}`))
    .setPosition(42, 6, 0, 0)
    .setOption('title', '担当者別 案件化率')
    .setOption('vAxis', { format: 'percent' })
    .setOption('colors', ['#66bb6a'])
    .build();
  sh.insertChart(line);
}

/* ------------------------------------------------------------------ */
/* ユーティリティ                                                      */
/* ------------------------------------------------------------------ */
function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function cleanupDefaultSheet_(ss) {
  const def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) { /* noop */ }
  }
  // 並び順を整える
  const order = [SH_DASH, SH_EXTRACT, SH_CONFIG];
  order.forEach((name, idx) => {
    const s = ss.getSheetByName(name);
    if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(idx + 1); }
  });
  ss.setActiveSheet(ss.getSheetByName(SH_DASH));
}

function columnToLetter_(col) {
  let s = '', n = col;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

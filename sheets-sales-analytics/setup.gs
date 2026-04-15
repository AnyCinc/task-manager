/**
 * 営業分析スプレッドシート 自動構築スクリプト (高速版)
 *
 * 使い方:
 *   1. Ctrl+A → Delete でエディタ全削除
 *   2. このコードを貼り付け → Ctrl+S
 *   3. 関数プルダウンで buildAll → ▶実行
 *   4. 権限承認後、01_データ抽出 のA1で「アクセスを許可」
 */

// ===== 設定 =====
const SOURCE_URL  = 'https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit'; // ← 元データURL
const SOURCE_TAB  = '受電報告';
const COL_DATE    = 1;   // A列 = 日付
const COL_REP     = 8;   // H列 = 営業担当者
const COL_TYPE    = 9;   // I列 = 種類
const MATCH_VALUE = '案件化';
const MAX_ROWS    = 100; // 担当者行の最大数

const SH_EXTRACT  = '01_データ抽出';
const SH_DASH     = '02_分析ダッシュボード';
const SH_CONFIG   = '03_設定';

function buildAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildConfigSheet_(ss);
  buildExtractSheet_(ss);
  buildDashboardSheet_(ss);
  cleanupDefaultSheet_(ss);
  SpreadsheetApp.getUi().alert(
    '✅ 構築完了\n\n' +
    '01_データ抽出 のA1セルで「アクセスを許可」をクリックしてください。\n' +
    'その後、02_分析ダッシュボード のB3/D3に日付を入力すると集計が開始されます。'
  );
}

function buildConfigSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_CONFIG);
  sh.clear();
  const data = [
    ['設定項目', '値'],
    ['元スプレッドシートURL', SOURCE_URL],
    ['対象タブ名',            SOURCE_TAB],
    ['日付列',                columnToLetter_(COL_DATE) + '列'],
    ['営業担当者列',          columnToLetter_(COL_REP) + '列'],
    ['種類列',                columnToLetter_(COL_TYPE) + '列'],
    ['判定文字列',            MATCH_VALUE],
  ];
  sh.getRange(1, 1, data.length, 2).setValues(data);
  sh.getRange('A1:B1').setFontWeight('bold');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 480);
  sh.getRange('A:A').setBackground('#f3f3f3');
  sh.setTabColor('#9e9e9e');
}

function buildExtractSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_EXTRACT);
  sh.clear();

  const lastColLetter = columnToLetter_(Math.max(COL_DATE, COL_REP, COL_TYPE));
  const range = SOURCE_TAB + '!A:' + lastColLetter;
  const query = 'SELECT Col' + COL_DATE + ', Col' + COL_REP + ', Col' + COL_TYPE + ' ' +
                'WHERE Col' + COL_DATE + ' IS NOT NULL ' +
                'LABEL Col' + COL_DATE + " '日付', Col" + COL_REP + " '営業担当者', Col" + COL_TYPE + " '種類'";
  const formula = '=QUERY(IMPORTRANGE("' + SOURCE_URL + '","' + range + '"),"' + query + '",1)';

  sh.getRange('A1').setFormula(formula);
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.getRange('A:A').setNumberFormat('yyyy/mm/dd');
  sh.getRange('1:1').setFontWeight('bold').setBackground('#cfe2f3');
  sh.setFrozenRows(1);
  sh.setTabColor('#1565c0');
}

function buildDashboardSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_DASH);
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getCharts().forEach(function(c) { sh.removeChart(c); });

  // --- ヘッダー ---
  sh.getRange('A1').setValue('【営業分析ダッシュボード】')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1b5e20');
  sh.getRange('A1:D1').merge();

  // --- 日付入力エリア ---
  sh.getRange('A3:D3').setValues([['開始日:', new Date(new Date().getFullYear(), 0, 1), '終了日:', new Date()]]);
  sh.getRange('A3').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('C3').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('B3:D3').setNumberFormat('yyyy/mm/dd');
  sh.getRange('B3').setBackground('#fff9c4');
  sh.getRange('D3').setBackground('#fff9c4');

  const rule = SpreadsheetApp.newDataValidation()
    .requireDate().setAllowInvalid(false).setHelpText('日付を入力してください').build();
  sh.getRange('B3').setDataValidation(rule);
  sh.getRange('D3').setDataValidation(rule);

  sh.getRange('F3').setValue(
    '① B3に開始日、D3に終了日を入力\n② 下の集計表とグラフが自動更新されます'
  ).setFontColor('#555').setWrap(true);
  sh.getRange('F3:H3').merge();

  // --- ヘッダー行 ---
  sh.getRange('A5:D5').setValues([['営業担当者', '受電数', '案件化数', '案件化率']])
    .setFontWeight('bold').setBackground('#c8e6c9').setHorizontalAlignment('center');

  // --- 担当者UNIQUE (A6) ---
  sh.getRange('A6').setFormula(
    "=SORT(UNIQUE(FILTER('" + SH_EXTRACT + "'!B2:B, '" + SH_EXTRACT + "'!B2:B<>\"\")))"
  );

  // --- B/C/D列の数式を一括構築 (setFormulasで1回書き込み) ---
  const dateCol = "'" + SH_EXTRACT + "'!$A:$A";
  const repCol  = "'" + SH_EXTRACT + "'!$B:$B";
  const typeCol = "'" + SH_EXTRACT + "'!$C:$C";

  const formulas = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const r = 6 + i;
    formulas.push([
      '=IF($A' + r + '="","",COUNTIFS(' + dateCol + ',">="&$B$3,' + dateCol + ',"<="&$D$3,' + repCol + ',$A' + r + '))',
      '=IF($A' + r + '="","",COUNTIFS(' + dateCol + ',">="&$B$3,' + dateCol + ',"<="&$D$3,' + repCol + ',$A' + r + ',' + typeCol + ',"' + MATCH_VALUE + '"))',
      '=IF(OR($A' + r + '="",B' + r + '=0),"",C' + r + '/B' + r + ')'
    ]);
  }
  sh.getRange(6, 2, MAX_ROWS, 3).setFormulas(formulas);
  sh.getRange(6, 4, MAX_ROWS, 1).setNumberFormat('0.0%');

  // --- 合計行 ---
  const totalRow = 6 + MAX_ROWS + 2;
  const last = 5 + MAX_ROWS;
  sh.getRange(totalRow, 1).setValue('合計');
  sh.getRange(totalRow, 2, 1, 3).setFormulas([[
    '=SUM(B6:B' + last + ')',
    '=SUM(C6:C' + last + ')',
    '=IFERROR(C' + totalRow + '/B' + totalRow + ',0)'
  ]]);
  sh.getRange(totalRow, 1, 1, 4).setFontWeight('bold').setBackground('#ffe0b2');
  sh.getRange(totalRow, 4).setNumberFormat('0.0%');

  // --- 条件付き書式 ---
  const dRange = sh.getRange('D6:D' + last);
  const cfRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#f8696b', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#ffeb84', SpreadsheetApp.InterpolationType.NUMBER, '0.25')
    .setGradientMaxpointWithValue('#63be7b', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setRanges([dRange]).build();
  sh.setConditionalFormatRules([cfRule]);

  // --- 列幅・固定 ---
  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 110);
  sh.setFrozenRows(5);
  sh.setTabColor('#2e7d32');

  // --- グラフ3種 ---
  sh.insertChart(sh.newChart().asBarChart()
    .addRange(sh.getRange('A5:B' + last))
    .setPosition(6, 6, 0, 0)
    .setOption('title', '担当者別 受電数')
    .setOption('legend', { position: 'none' })
    .build());

  sh.insertChart(sh.newChart().asColumnChart()
    .addRange(sh.getRange('A5:C' + last))
    .setPosition(24, 6, 0, 0)
    .setOption('title', '受電数と案件化数')
    .setOption('colors', ['#42a5f5', '#ef5350'])
    .build());

  sh.insertChart(sh.newChart().asLineChart()
    .addRange(sh.getRange('A5:A' + last))
    .addRange(sh.getRange('D5:D' + last))
    .setPosition(42, 6, 0, 0)
    .setOption('title', '担当者別 案件化率')
    .setOption('vAxis', { format: 'percent' })
    .setOption('colors', ['#66bb6a'])
    .build());
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function cleanupDefaultSheet_(ss) {
  const def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) {
    try { ss.deleteSheet(def); } catch (e) {}
  }
  const order = [SH_DASH, SH_EXTRACT, SH_CONFIG];
  order.forEach(function(name, idx) {
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

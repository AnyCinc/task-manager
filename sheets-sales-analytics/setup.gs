/**
 * 営業分析スプレッドシート 自動構築スクリプト (完成版 v4)
 *   - 受電数>0 の担当者を全員グラフに表示
 *   - UNIQUEにTRIMを追加して名前のブレを吸収
 *   - グラフ高さを1400pxに拡大（46名以上でも見やすい）
 */

const SOURCE_URL  = 'https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit';
const SOURCE_TAB  = '受電報告';
const COL_DATE    = 1;
const COL_REP     = 8;
const COL_TYPE    = 9;
const MATCH_VALUE = '案件化';
const MAX_ROWS    = 150;

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
  sh.showColumns(1, sh.getMaxColumns());

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

  // --- 集計テーブル ---
  sh.getRange('A5:D5').setValues([['営業担当者', '受電数', '案件化数', '案件化率']])
    .setFontWeight('bold').setBackground('#c8e6c9').setHorizontalAlignment('center');

  // A6：TRIM＋UNIQUEで名前のブレ（前後空白等）を吸収
  sh.getRange('A6').setFormula(
    "=SORT(UNIQUE(ARRAYFORMULA(TRIM(FILTER('" + SH_EXTRACT + "'!B2:B," +
    "LEN(TRIM('" + SH_EXTRACT + "'!B2:B))>0)))))"
  );

  const dateCol = "'" + SH_EXTRACT + "'!$A:$A";
  const repCol  = "'" + SH_EXTRACT + "'!$B:$B";
  const typeCol = "'" + SH_EXTRACT + "'!$C:$C";

  // SUMPRODUCT+TRIMで比較（末尾スペース等のブレも拾う）
  const formulas = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const r = 6 + i;
    formulas.push([
      '=IF($A' + r + '="","",SUMPRODUCT((' + dateCol + '>=$B$3)*(' + dateCol + '<=$D$3)*(TRIM(' + repCol + ')=$A' + r + ')))',
      '=IF($A' + r + '="","",SUMPRODUCT((' + dateCol + '>=$B$3)*(' + dateCol + '<=$D$3)*(TRIM(' + repCol + ')=$A' + r + ')*(TRIM(' + typeCol + ')="' + MATCH_VALUE + '")))',
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

  // --- グラフ用ヘルパー列（非表示）: 受電数>0の担当者だけを降順で並べる ---
  sh.getRange('K5:L5').setValues([['担当者', '受電数']])
    .setFontWeight('bold').setBackground('#e0e0e0');
  sh.getRange('K6').setFormula(
    '=IFERROR(SORT(FILTER({A6:A' + last + ',IFERROR(B6:B' + last + '+0,0)},' +
    'LEN(A6:A' + last + ')>0,IFERROR(B6:B' + last + '+0,0)>0),2,FALSE),"")'
  );

  sh.getRange('N5:P5').setValues([['担当者', '受電数', '案件化数']])
    .setFontWeight('bold').setBackground('#e0e0e0');
  sh.getRange('N6').setFormula(
    '=IFERROR(SORT(FILTER({A6:A' + last + ',IFERROR(B6:B' + last + '+0,0),IFERROR(C6:C' + last + '+0,0)},' +
    'LEN(A6:A' + last + ')>0,IFERROR(B6:B' + last + '+0,0)>0),2,FALSE),"")'
  );

  sh.getRange('R5:S5').setValues([['担当者', '案件化率']])
    .setFontWeight('bold').setBackground('#e0e0e0');
  sh.getRange('R6').setFormula(
    '=IFERROR(SORT(FILTER({A6:A' + last + ',IFERROR(D6:D' + last + '+0,0)},' +
    'LEN(A6:A' + last + ')>0,IFERROR(B6:B' + last + '+0,0)>0),2,FALSE),"")'
  );
  sh.getRange('S6:S' + last).setNumberFormat('0.0%');

  sh.hideColumns(11, 2);  // K, L
  sh.hideColumns(14, 3);  // N, O, P
  sh.hideColumns(18, 2);  // R, S

  // --- グラフ3種（横並び・担当者名と棒が必ず揃う） ---
  const CHART_W = 620;
  const CHART_H = 1800;
  const GAP     = 24;
  const vAxisOpt = { textStyle: { fontSize: 11 }, textPosition: 'out' };
  const chartArea = { left: 110, top: 50, width: '75%', height: '92%' };

  sh.insertChart(sh.newChart().asBarChart()
    .addRange(sh.getRange('K5:L' + last))
    .setPosition(6, 6, 0, 0)
    .setOption('title', '担当者別 受電数ランキング')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#42a5f5'])
    .setOption('hAxis', { title: '受電数' })
    .setOption('vAxis', vAxisOpt)
    .setOption('bar', { groupWidth: '85%' })
    .setOption('chartArea', chartArea)
    .setOption('annotations', { alwaysOutside: true })
    .setOption('width',  CHART_W)
    .setOption('height', CHART_H)
    .build());

  sh.insertChart(sh.newChart().asBarChart()
    .addRange(sh.getRange('N5:P' + last))
    .setPosition(6, 6, CHART_W + GAP, 0)
    .setOption('title', '受電数 と 案件化数')
    .setOption('colors', ['#42a5f5', '#ef5350'])
    .setOption('hAxis', { title: '件数' })
    .setOption('vAxis', vAxisOpt)
    .setOption('bar', { groupWidth: '85%' })
    .setOption('chartArea', chartArea)
    .setOption('legend', { position: 'top' })
    .setOption('width',  CHART_W)
    .setOption('height', CHART_H)
    .build());

  sh.insertChart(sh.newChart().asBarChart()
    .addRange(sh.getRange('R5:S' + last))
    .setPosition(6, 6, (CHART_W + GAP) * 2, 0)
    .setOption('title', '担当者別 案件化率ランキング')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#66bb6a'])
    .setOption('hAxis', { format: 'percent', title: '案件化率' })
    .setOption('vAxis', vAxisOpt)
    .setOption('bar', { groupWidth: '85%' })
    .setOption('chartArea', chartArea)
    .setOption('annotations', { alwaysOutside: true })
    .setOption('width',  CHART_W)
    .setOption('height', CHART_H)
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

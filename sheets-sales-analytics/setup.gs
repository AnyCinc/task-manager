/**
 * 営業分析スプレッドシート 自動構築スクリプト (完成版 v7)
 *
 * ルール:
 *   - 受電数: 受電報告 H列の担当者（末尾アルファベット/数字を除去して同一人物扱い）
 *   - 案件化: 求人情報 AJ列(案件取得日)+実担当者
 *     実担当者 = Gに漢字/カタカナあり → G(正規化)
 *               Gが空 or 英数字のみ  → B(正規化)
 *   - 末尾のアルファベット/数字は除去して同一人物化（例: 濱松H → 濱松）
 *
 * 使い方:
 *   1. 新規スプレッドシート → 拡張機能 → Apps Script
 *   2. エディタ Ctrl+A → Delete で全削除
 *   3. このコードを貼り付け → 保存 (Ctrl+S)
 *   4. buildAll を実行
 *   5. 01_データ抽出 と 01b_求人情報 のA1で「アクセスを許可」
 */

// ===== 設定 =====
const SOURCE_URL  = 'https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXX/edit';

// 受電報告タブ
const SOURCE_TAB      = '受電報告';
const COL_DATE        = 1;   // A列 = 受電日
const COL_REP         = 8;   // H列 = 営業担当者

// 求人情報タブ
const SOURCE_TAB_JOB  = '求人情報';
const COL_JOB_DATE    = 36;  // AJ列 = 案件取得日
const COL_JOB_REP_G   = 7;   // G列  = 営業担当者
const COL_JOB_REP_B   = 2;   // B列  = 面接担当者（Gが空欄/英数字のときの代替）

const MAX_ROWS        = 200;

// 正規化パターン
//   末尾の「敬称 or 英数字」を繰り返し除去
const RE_TAIL_STRIP   = '"(さん|様|ちゃん|くん|君|氏|殿|先生|[A-Za-z0-9]+)+$"';
//   漢字 or カタカナが含まれるか
const RE_JA           = '"[一-龯ァ-ヶ]"';

// シート名
const SH_EXTRACT     = '01_データ抽出';
const SH_EXTRACT_JOB = '01b_求人情報';
const SH_DASH        = '02_分析ダッシュボード';
const SH_CONFIG      = '03_設定';

function buildAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildConfigSheet_(ss);
  buildExtractSheet_(ss);
  buildJobExtractSheet_(ss);
  buildDashboardSheet_(ss);
  cleanupDefaultSheet_(ss);
  SpreadsheetApp.getUi().alert(
    '✅ 構築完了\n\n' +
    '01_データ抽出 と 01b_求人情報 のA1セルで「アクセスを許可」を両方クリックしてください。\n\n' +
    'その後、02_分析ダッシュボード のB3/D3に日付を入力すると集計が開始されます。'
  );
}

function buildConfigSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_CONFIG);
  sh.clear();
  const data = [
    ['設定項目', '値'],
    ['元スプレッドシートURL',         SOURCE_URL],
    ['受電報告タブ',                  SOURCE_TAB],
    ['  受電日列',                    columnToLetter_(COL_DATE) + '列'],
    ['  営業担当者列',                columnToLetter_(COL_REP) + '列'],
    ['求人情報タブ',                  SOURCE_TAB_JOB],
    ['  案件取得日列',                columnToLetter_(COL_JOB_DATE) + '列'],
    ['  営業担当者列 (G)',            columnToLetter_(COL_JOB_REP_G) + '列'],
    ['  面接担当者列 (B) [G空欄時]',  columnToLetter_(COL_JOB_REP_B) + '列'],
    ['名前正規化ルール',              '末尾の英数字を除去（例: 濱松H → 濱松）'],
    ['G判定ルール',                   'G列が英数字のみ/空欄 → B列を使用'],
  ];
  sh.getRange(1, 1, data.length, 2).setValues(data);
  sh.getRange('A1:B1').setFontWeight('bold');
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 500);
  sh.getRange('A:A').setBackground('#f3f3f3');
  sh.setTabColor('#9e9e9e');
}

function buildExtractSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_EXTRACT);
  sh.clear();
  const lastColLetter = columnToLetter_(Math.max(COL_DATE, COL_REP));
  const range = SOURCE_TAB + '!A:' + lastColLetter;
  const query = 'SELECT Col' + COL_DATE + ', Col' + COL_REP + ' ' +
                'WHERE Col' + COL_DATE + ' IS NOT NULL ' +
                'LABEL Col' + COL_DATE + " '受電日', Col" + COL_REP + " '営業担当者'";
  const formula = '=QUERY(IMPORTRANGE("' + SOURCE_URL + '","' + range + '"),"' + query + '",1)';
  sh.getRange('A1').setFormula(formula);

  sh.getRange('C1').setValue('正規化担当者').setFontWeight('bold');
  sh.getRange('C2').setFormula(
    '=ARRAYFORMULA(IF(B2:B="","",' +
      'IFERROR(TRIM(REGEXREPLACE(TRIM(B2:B),' + RE_TAIL_STRIP + ',"")),TRIM(B2:B))))'
  );

  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.getRange('A:A').setNumberFormat('yyyy/mm/dd');
  sh.getRange('1:1').setFontWeight('bold').setBackground('#cfe2f3');
  sh.setFrozenRows(1);
  sh.setTabColor('#1565c0');
}

function buildJobExtractSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_EXTRACT_JOB);
  sh.clear();

  const range = SOURCE_TAB_JOB + '!A:AJ';
  const query = 'SELECT Col' + COL_JOB_DATE + ', Col' + COL_JOB_REP_G + ', Col' + COL_JOB_REP_B + ' ' +
                'WHERE Col' + COL_JOB_DATE + ' IS NOT NULL ' +
                'LABEL Col' + COL_JOB_DATE + " '案件取得日', " +
                'Col' + COL_JOB_REP_G + " '営業担当者(G)', " +
                'Col' + COL_JOB_REP_B + " '面接担当者(B)'";
  const formula = '=QUERY(IMPORTRANGE("' + SOURCE_URL + '","' + range + '"),"' + query + '",1)';
  sh.getRange('A1').setFormula(formula);

  sh.getRange('D1').setValue('実担当者').setFontWeight('bold');
  sh.getRange('D2').setFormula(
    '=ARRAYFORMULA(' +
      'IF(A2:A="","",' +
        'IF(REGEXMATCH(IFERROR(TRIM(B2:B)&"",""),' + RE_JA + '),' +
           'IFERROR(TRIM(REGEXREPLACE(TRIM(B2:B),' + RE_TAIL_STRIP + ',"")),TRIM(B2:B)),' +
           'IF(REGEXMATCH(IFERROR(TRIM(C2:C)&"",""),' + RE_JA + '),' +
              'IFERROR(TRIM(REGEXREPLACE(TRIM(C2:C),' + RE_TAIL_STRIP + ',"")),TRIM(C2:C)),' +
              '""))))'
  );

  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 160);
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

  sh.getRange('A1').setValue('【営業分析ダッシュボード】')
    .setFontSize(16).setFontWeight('bold').setFontColor('#1b5e20');
  sh.getRange('A1:D1').merge();

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
    '① B3に開始日、D3に終了日を入力\n' +
    '② 名前の末尾アルファベット/数字は自動除去（濱松H → 濱松）'
  ).setFontColor('#555').setWrap(true);
  sh.getRange('F3:H3').merge();

  sh.getRange('A5:D5').setValues([['営業担当者', '受電数', '案件化数', '案件化率']])
    .setFontWeight('bold').setBackground('#c8e6c9').setHorizontalAlignment('center');

  sh.getRange('A6').setFormula(
    "=SORT(UNIQUE(FILTER(" +
      "{'" + SH_EXTRACT + "'!C2:C1000; '" + SH_EXTRACT_JOB + "'!D2:D1000}," +
      "LEN({'" + SH_EXTRACT + "'!C2:C1000; '" + SH_EXTRACT_JOB + "'!D2:D1000})>0" +
    ")))"
  );

  const dateCol    = "'" + SH_EXTRACT + "'!$A:$A";
  const repCol     = "'" + SH_EXTRACT + "'!$C:$C";
  const jobDateCol = "'" + SH_EXTRACT_JOB + "'!$A:$A";
  const jobRepCol  = "'" + SH_EXTRACT_JOB + "'!$D:$D";

  const formulas = [];
  for (let i = 0; i < MAX_ROWS; i++) {
    const r = 6 + i;
    formulas.push([
      '=IF($A' + r + '="","",COUNTIFS(' + dateCol + ',">="&$B$3,' + dateCol + ',"<="&$D$3,' + repCol + ',$A' + r + '))',
      '=IF($A' + r + '="","",COUNTIFS(' + jobDateCol + ',">="&$B$3,' + jobDateCol + ',"<="&$D$3,' + jobRepCol + ',$A' + r + '))',
      '=IF(OR($A' + r + '="",B' + r + '=0),"",C' + r + '/B' + r + ')'
    ]);
  }
  sh.getRange(6, 2, MAX_ROWS, 3).setFormulas(formulas);
  sh.getRange(6, 4, MAX_ROWS, 1).setNumberFormat('0.0%');

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

  const dRange = sh.getRange('D6:D' + last);
  const cfRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#f8696b', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#ffeb84', SpreadsheetApp.InterpolationType.NUMBER, '0.25')
    .setGradientMaxpointWithValue('#63be7b', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setRanges([dRange]).build();
  sh.setConditionalFormatRules([cfRule]);

  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 110);
  sh.setFrozenRows(5);
  sh.setTabColor('#2e7d32');

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

  sh.hideColumns(11, 2);
  sh.hideColumns(14, 3);
  sh.hideColumns(18, 2);

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
  const order = [SH_DASH, SH_EXTRACT, SH_EXTRACT_JOB, SH_CONFIG];
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

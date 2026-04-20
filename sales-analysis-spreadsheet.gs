/**
 * 営業分析スプレッドシート 自動構築スクリプト (完成版 v12)
 *
 * 名前の登録ルール:
 *   - 先頭から漢字2文字以上が連続 → その漢字シーケンスを名前として登録
 *   - 先頭からカタカナ2文字以上が連続 → そのカタカナシーケンスを登録
 *   - それ以外 → 登録しない
 *
 * 実担当者(求人情報):
 *   G列から名前抽出成功 → G採用、失敗 → B列から抽出
 *
 * 集計:
 *   受電数   = MAX(
 *                受電報告 H列(正規化) のCOUNTIFS,
 *                求人情報 実担当者(正規化) のCOUNTIFS
 *              )
 *              ← 求人情報のみに案件化記録がある場合、受電記録も同一人物と見なして加算
 *   案件化数 = 求人情報 実担当者(正規化) のCOUNTIFS (AJ列日付範囲)
 *   案件化率 = 案件化数 / 受電数
 *
 * ダッシュボード表示ルール (v12):
 *   - シバム ≡ ラワト（同一人物として統合）
 *   - 受電数 ≤ 10 の担当者は非表示
 *   - 案件化率 ≥ 100% の担当者は非表示（異常値除外）
 *   - 受電数 ≥ 60 の担当者を優先的に上位表示（太字＋緑背景で強調）
 *   - B3/D3 の日付を変更すると onEdit トリガーで自動再集計
 */

// ===== 設定 =====
const SOURCE_URL  = 'https://docs.google.com/spreadsheets/d/1wPH1sud7dAwJQihiR6qDrH-otJ3ygAgcCAg-e4ituvw/edit';

const SOURCE_TAB      = '受電報告';
const COL_DATE        = 1;
const COL_REP         = 8;

const SOURCE_TAB_JOB  = '求人情報';
const COL_JOB_DATE    = 36;
const COL_JOB_REP_G   = 7;
const COL_JOB_REP_B   = 2;

const MAX_ROWS        = 200;

const RE_KANJI_LEAD   = '"^[一-鿿]{2,}"';
const RE_KATA_LEAD    = '"^[ァ-ヿ]{2,}"';

const SH_EXTRACT     = '01_データ抽出';
const SH_EXTRACT_JOB = '01b_求人情報';
const SH_DASH        = '02_分析ダッシュボード';
const SH_CONFIG      = '03_設定';

// 同一人物として統合する別名: {別名: 正名}
const NAME_UNIFY = {
  'ラワト': 'シバム',
};

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
    '02_分析ダッシュボード のB3/D3に日付を入力すると集計が開始されます。'
  );
}

function buildConfigSheet_(ss) {
  const sh = getOrCreateSheet_(ss, SH_CONFIG);
  sh.clear();
  const aliasStr = Object.keys(NAME_UNIFY).map(function(k) { return k + ' → ' + NAME_UNIFY[k]; }).join(', ');
  const data = [
    ['設定項目', '値'],
    ['元スプレッドシートURL',              SOURCE_URL],
    ['受電報告タブ',                       SOURCE_TAB],
    ['  受電日列',                         columnToLetter_(COL_DATE) + '列'],
    ['  営業担当者列',                     columnToLetter_(COL_REP) + '列'],
    ['求人情報タブ',                       SOURCE_TAB_JOB],
    ['  案件取得日列',                     columnToLetter_(COL_JOB_DATE) + '列'],
    ['  営業担当者列 (G) 最優先',          columnToLetter_(COL_JOB_REP_G) + '列'],
    ['  面接担当者列 (B) [G無効時]',       columnToLetter_(COL_JOB_REP_B) + '列'],
    ['名前抽出ルール',                     '先頭の漢字2+連続 または カタカナ2+連続'],
    ['名前エイリアス (同一人物統合)',      aliasStr],
    ['受電数の補完ルール',                 'MAX(受電報告件数, 案件化件数)'],
    ['ダッシュボード表示条件',             '受電数 > 10 かつ 案件化率 < 100%'],
    ['強調表示条件',                       '受電数 ≥ 60 の行を太字＋緑背景'],
    ['並び順',                             '受電数 ≥ 60 を最上位 → 受電数 降順'],
  ];
  sh.getRange(1, 1, data.length, 2).setValues(data);
  sh.getRange('A1:B1').setFontWeight('bold');
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 560);
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
      'IFERROR(REGEXEXTRACT(TRIM(B2:B),' + RE_KANJI_LEAD + '),' +
      'IFERROR(REGEXEXTRACT(TRIM(B2:B),' + RE_KATA_LEAD + '),""))))'
  );

  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 200);
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

  const gName = 'IFERROR(REGEXEXTRACT(TRIM(B2:B),' + RE_KANJI_LEAD + '),' +
                'IFERROR(REGEXEXTRACT(TRIM(B2:B),' + RE_KATA_LEAD + '),""))';
  const bName = 'IFERROR(REGEXEXTRACT(TRIM(C2:C),' + RE_KANJI_LEAD + '),' +
                'IFERROR(REGEXEXTRACT(TRIM(C2:C),' + RE_KATA_LEAD + '),""))';

  sh.getRange('D1').setValue('実担当者').setFontWeight('bold');
  sh.getRange('D2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",' +
      'IF(LEN(' + gName + ')>0,' + gName + ',' + bName + ')))'
  );

  sh.getRange('E1').setValue('採用元').setFontWeight('bold');
  sh.getRange('E2').setFormula(
    '=ARRAYFORMULA(IF(A2:A="","",' +
      'IF(LEN(' + gName + ')>0,"G(営業)",' +
      'IF(LEN(' + bName + ')>0,"B(面接)","-"))))'
  );

  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 100);
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
    '① B3に開始日、D3に終了日を入力（変更すると自動再集計）\n' +
    '② 受電数は MAX(受電報告件数, 案件化数) で補完\n' +
    '③ 受電数 ≤ 10 / 案件化率 100% は除外、60件以上は強調'
  ).setFontColor('#555').setWrap(true);
  sh.getRange('F3:H3').merge();

  sh.getRange('A5:D5').setValues([['営業担当者', '受電数', '案件化数', '案件化率']])
    .setFontWeight('bold').setBackground('#c8e6c9').setHorizontalAlignment('center');

  // ===== レイアウトを固定化 =====
  const last     = 5 + MAX_ROWS;
  const totalRow = 6 + MAX_ROWS + 2;

  sh.getRange(totalRow, 1).setValue('合計');
  sh.getRange(totalRow, 2, 1, 3).setFormulas([[
    '=SUM(B6:B' + last + ')',
    '=SUM(C6:C' + last + ')',
    '=IFERROR(C' + totalRow + '/B' + totalRow + ',0)'
  ]]);
  sh.getRange(totalRow, 1, 1, 4).setFontWeight('bold').setBackground('#ffe0b2');
  sh.getRange(totalRow, 4).setNumberFormat('0.0%');

  // 初回データ投入
  refreshDashboardData_(sh);

  const dRange = sh.getRange('D6:D' + last);
  const cfRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#f8696b', SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue('#ffeb84', SpreadsheetApp.InterpolationType.NUMBER, '0.25')
    .setGradientMaxpointWithValue('#63be7b', SpreadsheetApp.InterpolationType.NUMBER, '0.5')
    .setRanges([dRange]).build();

  const priorityRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($B6),$B6>=60)')
    .setBold(true)
    .setBackground('#dcedc8')
    .setRanges([sh.getRange('A6:D' + last)]).build();

  sh.setConditionalFormatRules([cfRule, priorityRule]);

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

// ===== 日付変更時に自動再集計 =====
function refreshDashboardData_(sh) {
  const ss = sh.getParent();
  const startDate = sh.getRange('B3').getValue();
  const endDate   = sh.getRange('D3').getValue();

  sh.getRange(6, 1, MAX_ROWS, 4).clearContent();

  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return;

  const unifyName_ = function(name) {
    name = (name || '').toString().trim();
    return NAME_UNIFY[name] !== undefined ? NAME_UNIFY[name] : name;
  };

  const recvFromReport = {};
  const recvFromJob    = {};
  const casesCount     = {};

  const extSh = ss.getSheetByName(SH_EXTRACT);
  if (extSh) {
    const extVals = extSh.getDataRange().getValues();
    for (let i = 1; i < extVals.length; i++) {
      const eRow = extVals[i];
      const d    = eRow[0];
      const name = unifyName_(String(eRow[2] || '').trim());
      if (!name || name.length < 2) continue;
      if (d instanceof Date && d >= startDate && d <= endDate) {
        recvFromReport[name] = (recvFromReport[name] || 0) + 1;
      }
    }
  }

  const jobSh = ss.getSheetByName(SH_EXTRACT_JOB);
  if (jobSh) {
    const jobVals = jobSh.getDataRange().getValues();
    for (let j = 1; j < jobVals.length; j++) {
      const jRow    = jobVals[j];
      const repName = unifyName_(String(jRow[3] || '').trim());
      if (!repName || repName.length < 2) continue;
      const recvDate = jRow[0];
      if (recvDate instanceof Date && recvDate >= startDate && recvDate <= endDate) {
        recvFromJob[repName] = (recvFromJob[repName] || 0) + 1;
        casesCount[repName]  = (casesCount[repName]  || 0) + 1;
      }
    }
  }

  const allNames = {};
  for (const n in recvFromReport) allNames[n] = true;
  for (const n in recvFromJob)    allNames[n] = true;
  for (const n in casesCount)     allNames[n] = true;

  const dataRows = [];
  for (const pName in allNames) {
    const recv  = Math.max(recvFromReport[pName] || 0, recvFromJob[pName] || 0);
    const cases = casesCount[pName] || 0;
    const rate  = recv > 0 ? cases / recv : 0;
    if (recv <= 10) continue;
    if (recv > 0 && cases >= recv) continue;
    dataRows.push([pName, recv, cases, rate]);
  }

  dataRows.sort(function(a, b) {
    const aTop = a[1] >= 60 ? 0 : 1;
    const bTop = b[1] >= 60 ? 0 : 1;
    if (aTop !== bTop) return aTop - bTop;
    return b[1] - a[1];
  });

  if (dataRows.length > 0) {
    const writeCount = Math.min(dataRows.length, MAX_ROWS);
    sh.getRange(6, 1, writeCount, 4).setValues(dataRows.slice(0, writeCount));
    sh.getRange(6, 4, writeCount, 1).setNumberFormat('0.0%');
  }
}

// ===== onEdit シンプルトリガー: B3/D3 変更で再集計 =====
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SH_DASH) return;
  const r = e.range.getRow();
  const c = e.range.getColumn();
  if (r === 3 && (c === 2 || c === 4)) {
    refreshDashboardData_(sh);
  }
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

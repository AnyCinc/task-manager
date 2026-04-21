const pptxgen = require("pptxgenjs");
const path = require("path");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.author = "TaskFlow";
pptx.title = "TaskFlow 使い方ガイド";

// Notion-style colors
const BK = "37352f";
const GY = "787774";
const LG = "e9e9e7";
const BG = "f7f6f3";
const WH = "ffffff";
const RD = "eb5757";
const OR = "fa9a3b";
const BL = "2f80ed";
const GN = "4dab6f";

const BODY = { fontFace: "Yu Gothic UI", fontSize: 13, color: BK };
const SMALL = { fontFace: "Yu Gothic UI", fontSize: 11, color: GY };
const BOLD = { fontFace: "Yu Gothic UI", fontSize: 13, color: BK, bold: true };

// ===== Slide 1: 表紙 =====
let slide = pptx.addSlide();
slide.background = { color: WH };

// ロゴ
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 5.9, y: 1.8, w: 1.1, h: 1.1, fill: { color: BK }, rectRadius: 0.12,
});
slide.addText("T", {
  x: 5.9, y: 1.8, w: 1.1, h: 1.1, align: "center", valign: "middle",
  fontFace: "Yu Gothic UI", fontSize: 48, color: WH, bold: true,
});

slide.addText("TaskFlow", {
  x: 0, y: 3.1, w: 13.33, h: 0.8, align: "center",
  fontFace: "Yu Gothic UI", fontSize: 40, color: BK, bold: true,
});

slide.addText("使い方ガイド", {
  x: 0, y: 3.85, w: 13.33, h: 0.5, align: "center",
  fontFace: "Yu Gothic UI", fontSize: 18, color: GY,
});

slide.addText("タスク管理システム マニュアル  |  2026年3月", {
  x: 0, y: 4.5, w: 13.33, h: 0.4, align: "center",
  fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
});

// 下線
slide.addShape(pptx.shapes.LINE, {
  x: 4.5, y: 4.35, w: 4.33, h: 0, line: { color: LG, width: 1 },
});

// ===== Slide 2: 目次 =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("目次", {
  x: 0.7, y: 0.4, w: 5, h: 0.6,
  fontFace: "Yu Gothic UI", fontSize: 28, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 1.0, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

const tocItems = [
  "1.  ログイン方法",
  "2.  マイタスク",
  "3.  タスクボード",
  "4.  議事録からタスク抽出（管理者）",
  "5.  タスクを送る",
  "6.  メンバー管理（管理者）",
  "7.  API設定（管理者）",
];

tocItems.forEach((t, i) => {
  slide.addText(t, {
    x: 1.2, y: 1.3 + i * 0.55, w: 8, h: 0.45,
    fontFace: "Yu Gothic UI", fontSize: 16, color: BK,
  });
  // ドット
  slide.addShape(pptx.shapes.OVAL, {
    x: 0.9, y: 1.42 + i * 0.55, w: 0.16, h: 0.16, fill: { color: BK },
  });
});

// ===== Slide 3: ログイン方法 =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("1. ログイン方法", {
  x: 0.7, y: 0.3, w: 8, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 24, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

// 左側: 一般ユーザー
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 1.2, w: 5.6, h: 3.0, fill: { color: BG }, rectRadius: 0.1,
});
slide.addText("一般メンバー", {
  x: 1.0, y: 1.35, w: 5, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 15, color: BK, bold: true,
});

const loginLeft = [
  "最初の画面で自分の名前をクリックするだけ",
  "パスワードは不要",
  "サイドバー左下「← 最初の画面」で切替可能",
  "「+ メンバーを追加」で新規メンバー登録",
];
loginLeft.forEach((t, i) => {
  slide.addText([
    { text: "•  ", options: { color: GY, fontSize: 12 } },
    { text: t, options: { color: BK, fontSize: 12 } },
  ], { x: 1.0, y: 1.85 + i * 0.5, w: 5.0, h: 0.4, fontFace: "Yu Gothic UI" });
});

// 右側: 管理者
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.7, y: 1.2, w: 5.9, h: 3.0, fill: { color: "f5f0eb" }, rectRadius: 0.1,
});
slide.addText("管理者", {
  x: 7.0, y: 1.35, w: 5, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 15, color: BK, bold: true,
});

const loginRight = [
  "「管理者」をクリック",
  "パスワード入力画面が表示される",
  "パスワードを入力してログイン",
  "管理者専用メニューが利用可能に",
];
loginRight.forEach((t, i) => {
  slide.addText([
    { text: "•  ", options: { color: GY, fontSize: 12 } },
    { text: t, options: { color: BK, fontSize: 12 } },
  ], { x: 7.0, y: 1.85 + i * 0.5, w: 5.3, h: 0.4, fontFace: "Yu Gothic UI" });
});

// 注意
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 4.5, w: 11.9, h: 0.5, fill: { color: "f0f7ff" }, rectRadius: 0.06,
});
slide.addText("ヒント: ユーザー選択画面からも「+ メンバーを追加」ですぐにメンバー登録ができます", {
  x: 1.0, y: 4.5, w: 11.3, h: 0.5, valign: "middle",
  fontFace: "Yu Gothic UI", fontSize: 11, color: BK,
});

// ===== Slide 4: マイタスク =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("2. マイタスク", {
  x: 0.7, y: 0.3, w: 8, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 24, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

slide.addText("自分に割り当てられたタスクのみ表示される個人ページ", {
  x: 0.7, y: 1.05, w: 11.9, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 13, color: GY,
});

// セクション4カード
const secs = [
  { title: "期限超過・高優先度", color: RD, desc: "期限を過ぎた・優先度「高」" },
  { title: "進行中", color: OR, desc: "現在取り組み中のタスク" },
  { title: "未着手", color: BL, desc: "まだ開始していないタスク" },
  { title: "完了", color: GN, desc: "完了したタスク" },
];

secs.forEach((s, i) => {
  const cx = 0.7 + i * 3.1;
  // カード
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: cx, y: 1.6, w: 2.85, h: 1.6, fill: { color: WH },
    line: { color: LG, width: 0.75 }, rectRadius: 0.08,
  });
  // 左線
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: cx, y: 1.6, w: 0.06, h: 1.6, fill: { color: s.color },
  });
  slide.addText(s.title, {
    x: cx + 0.2, y: 1.72, w: 2.5, h: 0.35,
    fontFace: "Yu Gothic UI", fontSize: 13, color: s.color, bold: true,
  });
  slide.addText(s.desc, {
    x: cx + 0.2, y: 2.1, w: 2.5, h: 0.35,
    fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
  });
});

// 下部
const myItems = [
  "「+ クイック追加」ボタンで自分にタスクを素早く追加（タイトル・期限・優先度）",
  "タスクカードをクリックしてステータス変更: 未着手 → 進行中 → 完了",
  "期限超過のタスクは赤く表示され、進行中セクションにも同時表示される",
];
myItems.forEach((t, i) => {
  slide.addText([
    { text: "•  ", options: { color: GY } },
    { text: t, options: { color: BK } },
  ], {
    x: 0.7, y: 3.5 + i * 0.45, w: 11.9, h: 0.4,
    fontFace: "Yu Gothic UI", fontSize: 12,
  });
});

// ===== Slide 5: タスクボード =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("3. タスクボード", {
  x: 0.7, y: 0.3, w: 8, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 24, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

// メンバー別
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 1.1, w: 5.9, h: 2.5, fill: { color: BG }, rectRadius: 0.1,
});
slide.addText("メンバー別ビュー（デフォルト）", {
  x: 0.95, y: 1.2, w: 5.4, h: 0.35,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});
const mbItems = [
  "メンバーごとにタスク件数・内訳を表示",
  "タスクタイトル一覧（5件表示+スクロール）",
  "担当なしのタスクも表示",
  "期日2日前のタスクに警告マーク表示",
];
mbItems.forEach((t, i) => {
  slide.addText("•  " + t, {
    x: 0.95, y: 1.6 + i * 0.4, w: 5.4, h: 0.35,
    fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
  });
});

// ステータス別
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 6.9, y: 1.1, w: 5.7, h: 2.5, fill: { color: BG }, rectRadius: 0.1,
});
slide.addText("ステータス別ビュー", {
  x: 7.15, y: 1.2, w: 5.2, h: 0.35,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});
const sbItems = [
  "未着手 / 進行中 / 完了の3カラム",
  "タスククリックでステータス変更",
  "各カラムのタスク数を表示",
];
sbItems.forEach((t, i) => {
  slide.addText("•  " + t, {
    x: 7.15, y: 1.6 + i * 0.4, w: 5.2, h: 0.35,
    fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
  });
});

// 下部: 編集・フィルタ・管理者
slide.addText("タスク編集", {
  x: 0.7, y: 3.85, w: 2, h: 0.3,
  fontFace: "Yu Gothic UI", fontSize: 12, color: BK, bold: true,
});
slide.addText("クリックで編集モーダル。担当者を「個人 / 部門全員 / 全員」に変更可能。複数人割り当てOK", {
  x: 2.7, y: 3.85, w: 9.9, h: 0.3,
  fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
});

slide.addText("フィルタ", {
  x: 0.7, y: 4.3, w: 2, h: 0.3,
  fontFace: "Yu Gothic UI", fontSize: 12, color: BK, bold: true,
});
slide.addText("検索ボックス・優先度フィルタ（高/中/低）・担当者フィルタで絞り込み", {
  x: 2.7, y: 4.3, w: 9.9, h: 0.3,
  fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
});

// 管理者注意
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 4.8, w: 11.9, h: 0.5, fill: { color: "f0f7ff" }, rectRadius: 0.06,
});
slide.addText("管理者のみ: ボード上部に統計カード（全タスク/未着手/進行中/完了/期限超過）+ 期日超過・2日前アラート表示。タスク削除は管理者のみ可能", {
  x: 1.0, y: 4.8, w: 11.3, h: 0.5, valign: "middle",
  fontFace: "Yu Gothic UI", fontSize: 11, color: BK,
});

// ===== Slide 6: 議事録からタスク抽出 =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("4. 議事録からタスク抽出（管理者）", {
  x: 0.7, y: 0.3, w: 10, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 24, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

// 6ステップ (3x2グリッド)
const steps = [
  { n: "1", t: "会議名入力（任意）" },
  { n: "2", t: "議事録テキスト貼り付け" },
  { n: "3", t: "「AIでタスク抽出」クリック" },
  { n: "4", t: "Claude AIが自動解析" },
  { n: "5", t: "割り振り画面で編集" },
  { n: "6", t: "確定ボタンで保存" },
];

steps.forEach((s, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const sx = 0.7 + col * 4.15;
  const sy = 1.1 + row * 1.15;

  // 番号丸
  slide.addShape(pptx.shapes.OVAL, {
    x: sx, y: sy + 0.05, w: 0.45, h: 0.45, fill: { color: BK },
  });
  slide.addText(s.n, {
    x: sx, y: sy + 0.05, w: 0.45, h: 0.45, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 16, color: WH, bold: true,
  });
  slide.addText(s.t, {
    x: sx + 0.55, y: sy + 0.05, w: 3.3, h: 0.45, valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 13, color: BK,
  });

  // 矢印（最後以外）
  if (i < 5 && col < 2) {
    slide.addText("→", {
      x: sx + 3.6, y: sy + 0.05, w: 0.4, h: 0.45, align: "center", valign: "middle",
      fontFace: "Yu Gothic UI", fontSize: 18, color: GY,
    });
  }
});

// 一括割り当て
slide.addText("一括割り当て", {
  x: 0.7, y: 3.6, w: 2.5, h: 0.35,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});

const depts = ["全員", "営業全員", "事務全員", "マーケ全員", "人事全員"];
depts.forEach((d, i) => {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.7 + i * 2.1, y: 4.05, w: 1.85, h: 0.5,
    fill: { color: WH }, line: { color: LG, width: 0.75 }, rectRadius: 0.06,
  });
  slide.addText(d, {
    x: 0.7 + i * 2.1, y: 4.05, w: 1.85, h: 0.5, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 12, color: BK, bold: true,
  });
});

// 注意
slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
  x: 0.7, y: 4.8, w: 11.9, h: 0.45, fill: { color: "fffaf0" }, rectRadius: 0.06,
});
slide.addText("注意: AI抽出にはAnthropic APIキーの設定が必要です（API設定ページから設定）", {
  x: 1.0, y: 4.8, w: 11.3, h: 0.45, valign: "middle",
  fontFace: "Yu Gothic UI", fontSize: 11, color: BK,
});

// ===== Slide 7: タスクを送る + メンバー管理 + API設定 =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("5. タスクを送る / 6. メンバー管理 / 7. API設定", {
  x: 0.7, y: 0.3, w: 12, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 22, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

// 3カード
const cards = [
  {
    title: "タスクを送る",
    items: [
      "タスク名・説明・期限・優先度を入力",
      "チェックボックスで複数人選択",
      "一括選択ボタン:",
      "全員/営業/事務/マーケ/人事",
    ],
  },
  {
    title: "メンバー管理（管理者）",
    items: [
      "名前・イニシャル・部署・権限を設定",
      "部署: 営業/事務/マーケ/人事",
      "部署変更・メンバー削除可能",
      "選択画面からも追加OK",
    ],
  },
  {
    title: "API設定（管理者）",
    items: [
      "Anthropic APIキーを入力して保存",
      "AI機能（議事録タスク抽出）に必要",
      "キーはサーバー側に安全に保存",
      "",
    ],
  },
];

cards.forEach((c, ci) => {
  const cx = 0.7 + ci * 4.2;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: cx, y: 1.1, w: 3.95, h: 3.8, fill: { color: BG }, rectRadius: 0.1,
  });
  slide.addText(c.title, {
    x: cx + 0.2, y: 1.2, w: 3.55, h: 0.4,
    fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
  });
  c.items.forEach((t, ti) => {
    if (!t) return;
    slide.addText("•  " + t, {
      x: cx + 0.2, y: 1.7 + ti * 0.5, w: 3.55, h: 0.4,
      fontFace: "Yu Gothic UI", fontSize: 11, color: GY,
    });
  });
});

// ===== Slide 8: 各種区分 + タスクの流れ =====
slide = pptx.addSlide();
slide.background = { color: WH };

slide.addText("各種区分 / タスクの流れ", {
  x: 0.7, y: 0.3, w: 10, h: 0.55,
  fontFace: "Yu Gothic UI", fontSize: 24, color: BK, bold: true,
});
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 0.85, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

// 部署
slide.addText("部署", {
  x: 0.7, y: 1.1, w: 1.5, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});
["営業", "事務", "マーケティング", "人事"].forEach((d, i) => {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 2.5 + i * 2.0, y: 1.1, w: 1.7, h: 0.45, fill: { color: BG }, rectRadius: 0.06,
  });
  slide.addText(d, {
    x: 2.5 + i * 2.0, y: 1.1, w: 1.7, h: 0.45, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 12, color: BK, bold: true,
  });
});

// 優先度
slide.addText("優先度", {
  x: 0.7, y: 1.8, w: 1.5, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});
[["高", RD], ["中", OR], ["低", BL]].forEach(([l, c], i) => {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 2.5 + i * 1.8, y: 1.8, w: 1.5, h: 0.45,
    fill: { color: WH }, line: { color: c, width: 1.5 }, rectRadius: 0.06,
  });
  slide.addText(l, {
    x: 2.5 + i * 1.8, y: 1.8, w: 1.5, h: 0.45, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 13, color: c, bold: true,
  });
});

// ステータス
slide.addText("ステータス", {
  x: 0.7, y: 2.5, w: 1.8, h: 0.4,
  fontFace: "Yu Gothic UI", fontSize: 14, color: BK, bold: true,
});
[["未着手", BL], ["進行中", OR], ["完了", GN]].forEach(([l, c], i) => {
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 2.5 + i * 2.0, y: 2.5, w: 1.7, h: 0.45, fill: { color: c }, rectRadius: 0.06,
  });
  slide.addText(l, {
    x: 2.5 + i * 2.0, y: 2.5, w: 1.7, h: 0.45, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 13, color: WH, bold: true,
  });
});

// タスクの流れ
slide.addShape(pptx.shapes.LINE, {
  x: 0.7, y: 3.3, w: 11.9, h: 0, line: { color: LG, width: 1 },
});

slide.addText("タスクの流れ", {
  x: 0.7, y: 3.5, w: 3, h: 0.5,
  fontFace: "Yu Gothic UI", fontSize: 16, color: BK, bold: true,
});

const flow = ["議事録入力", "AI抽出", "割り振り", "マイタスク", "ステータス管理", "完了"];
flow.forEach((item, i) => {
  const fx = 0.7 + i * 2.1;
  const isFirst = i === 0;
  const isLast = i === flow.length - 1;

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: fx, y: 4.2, w: 1.8, h: 0.65,
    fill: { color: isFirst ? BK : isLast ? GN : BG }, rectRadius: 0.08,
  });
  slide.addText(item, {
    x: fx, y: 4.2, w: 1.8, h: 0.65, align: "center", valign: "middle",
    fontFace: "Yu Gothic UI", fontSize: 12, color: isFirst || isLast ? WH : BK, bold: true,
  });

  if (i < flow.length - 1) {
    slide.addText("→", {
      x: fx + 1.75, y: 4.2, w: 0.35, h: 0.65, align: "center", valign: "middle",
      fontFace: "Yu Gothic UI", fontSize: 16, color: GY,
    });
  }
});

// ===== 出力 =====
const outPath = "C:\\Users\\User\\Desktop\\TaskFlow_使い方ガイド.pptx";
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("PPTX created:", outPath);
}).catch(err => {
  console.error("Error:", err);
});

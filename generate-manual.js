const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "TaskFlow_使い方ガイド.pdf");
const doc = new PDFDocument({
  size: "A4", layout: "landscape",
  margins: { top: 30, bottom: 24, left: 44, right: 44 },
  autoFirstPage: true,
});

doc.registerFont("JP", "C:/Windows/Fonts/yumin.ttf");
doc.registerFont("JPB", "C:/Windows/Fonts/yumindb.ttf");

const stream = fs.createWriteStream(out);
doc.pipe(stream);

const W = doc.page.width;  // 841.89
const H = doc.page.height; // 595.28
const CW = W - 88;
const MAX_Y = H - 34;

const C = {
  bk: "#37352f", gy: "#787774", lg: "#e9e9e7", bg: "#f7f6f3",
  rd: "#eb5757", or: "#fa9a3b", bl: "#2f80ed", gn: "#4dab6f", wh: "#ffffff",
};

let pg = 0;
function footer() {
  pg++;
  doc.font("JP").fontSize(6.5).fillColor(C.gy);
  doc.text("TaskFlow Guide | " + pg, 44, H - 18, { width: CW, align: "center" });
}

function hdr(t, y) {
  doc.font("JPB").fontSize(11).fillColor(C.bk).text(t, 44, y);
  doc.moveTo(44, y + 14).lineTo(W - 44, y + 14).strokeColor(C.lg).lineWidth(0.5).stroke();
  return y + 18;
}

function b(t, y, x) {
  x = x || 54;
  doc.font("JP").fontSize(8.5).fillColor(C.bk).text("\u2022 " + t, x, y, { width: CW - (x - 44) });
  return y + 12;
}

// ===================== PAGE 1 =====================
footer();
let y = 28;

// タイトルバー
doc.roundedRect(44, y, 22, 22, 3).fill(C.bk);
doc.font("JPB").fontSize(14).fillColor(C.wh).text("T", 44, y + 4, { width: 22, align: "center" });
doc.font("JPB").fontSize(14).fillColor(C.bk).text("TaskFlow \u4F7F\u3044\u65B9\u30AC\u30A4\u30C9", 72, y + 4);
doc.font("JP").fontSize(7).fillColor(C.gy).text("2026.03", W - 100, y + 8, { width: 56, align: "right" });
doc.moveTo(44, y + 26).lineTo(W - 44, y + 26).strokeColor(C.bk).lineWidth(0.8).stroke();
y += 34;

// --- 1. ログイン ---
y = hdr("1. \u30ED\u30B0\u30A4\u30F3\u65B9\u6CD5", y);
y = b("\u6700\u521D\u306E\u753B\u9762\u3067\u81EA\u5206\u306E\u540D\u524D\u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3060\u3051\u3067\u30ED\u30B0\u30A4\u30F3\uFF08\u30D1\u30B9\u30EF\u30FC\u30C9\u4E0D\u8981\uFF09", y);
y = b("\u7BA1\u7406\u8005\u306F\u300C\u7BA1\u7406\u8005\u300D\u30AF\u30EA\u30C3\u30AF\u2192\u30D1\u30B9\u30EF\u30FC\u30C9\u5165\u529B\u304C\u5FC5\u8981\u3002\u30B5\u30A4\u30C9\u30D0\u30FC\u5DE6\u4E0B\u300C\u2190 \u6700\u521D\u306E\u753B\u9762\u300D\u3067\u30E6\u30FC\u30B6\u30FC\u5207\u66FF\u53EF\u80FD", y);
y = b("\u30E1\u30F3\u30D0\u30FC\u304C\u3044\u306A\u3044\u5834\u5408\u306F\u300C+ \u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0\u300D\u304B\u3089\u7C21\u5358\u306B\u8FFD\u52A0\u53EF\u80FD", y);

y += 4;
// --- 2. マイタスク ---
y = hdr("2. \u30DE\u30A4\u30BF\u30B9\u30AF", y);
y = b("\u81EA\u5206\u306B\u5272\u308A\u5F53\u3066\u3089\u308C\u305F\u30BF\u30B9\u30AF\u306E\u307F\u8868\u793A\u3002\u300C+ \u30AF\u30A4\u30C3\u30AF\u8FFD\u52A0\u300D\u3067\u81EA\u5206\u306B\u30BF\u30B9\u30AF\u3092\u7D20\u65E9\u304F\u8FFD\u52A0\u53EF\u80FD", y);

// セクション横並び
doc.font("JPB").fontSize(8).fillColor(C.bk).text("\u30BB\u30AF\u30B7\u30E7\u30F3:", 54, y + 1);
let sx = 110;
[["\u671F\u9650\u8D85\u904E\u30FB\u9AD8", C.rd], ["\u9032\u884C\u4E2D", C.or], ["\u672A\u7740\u624B", C.bl], ["\u5B8C\u4E86", C.gn]].forEach(([n, c]) => {
  doc.roundedRect(sx, y, 3, 11, 1).fill(c);
  doc.font("JP").fontSize(7.5).fillColor(C.bk).text(n, sx + 6, y + 1);
  sx += 80;
});
y += 14;
y = b("\u30BF\u30B9\u30AF\u30AF\u30EA\u30C3\u30AF\u3067\u30B9\u30C6\u30FC\u30BF\u30B9\u5909\u66F4\uFF08\u672A\u7740\u624B \u2192 \u9032\u884C\u4E2D \u2192 \u5B8C\u4E86\uFF09", y);

y += 4;
// --- 3. タスクボード ---
y = hdr("3. \u30BF\u30B9\u30AF\u30DC\u30FC\u30C9", y);

// 2列
const colW = (CW - 16) / 2;
doc.roundedRect(44, y, colW, 52, 3).strokeColor(C.lg).lineWidth(0.5).stroke();
doc.font("JPB").fontSize(8.5).fillColor(C.bk).text("\u30E1\u30F3\u30D0\u30FC\u5225\uFF08\u30C7\u30D5\u30A9\u30EB\u30C8\uFF09", 50, y + 4);
doc.font("JP").fontSize(7.5).fillColor(C.gy);
doc.text("\u2022 \u30E1\u30F3\u30D0\u30FC\u3054\u3068\u306B\u30BF\u30B9\u30AF\u4EF6\u6570\u30FB\u5185\u8A33\u3092\u8868\u793A", 50, y + 16);
doc.text("\u2022 \u30BF\u30B9\u30AF\u30BF\u30A4\u30C8\u30EB\u4E00\u89A7\uFF085\u4EF6+\u30B9\u30AF\u30ED\u30FC\u30EB\uFF09", 50, y + 27);
doc.text("\u2022 \u62C5\u5F53\u306A\u3057\u30FB\u671F\u65E52\u65E5\u524D\u8B66\u544A\u30DE\u30FC\u30AF", 50, y + 38);

const rx = 44 + colW + 16;
doc.roundedRect(rx, y, colW, 52, 3).strokeColor(C.lg).lineWidth(0.5).stroke();
doc.font("JPB").fontSize(8.5).fillColor(C.bk).text("\u30B9\u30C6\u30FC\u30BF\u30B9\u5225", rx + 6, y + 4);
doc.font("JP").fontSize(7.5).fillColor(C.gy);
doc.text("\u2022 \u672A\u7740\u624B / \u9032\u884C\u4E2D / \u5B8C\u4E86\u306E3\u30AB\u30E9\u30E0", rx + 6, y + 16);
doc.text("\u2022 \u30BF\u30B9\u30AF\u30AF\u30EA\u30C3\u30AF\u3067\u7DE8\u96C6\u30FB\u30B9\u30C6\u30FC\u30BF\u30B9\u5909\u66F4", rx + 6, y + 27);
doc.text("\u2022 \u5404\u30AB\u30E9\u30E0\u306E\u30BF\u30B9\u30AF\u6570\u8868\u793A", rx + 6, y + 38);

y += 58;
y = b("\u30BF\u30B9\u30AF\u7DE8\u96C6: \u30AF\u30EA\u30C3\u30AF\u3067\u30E2\u30FC\u30C0\u30EB\u8868\u793A\u3002\u62C5\u5F53\u8005\u3092\u300C\u500B\u4EBA / \u90E8\u9580\u5168\u54E1 / \u5168\u54E1\u300D\u306B\u5909\u66F4\u53EF\u80FD\u3002\u8907\u6570\u4EBA\u5272\u308A\u5F53\u3066\u3082\u53EF", y);
y = b("\u691C\u7D22\u30DC\u30C3\u30AF\u30B9\u30FB\u512A\u5148\u5EA6\u30D5\u30A3\u30EB\u30BF\u30FB\u62C5\u5F53\u8005\u30D5\u30A3\u30EB\u30BF\u3067\u7D5E\u308A\u8FBC\u307F", y);

doc.roundedRect(44, y, CW, 16, 2).fill("#f0f7ff");
doc.font("JP").fontSize(7.5).fillColor(C.bk).text("\u7BA1\u7406\u8005\u306E\u307F: \u7D71\u8A08\u30AB\u30FC\u30C9\uFF08\u5168\u30BF\u30B9\u30AF/\u672A\u7740\u624B/\u9032\u884C\u4E2D/\u5B8C\u4E86/\u671F\u9650\u8D85\u904E\uFF09+ \u671F\u65E5\u8D85\u904E\u30FB2\u65E5\u524D\u30A2\u30E9\u30FC\u30C8\u8868\u793A\u3002\u30BF\u30B9\u30AF\u524A\u9664\u306F\u7BA1\u7406\u8005\u306E\u307F\u3002", 50, y + 4, { width: CW - 16 });
y += 22;

y += 4;
// --- 5. タスクを送る ---
y = hdr("5. \u30BF\u30B9\u30AF\u3092\u9001\u308B", y);
y = b("\u30BF\u30B9\u30AF\u540D\u30FB\u8AAC\u660E\u30FB\u671F\u9650\u30FB\u512A\u5148\u5EA6\u3092\u5165\u529B\u3057\u3001\u9001\u4FE1\u5148\u3092\u30C1\u30A7\u30C3\u30AF\u30DC\u30C3\u30AF\u30B9\u3067\u9078\u629E\uFF08\u8907\u6570\u53EF\uFF09", y);
y = b("\u4E00\u62EC\u9078\u629E: \u300C\u5168\u54E1\u9078\u629E\u300D\u300C\u55B6\u696D\u300D\u300C\u4E8B\u52D9\u300D\u300C\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0\u300D\u300C\u4EBA\u4E8B\u300D\u30DC\u30BF\u30F3\u3067\u90E8\u9580\u5358\u4F4D\u9001\u4FE1", y);

// ===================== PAGE 2 =====================
doc.addPage(); footer();
y = 28;

// --- 4. 議事録 ---
y = hdr("4. \u8B70\u4E8B\u9332\u304B\u3089\u30BF\u30B9\u30AF\u62BD\u51FA\uFF08\u7BA1\u7406\u8005\uFF09", y);

const steps = [
  ["Step1", "\u4F1A\u8B70\u540D\u5165\u529B\uFF08\u4EFB\u610F\uFF09"],
  ["Step2", "\u8B70\u4E8B\u9332\u30C6\u30AD\u30B9\u30C8\u8CBC\u308A\u4ED8\u3051"],
  ["Step3", "\u300CAI\u3067\u30BF\u30B9\u30AF\u62BD\u51FA\u300D\u30AF\u30EA\u30C3\u30AF"],
  ["Step4", "Claude AI\u304C\u81EA\u52D5\u89E3\u6790"],
  ["Step5", "\u5272\u308A\u632F\u308A\u753B\u9762\u3067\u7DE8\u96C6"],
  ["Step6", "\u78BA\u5B9A\u3067\u4FDD\u5B58"],
];

// 横3列×2行
steps.forEach((s, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const bx = 54 + col * 240;
  const by = y + row * 20;
  doc.roundedRect(bx, by, 34, 15, 2).fill(C.bk);
  doc.font("JPB").fontSize(7).fillColor(C.wh).text(s[0], bx + 1, by + 4, { width: 32, align: "center" });
  doc.font("JP").fontSize(8.5).fillColor(C.bk).text(s[1], bx + 38, by + 3);
});
y += 46;
y = b("\u4E00\u62EC\u5272\u308A\u5F53\u3066: \u300C\u5168\u54E1\u300D\u300C\u55B6\u696D\u5168\u54E1\u300D\u300C\u4E8B\u52D9\u5168\u54E1\u300D\u7B49\u3001\u90E8\u9580\u5358\u4F4D\u306E\u62C5\u5F53\u8005\u4E00\u62EC\u5272\u308A\u5F53\u3066\u304C\u53EF\u80FD", y);
y = b("\u500B\u5225\u306B\u30C9\u30ED\u30C3\u30D7\u30C0\u30A6\u30F3\u304B\u3089\u62C5\u5F53\u8005\u5909\u66F4\u3082OK", y);

doc.roundedRect(44, y, CW, 14, 2).fill("#fffaf0");
doc.font("JP").fontSize(7).fillColor(C.bk).text("\u6CE8\u610F: AI\u62BD\u51FA\u306B\u306FAnthropic API\u30AD\u30FC\u306E\u8A2D\u5B9A\u304C\u5FC5\u8981\uFF08\u4E0B\u8A18API\u8A2D\u5B9A\u53C2\u7167\uFF09", 50, y + 3, { width: CW - 16 });
y += 22;

// --- 6. メンバー管理 ---
y = hdr("6. \u30E1\u30F3\u30D0\u30FC\u7BA1\u7406\uFF08\u7BA1\u7406\u8005\uFF09", y);
y = b("\u540D\u524D\u30FB\u30A4\u30CB\u30B7\u30E3\u30EB\u30FB\u90E8\u7F72\uFF08\u55B6\u696D/\u4E8B\u52D9/\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0/\u4EBA\u4E8B\uFF09\u30FB\u6A29\u9650\u3092\u8A2D\u5B9A\u3057\u3066\u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0", y);
y = b("\u90E8\u7F72\u5909\u66F4\u30FB\u524A\u9664\u304C\u53EF\u80FD\u3002\u30E6\u30FC\u30B6\u30FC\u9078\u629E\u753B\u9762\u306E\u300C+ \u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0\u300D\u304B\u3089\u3082\u8FFD\u52A0OK", y);

y += 4;
// --- 7. API設定 ---
y = hdr("7. API\u8A2D\u5B9A\uFF08\u7BA1\u7406\u8005\uFF09", y);
y = b("Anthropic API\u30AD\u30FC\u3092\u5165\u529B\u3057\u3066\u4FDD\u5B58\u3002AI\u6A5F\u80FD\uFF08\u8B70\u4E8B\u9332\u62BD\u51FA\uFF09\u306B\u5FC5\u8981\u3002\u30B5\u30FC\u30D0\u30FC\u5074\u306B\u5B89\u5168\u4FDD\u5B58", y);

y += 8;
// --- 8. 各種区分 ---
y = hdr("8. \u5404\u7A2E\u533A\u5206", y);

// 部署
doc.font("JPB").fontSize(8).fillColor(C.bk).text("\u90E8\u7F72:", 54, y);
let dx = 90;
["\u55B6\u696D", "\u4E8B\u52D9", "\u30DE\u30FC\u30B1\u30C6\u30A3\u30F3\u30B0", "\u4EBA\u4E8B"].forEach(d => {
  doc.roundedRect(dx, y - 2, 62, 16, 3).fill(C.bg);
  doc.font("JP").fontSize(7.5).fillColor(C.bk).text(d, dx, y + 1, { width: 62, align: "center" });
  dx += 70;
});
y += 20;

// 優先度
doc.font("JPB").fontSize(8).fillColor(C.bk).text("\u512A\u5148\u5EA6:", 54, y);
dx = 90;
[["\u9AD8", C.rd], ["\u4E2D", C.or], ["\u4F4E", C.bl]].forEach(([l, c]) => {
  doc.roundedRect(dx, y - 2, 40, 16, 3).strokeColor(c).lineWidth(1).stroke();
  doc.font("JPB").fontSize(7.5).fillColor(c).text(l, dx, y + 1, { width: 40, align: "center" });
  dx += 48;
});
y += 20;

// ステータス
doc.font("JPB").fontSize(8).fillColor(C.bk).text("\u30B9\u30C6\u30FC\u30BF\u30B9:", 54, y);
dx = 90;
[["\u672A\u7740\u624B", C.bl], ["\u9032\u884C\u4E2D", C.or], ["\u5B8C\u4E86", C.gn]].forEach(([l, c]) => {
  doc.roundedRect(dx, y - 2, 52, 16, 3).fill(c);
  doc.font("JPB").fontSize(7.5).fillColor(C.wh).text(l, dx, y + 1, { width: 52, align: "center" });
  dx += 60;
});
y += 26;

// フロー図
doc.font("JPB").fontSize(9).fillColor(C.bk).text("\u30BF\u30B9\u30AF\u306E\u6D41\u308C:", 54, y);
y += 14;
dx = 54;
["\u8B70\u4E8B\u9332\u5165\u529B", "AI\u62BD\u51FA", "\u5272\u308A\u632F\u308A", "\u30DE\u30A4\u30BF\u30B9\u30AF", "\u30B9\u30C6\u30FC\u30BF\u30B9\u7BA1\u7406", "\u5B8C\u4E86"].forEach((item, i) => {
  const w = 78;
  doc.roundedRect(dx, y, w, 20, 3).fill(i === 0 ? C.bk : C.bg);
  doc.font("JPB").fontSize(7.5).fillColor(i === 0 ? C.wh : C.bk).text(item, dx + 2, y + 6, { width: w - 4, align: "center" });
  if (i < 5) {
    doc.font("JP").fontSize(9).fillColor(C.gy).text("\u2192", dx + w + 2, y + 5);
  }
  dx += w + 16;
});

doc.end();
stream.on("finish", () => console.log("PDF: " + out));

const http = require("http");

// 寺西にタスクを送信するテスト
const data = JSON.stringify({
  title: "テスト個人通知",
  description: "個人通知テスト",
  assignee_id: 7,
  deadline: "2026-03-26",
  priority: "high",
  sender_id: 1,
});

const req = http.request({
  hostname: "localhost", port: 3000,
  path: "/api/tasks/send", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
}, res => {
  let body = "";
  res.on("data", c => body += c);
  res.on("end", () => console.log(res.statusCode, body));
});
req.write(data);
req.end();

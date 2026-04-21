const http = require("http");

const url = "https://defaultd6fbdf7cf1604d2a9721fc302edc20.09.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b6afc8cc6b8745a3ba6134ecd57591fd/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=U2ear5CU1IVmELGvVensVnCGjzw5_vzhrlTa3EV-_vs";

const data = JSON.stringify({ webhookUrl: url });
const req = http.request({
  hostname: "localhost", port: 3000,
  path: "/api/settings/webhook", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
}, res => {
  let body = "";
  res.on("data", c => body += c);
  res.on("end", () => console.log(res.statusCode, body));
});
req.write(data);
req.end();

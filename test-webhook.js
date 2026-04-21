const http = require("http");

const req = http.request({
  hostname: "localhost", port: 3000,
  path: "/api/settings/webhook/test", method: "POST",
  headers: { "Content-Type": "application/json" },
}, res => {
  let body = "";
  res.on("data", c => body += c);
  res.on("end", () => console.log(res.statusCode, body));
});
req.write("{}");
req.end();

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const DB = path.join(__dirname, "tasks.db");
(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB);
  const db = new SQL.Database(buf);
  db.run("UPDATE users SET email = ? WHERE name LIKE ?", ["kobayashi@hitokiwa.onmicrosoft.com", "%小林%"]);
  db.run("UPDATE users SET email = ? WHERE name LIKE ?", ["s.goto@hitokiwa.onmicrosoft.com", "%後藤%"]);
  fs.writeFileSync(DB, Buffer.from(db.export()));
  const r = db.exec("SELECT name, email FROM users WHERE email != ''");
  console.log(JSON.stringify(r[0].values, null, 2));
})();

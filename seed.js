const { initDb, query, run, hashPin } = require("./db");

async function seed() {
  await initDb();

  const members = [
    { name: "寺西", initial: "T" },
    { name: "寺田", initial: "D" },
    { name: "小林", initial: "V" },
    { name: "小峯", initial: "N" },
    { name: "田中A", initial: "A" },
    { name: "清水", initial: "M" },
    { name: "メグ", initial: "" },
    { name: "後藤", initial: "Y" },
    { name: "松居", initial: "E" },
  ];

  // 既存データをクリーンアップ（管理者以外）
  run("DELETE FROM users WHERE role = 'member'");

  for (const m of members) {
    try {
      run("INSERT INTO users (name, initial, role, pin_hash) VALUES (?, ?, ?, ?)",
        [m.name, m.initial, "member", hashPin("0000")]);
      console.log(`登録: ${m.name} (${m.initial})`);
    } catch (e) {
      console.log(`スキップ: ${m.name} - ${e.message}`);
    }
  }

  console.log("\n登録完了:");
  const users = query("SELECT id, name, initial, role FROM users ORDER BY id");
  users.forEach(u => console.log(`  [${u.id}] ${u.name} (${u.initial}) - ${u.role}`));
}

seed().catch(console.error);

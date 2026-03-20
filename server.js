const express = require("express");
const path = require("path");
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");
const { initDb, query, run, lastId, hashPin } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const APIKEY_PATH = path.join(__dirname, ".apikey");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try { return fs.readFileSync(APIKEY_PATH, "utf-8").trim(); } catch { return ""; }
}

function getAnthropic() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("APIキーが未設定です。管理者メニューの「API設定」から設定してください。");
  return new Anthropic({ apiKey });
}

// ===== APIキー設定 =====
app.get("/api/settings/apikey", (req, res) => {
  const key = getApiKey();
  res.json({ configured: !!key, masked: key ? key.slice(0, 7) + "..." + key.slice(-4) : "" });
});

app.post("/api/settings/apikey", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith("sk-")) return res.status(400).json({ error: "有効なAPIキーを入力してください" });
  fs.writeFileSync(APIKEY_PATH, apiKey.trim());
  res.json({ success: true });
});

// ===== ユーザー管理 =====
app.get("/api/users", (req, res) => {
  res.json(query("SELECT id, name, initial, role, created_at FROM users ORDER BY role DESC, name"));
});

app.post("/api/users", (req, res) => {
  const { name, initial, role, pin } = req.body;
  if (!name) return res.status(400).json({ error: "名前は必須です" });
  try {
    run("INSERT INTO users (name, initial, role, pin_hash) VALUES (?, ?, ?, ?)",
      [name.trim(), (initial || "").trim(), role || "member", hashPin(pin || "0000")]);
    const id = lastId();
    res.json({ id, name: name.trim(), initial: (initial || "").trim(), role: role || "member" });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(400).json({ error: "その名前は既に登録されています" });
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/users/:id", (req, res) => {
  run("DELETE FROM users WHERE id = ?", [Number(req.params.id)]);
  res.json({ success: true });
});

// ===== ログイン =====
app.post("/api/login", (req, res) => {
  const { name, pin } = req.body;
  const users = query("SELECT id, name, initial, role, pin_hash FROM users WHERE name = ?", [name]);
  if (!users.length) return res.status(401).json({ error: "ユーザーが見つかりません" });
  const user = users[0];
  if (user.pin_hash && user.pin_hash !== hashPin(pin || "")) {
    return res.status(401).json({ error: "PINが正しくありません" });
  }
  res.json({ id: user.id, name: user.name, initial: user.initial, role: user.role });
});

// ===== 議事録からタスク抽出（プレビューのみ、保存しない） =====
app.post("/api/extract", async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "議事録の内容を入力してください" });

  const members = query("SELECT id, name, initial FROM users");
  let memberInfo = "";
  if (members.length > 0) {
    memberInfo = "\n\n登録メンバー一覧（担当者名はこのリストの「名前」を正確に使ってください）:\n" +
      members.map(m => `- 名前: ${m.name}（イニシャル: ${m.initial}）`).join("\n");
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const anthropic = getAnthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `以下の議事録からタスク（やるべきこと・アクションアイテム）を抽出してください。
今日の日付は ${today} です。相対的な日付（来週金曜、今週中など）は具体的なYYYY-MM-DD形式に変換してください。
${memberInfo}

各タスクについて以下の情報をJSON配列で返してください：
- title: タスクの簡潔なタイトル
- description: タスクの詳細説明
- assignee_name: 担当者の名前（登録メンバーリストの名前を使用。不明なら空文字）
- deadline: 期限（YYYY-MM-DD形式、不明なら空文字）
- priority: 優先度（"high", "medium", "low"）

JSONの配列のみを返してください。マークダウンのコードブロックや説明文は不要です。

議事録:
${content}`
      }],
    });

    const text = message.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: "タスクの抽出に失敗しました" });

    const tasks = JSON.parse(jsonMatch[0]).map(t => {
      const assigneeName = t.assignee_name || "";
      const assignee = assigneeName ? members.find(m => m.name === assigneeName) : null;
      return {
        title: t.title || "無題",
        description: t.description || "",
        assignee_id: assignee ? assignee.id : null,
        assignee_name: assigneeName,
        deadline: t.deadline || "",
        priority: ["high", "medium", "low"].includes(t.priority) ? t.priority : "medium",
      };
    });

    res.json({ tasks, members });
  } catch (err) {
    console.error("Extract error:", err);
    res.status(500).json({ error: "タスク抽出中にエラー: " + err.message });
  }
});

// ===== タスク確定保存 =====
app.post("/api/tasks/bulk", (req, res) => {
  const { title, content, userId, tasks } = req.body;
  if (!tasks || !tasks.length) return res.status(400).json({ error: "タスクがありません" });

  const meetingTitle = title || `議事録 ${new Date().toLocaleDateString("ja-JP")}`;
  run("INSERT INTO meetings (title, content, created_by) VALUES (?, ?, ?)",
    [meetingTitle, content || "", userId || null]);
  const meetingId = lastId();

  const inserted = [];
  for (const t of tasks) {
    run("INSERT INTO tasks (meeting_id, title, description, assignee_id, assignee_name, deadline, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [meetingId, t.title, t.description || "", t.assignee_id || null, t.assignee_name || "", t.deadline || "", t.priority || "medium"]);
    inserted.push({ id: lastId(), ...t, meeting_id: meetingId, status: "todo" });
  }
  res.json({ meetingId, tasks: inserted });
});

// ===== 個人にタスクを直接送る =====
app.post("/api/tasks/send", (req, res) => {
  const { title, description, assignee_id, deadline, priority, sender_id } = req.body;
  if (!title) return res.status(400).json({ error: "タイトルは必須です" });
  if (!assignee_id) return res.status(400).json({ error: "担当者を選んでください" });

  const assignee = query("SELECT name FROM users WHERE id = ?", [Number(assignee_id)]);
  const assigneeName = assignee[0]?.name || "";

  run("INSERT INTO tasks (title, description, assignee_id, assignee_name, deadline, priority) VALUES (?, ?, ?, ?, ?, ?)",
    [title, description || "", Number(assignee_id), assigneeName, deadline || "", priority || "medium"]);

  res.json({ id: lastId(), title, assignee_name: assigneeName, status: "todo" });
});

// ===== タスク CRUD =====
app.get("/api/tasks", (req, res) => {
  const { status, priority, assignee_id, search } = req.query;
  let sql = `SELECT t.*, u.name as assignee_display
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE 1=1`;
  const params = [];

  if (status) { sql += " AND t.status = ?"; params.push(status); }
  if (priority) { sql += " AND t.priority = ?"; params.push(priority); }
  if (assignee_id) { sql += " AND t.assignee_id = ?"; params.push(Number(assignee_id)); }
  if (search) { sql += " AND (t.title LIKE ? OR t.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  sql += " ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC";
  res.json(query(sql, params));
});

app.patch("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const allowed = ["title", "description", "assignee_id", "assignee_name", "deadline", "priority", "status"];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: "更新するフィールドがありません" });

  fields.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  run(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`, values);

  const rows = query(`SELECT t.*, u.name as assignee_display
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ?`, [id]);
  res.json(rows[0] || {});
});

app.delete("/api/tasks/:id", (req, res) => {
  run("DELETE FROM tasks WHERE id = ?", [Number(req.params.id)]);
  res.json({ success: true });
});

// ===== ダッシュボード集計 =====
app.get("/api/dashboard", (req, res) => {
  const totalRow = query("SELECT COUNT(*) as c FROM tasks");
  const totalTasks = totalRow[0]?.c || 0;
  const byStatus = query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status");
  const byAssignee = query(`
    SELECT u.id, u.name, u.initial,
      COUNT(t.id) as total,
      SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
    FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
    WHERE u.role = 'member'
    GROUP BY u.id ORDER BY u.name
  `);
  const overdueRow = query(
    "SELECT COUNT(*) as c FROM tasks WHERE deadline != '' AND deadline < date('now','localtime') AND status != 'done'"
  );
  const overdue = overdueRow[0]?.c || 0;

  res.json({ totalTasks, byStatus, byAssignee, overdue });
});

// ===== 議事録一覧 =====
app.get("/api/meetings", (req, res) => {
  res.json(query(`
    SELECT m.*, u.name as created_by_name, COUNT(t.id) as task_count
    FROM meetings m
    LEFT JOIN users u ON m.created_by = u.id
    LEFT JOIN tasks t ON t.meeting_id = m.id
    GROUP BY m.id ORDER BY m.created_at DESC
  `));
});

// ===== 起動 =====
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`タスク管理システム起動: http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error("起動エラー:", err);
  process.exit(1);
});

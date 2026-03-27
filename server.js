const express = require("express");
const path = require("path");
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");
const { initDb, query, run, lastId, hashPin } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const APIKEY_PATH = path.join(__dirname, ".apikey");
const WEBHOOK_PATH = path.join(__dirname, ".webhook");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Teams Webhook =====
function getWebhookUrl() {
  try { return fs.readFileSync(WEBHOOK_PATH, "utf-8").trim(); } catch { return ""; }
}

// Adaptive Card形式でTeams通知
async function sendTeamsNotify(title, body, color, assignees) {
  const url = getWebhookUrl();
  if (!url) return;
  color = color || "0078D7";

  // assignees: [{ name, task, deadline }] — Power Automateで個人通知に使う
  const bodyBlocks = [
    {
      type: "TextBlock",
      text: title,
      weight: "bolder",
      size: "medium",
      color: "accent",
    },
    {
      type: "TextBlock",
      text: body.replace(/\\n/g, "\n"),
      wrap: true,
      size: "small",
    },
  ];

  // 担当者テーブル（Power Automate用）
  if (assignees && assignees.length) {
    bodyBlocks.push({
      type: "TextBlock",
      text: "担当者一覧:",
      weight: "bolder",
      size: "small",
      spacing: "medium",
    });
    for (const a of assignees) {
      bodyBlocks.push({
        type: "ColumnSet",
        columns: [
          { type: "Column", width: "80px", items: [{ type: "TextBlock", text: a.name || "未割当", weight: "bolder", size: "small" }] },
          { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: a.task || "", size: "small", wrap: true }] },
          { type: "Column", width: "80px", items: [{ type: "TextBlock", text: a.deadline || "-", size: "small", color: a.overdue ? "attention" : "default" }] },
        ],
      });
    }
  }

  // プレーンテキスト（Power Automateの個人通知用 — TO:メールを含める）
  let plainText = `【${title}】\n${body}`;
  if (assignees && assignees.length) {
    const allUsers = query("SELECT id, name, email FROM users WHERE email != ''");
    const emails = assignees.map(a => {
      const user = allUsers.find(u => u.name === a.name);
      return user?.email || "";
    }).filter(e => e);
    if (emails.length) plainText = `TO:${emails.join(",")} ` + plainText;
    plainText += "\n\n" + assignees.map(a => `● ${a.name}: ${a.task}（期限: ${a.deadline || "-"}）`).join("\n");
  }

  const card = {
    type: "message",
    text: plainText,
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: bodyBlocks,
        msteams: { width: "Full" },
      },
    }],
  };

  try {
    // チャンネル通知
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

  } catch (e) {
    console.error("Teams通知エラー:", e.message);
  }
}

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

// ===== Webhook設定 =====
app.get("/api/settings/webhook", (req, res) => {
  const url = getWebhookUrl();
  res.json({ configured: !!url, masked: url ? url.slice(0, 30) + "..." : "" });
});

app.post("/api/settings/webhook", (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    try { fs.unlinkSync(WEBHOOK_PATH); } catch {}
    return res.json({ success: true, configured: false });
  }
  fs.writeFileSync(WEBHOOK_PATH, webhookUrl.trim());
  res.json({ success: true, configured: true });
});

app.post("/api/settings/webhook/test", async (req, res) => {
  const url = getWebhookUrl();
  if (!url) return res.status(400).json({ error: "Webhook URLが未設定です" });
  try {
    await sendTeamsNotify("テスト通知", "TaskFlowからのテスト通知です。正常に接続されています。", "4dab6f");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== ユーザー管理 =====
app.get("/api/users", (req, res) => {
  res.json(query("SELECT id, name, initial, role, department, webhook_url, email, created_at FROM users ORDER BY role DESC, name"));
});

app.post("/api/users", (req, res) => {
  const { name, initial, role, pin, department, email } = req.body;
  if (!name) return res.status(400).json({ error: "名前は必須です" });
  try {
    run("INSERT INTO users (name, initial, role, pin_hash, department, email) VALUES (?, ?, ?, ?, ?, ?)",
      [name.trim(), (initial || "").trim(), role || "member", hashPin(pin || "0000"), (department || "").trim(), (email || "").trim()]);
    const id = lastId();
    res.json({ id, name: name.trim(), initial: (initial || "").trim(), role: role || "member", department: (department || "").trim(), email: (email || "").trim() });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(400).json({ error: "その名前は既に登録されています" });
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/users/:id", (req, res) => {
  const id = Number(req.params.id);
  const allowed = ["name", "initial", "role", "department", "webhook_url", "email"];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: "更新するフィールドがありません" });
  values.push(id);
  run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
  const rows = query("SELECT id, name, initial, role, department, webhook_url, email FROM users WHERE id = ?", [id]);
  res.json(rows[0] || {});
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

  // Teams通知（担当者情報付き）
  const assignees = inserted.map(t => ({ name: t.assignee_name || "未割当", task: t.title, deadline: t.deadline || "-" }));
  const lines = inserted.map(t => `- ${t.title}（${t.assignee_name || "未割当"}${t.deadline ? " / 期限:" + t.deadline : ""}）`).join("\\n");
  sendTeamsNotify("議事録タスク割り当て", `${meetingTitle} から ${inserted.length}件のタスクが割り当てられました`, "2f80ed", assignees);

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

  const senderName = sender_id ? (query("SELECT name FROM users WHERE id = ?", [Number(sender_id)])[0]?.name || "") : "";
  sendTeamsNotify(
    "タスク送信",
    `${senderName || "管理者"} → ${assigneeName} にタスクを送信`,
    "fa9a3b",
    [{ name: assigneeName, task: title, deadline: deadline || "-" }]
  );

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
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN t.status != 'done' AND t.deadline != '' AND t.deadline <= date('now','localtime','+3 days') THEN 1 ELSE 0 END) as urgent
    FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
    WHERE u.role = 'member'
    GROUP BY u.id ORDER BY u.name
  `);
  const overdueRow = query(
    "SELECT COUNT(*) as c FROM tasks WHERE deadline != '' AND deadline < date('now','localtime') AND status != 'done'"
  );
  const overdue = overdueRow[0]?.c || 0;

  // 期限超過・期限間近のタスク
  const deadlineTasks = query(`
    SELECT t.*, u.name as assignee_display
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.deadline != '' AND t.status != 'done'
    ORDER BY t.deadline ASC
  `);

  res.json({ totalTasks, byStatus, byAssignee, overdue, deadlineTasks });
});

// 期限アラートをTeamsに手動送信
app.post("/api/notify/deadline", async (req, res) => {
  const url = getWebhookUrl();
  if (!url) return res.status(400).json({ error: "Webhook URLが未設定です" });

  const overdueTasks = query(`
    SELECT t.title, u.name as assignee_display, t.deadline
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.deadline != '' AND t.deadline < date('now','localtime') AND t.status != 'done'
    ORDER BY t.deadline ASC
  `);
  const soonTasks = query(`
    SELECT t.title, u.name as assignee_display, t.deadline
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.deadline != '' AND t.deadline >= date('now','localtime')
      AND t.deadline <= date('now','localtime','+2 days') AND t.status != 'done'
    ORDER BY t.deadline ASC
  `);

  if (!overdueTasks.length && !soonTasks.length) {
    return res.json({ success: true, message: "アラート対象のタスクはありません" });
  }

  const all = [
    ...overdueTasks.map(t => ({ name: t.assignee_display || "未割当", task: t.title, deadline: t.deadline, overdue: true })),
    ...soonTasks.map(t => ({ name: t.assignee_display || "未割当", task: t.title, deadline: t.deadline, overdue: false })),
  ];
  let msg = "";
  if (overdueTasks.length) msg += `期限超過: ${overdueTasks.length}件`;
  if (soonTasks.length) msg += `${msg ? " / " : ""}期限2日以内: ${soonTasks.length}件`;

  await sendTeamsNotify("期限アラート", msg, "eb5757", all);
  res.json({ success: true, overdue: overdueTasks.length, soon: soonTasks.length });
});

// ===== 案件管理 =====
const CASE_TYPES = ["FAX受電", "架電バイト", "ヒトキワ広告"];

app.get("/api/cases/next-no", (req, res) => {
  const rows = query("SELECT case_no FROM cases ORDER BY id DESC LIMIT 1");
  if (!rows.length) {
    const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "");
    return res.json({ case_no: `AK-${today}-001` });
  }
  const last = rows[0].case_no;
  const m = last.match(/(\d+)$/);
  if (m) {
    const prefix = last.slice(0, last.length - m[1].length);
    const next = String(Number(m[1]) + 1).padStart(m[1].length, "0");
    return res.json({ case_no: prefix + next });
  }
  res.json({ case_no: last + "-1" });
});

app.get("/api/cases/dashboard", (req, res) => {
  const total = query("SELECT COUNT(*) as c FROM cases")[0]?.c || 0;
  const active = query("SELECT COUNT(*) as c FROM cases WHERE status='active'")[0]?.c || 0;
  const interview = query("SELECT COUNT(*) as c FROM cases WHERE status='interview'")[0]?.c || 0;
  const cancel = query("SELECT COUNT(*) as c FROM cases WHERE status='cancel'")[0]?.c || 0;
  const byType = query("SELECT type, COUNT(*) as count FROM cases GROUP BY type ORDER BY type");
  const byMember = query(`
    SELECT u.id, u.name, u.initial,
      SUM(CASE WHEN c.type='FAX受電' THEN 1 ELSE 0 END) as fax_total,
      SUM(CASE WHEN c.type='FAX受電' AND c.status='interview' THEN 1 ELSE 0 END) as fax_interview,
      SUM(CASE WHEN c.type='FAX受電' AND c.status='cancel' THEN 1 ELSE 0 END) as fax_cancel,
      SUM(CASE WHEN c.type='架電バイト' THEN 1 ELSE 0 END) as kaden_total,
      SUM(CASE WHEN c.type='架電バイト' AND c.status='interview' THEN 1 ELSE 0 END) as kaden_interview,
      SUM(CASE WHEN c.type='架電バイト' AND c.status='cancel' THEN 1 ELSE 0 END) as kaden_cancel,
      SUM(CASE WHEN c.type='ヒトキワ広告' THEN 1 ELSE 0 END) as hitokiwa_total,
      SUM(CASE WHEN c.type='ヒトキワ広告' AND c.status='interview' THEN 1 ELSE 0 END) as hitokiwa_interview,
      SUM(CASE WHEN c.type='ヒトキワ広告' AND c.status='cancel' THEN 1 ELSE 0 END) as hitokiwa_cancel
    FROM users u LEFT JOIN cases c ON c.assignee_id = u.id
    WHERE u.role='member' AND u.department='営業'
    GROUP BY u.id ORDER BY u.name
  `);
  const upcoming = query(`
    SELECT c.*, u.name as assignee_display
    FROM cases c LEFT JOIN users u ON c.assignee_id = u.id
    WHERE c.status='active' AND c.interview_date != ''
    ORDER BY c.interview_date ASC LIMIT 10
  `);
  res.json({ total, active, interview, cancel, byType, byMember, upcoming });
});

app.get("/api/cases", (req, res) => {
  const { assignee_id, type, status, search } = req.query;
  let sql = `SELECT c.*, u.name as assignee_display
    FROM cases c LEFT JOIN users u ON c.assignee_id = u.id WHERE 1=1`;
  const params = [];
  if (assignee_id) { sql += " AND c.assignee_id = ?"; params.push(Number(assignee_id)); }
  if (type) { sql += " AND c.type = ?"; params.push(type); }
  if (status) { sql += " AND c.status = ?"; params.push(status); }
  if (search) { sql += " AND (c.case_no LIKE ? OR c.company_no LIKE ? OR c.description LIKE ? OR c.assignee_name LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  sql += " ORDER BY c.created_at DESC";
  res.json(query(sql, params));
});

app.post("/api/cases", (req, res) => {
  const { case_no, type, description, interview_date, assignee_id, company_no } = req.body;
  if (!case_no) return res.status(400).json({ error: "案件番号は必須です" });
  if (!type || !CASE_TYPES.includes(type)) return res.status(400).json({ error: "案件の種類が不正です" });
  let assigneeName = "";
  if (assignee_id) {
    const u = query("SELECT name FROM users WHERE id=?", [Number(assignee_id)]);
    assigneeName = u[0]?.name || "";
  }
  try {
    run("INSERT INTO cases (case_no,type,description,interview_date,assignee_id,assignee_name) VALUES (?,?,?,?,?,?)",
      [case_no.trim(), type, description||"", interview_date||"", assignee_id ? Number(assignee_id) : null, assigneeName]);
    const id = lastId();
    if (assigneeName) {
      sendTeamsNotify(
        "案件割り振り",
        `${assigneeName} に案件が割り振られました\n案件番号: ${case_no.trim()}\n種類: ${type}${description ? "\n内容: " + description : ""}`,
        "0078D7",
        [{ name: assigneeName, task: `${case_no.trim()} (${type})`, deadline: interview_date || "-" }]
      );
    }
    res.json({ id, case_no: case_no.trim(), type, description: description||"", interview_date: interview_date||"", assignee_id: assignee_id||null, assignee_name: assigneeName, status: "active" });
  } catch(e) {
    if (e.message.includes("UNIQUE")) return res.status(400).json({ error: "その案件番号は既に存在します" });
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/cases/:id", (req, res) => {
  const id = Number(req.params.id);
  const before = query("SELECT * FROM cases WHERE id=?", [id])[0] || {};
  const allowed = ["case_no","type","description","interview_date","assignee_id","assignee_name","status"];
  const fields = [], values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { fields.push(`${key}=?`); values.push(req.body[key]); }
  }
  let newAssigneeName = before.assignee_name || "";
  if (req.body.assignee_id !== undefined && req.body.assignee_name === undefined) {
    const aid = req.body.assignee_id;
    const u = aid ? query("SELECT name FROM users WHERE id=?", [Number(aid)]) : [];
    newAssigneeName = u[0]?.name || "";
    fields.push("assignee_name=?"); values.push(newAssigneeName);
  }
  if (!fields.length) return res.status(400).json({ error: "更新フィールドなし" });
  fields.push("updated_at=datetime('now','localtime')");
  values.push(id);
  run(`UPDATE cases SET ${fields.join(",")} WHERE id=?`, values);
  const rows = query("SELECT c.*, u.name as assignee_display FROM cases c LEFT JOIN users u ON c.assignee_id=u.id WHERE c.id=?", [id]);
  const updated = rows[0] || {};
  // 担当者が変わった場合にTeams通知
  const newAid = req.body.assignee_id !== undefined ? req.body.assignee_id : before.assignee_id;
  if (newAid && String(newAid) !== String(before.assignee_id) && newAssigneeName) {
    sendTeamsNotify(
      "案件割り振り",
      `${newAssigneeName} に案件が割り振られました\n案件番号: ${updated.case_no}\n種類: ${updated.type}${updated.description ? "\n内容: " + updated.description : ""}`,
      "0078D7",
      [{ name: newAssigneeName, task: `${updated.case_no} (${updated.type})`, deadline: updated.interview_date || "-" }]
    );
  }
  res.json(updated);
});

app.delete("/api/cases/:id", (req, res) => {
  run("DELETE FROM cases WHERE id=?", [Number(req.params.id)]);
  res.json({ success: true });
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

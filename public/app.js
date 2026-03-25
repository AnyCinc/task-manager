// ========== State ==========
let currentUser = null;
let allUsers = [];

// ========== API Helper ==========
async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "エラーが発生しました");
  return data;
}

// ========== ユーザー選択 ==========
const AVATAR_COLORS = [
  "#4f46e5","#7c3aed","#db2777","#ea580c","#0891b2","#059669","#d97706","#6366f1","#e11d48","#0d9488"
];

async function initUserPicker() {
  allUsers = await api("/users");
  const picker = document.getElementById("user-picker");
  picker.innerHTML = allUsers.map((u, i) => `
    <button class="user-pick-btn" data-user-id="${u.id}">
      <div class="pick-avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${esc(u.initial || u.name[0])}</div>
      <div class="pick-name">${esc(u.name)}</div>
      ${u.role === "admin" ? '<div class="pick-role">管理者</div>' : ""}
    </button>
  `).join("");

  picker.querySelectorAll(".user-pick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const userId = Number(btn.dataset.userId);
      currentUser = allUsers.find(u => u.id === userId);
      if (currentUser) showApp();
    });
  });
}

document.getElementById("logout-btn").addEventListener("click", () => {
  currentUser = null;
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
  initUserPicker();
});

function showApp() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  document.getElementById("current-user-name").textContent = currentUser.name;
  document.getElementById("current-user-role").textContent =
    currentUser.role === "admin" ? "管理者" : "メンバー";

  // 管理者メニュー表示制御
  document.querySelectorAll(".admin-only").forEach(el => {
    el.style.display = currentUser.role === "admin" ? "" : "none";
  });

  navigateTo("my-tasks");
}

// ========== Navigation ==========
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => navigateTo(item.dataset.page));
});

function navigateTo(page) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add("active");
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("page-" + page)?.classList.add("active");

  if (page === "my-tasks") loadMyTasks();
  else if (page === "board") loadBoard();
  else if (page === "send-task") loadSendTask();
  else if (page === "history") loadMeetings();
  else if (page === "dashboard") loadDashboard();
  else if (page === "members") loadMembers();
  else if (page === "settings") loadSettings();
}

// ========== マイタスク ==========
async function loadMyTasks() {
  if (!currentUser) return;
  const tasks = await api(`/tasks?assignee_id=${currentUser.id}`);
  const today = new Date().toISOString().split("T")[0];

  const urgent = tasks.filter(t =>
    t.status !== "done" && (t.priority === "high" || (t.deadline && t.deadline < today))
  );
  const inProgress = tasks.filter(t => t.status === "in_progress" && !urgent.includes(t));
  const todo = tasks.filter(t => t.status === "todo" && !urgent.includes(t));
  const done = tasks.filter(t => t.status === "done");

  renderTaskGrid("my-urgent", urgent);
  renderTaskGrid("my-in-progress", inProgress);
  renderTaskGrid("my-todo", todo);
  renderTaskGrid("my-done", done);

  document.getElementById("my-stats").innerHTML = `
    <span>全${tasks.length}件</span>
    <span>未着手 ${tasks.filter(t=>t.status==="todo").length}</span>
    <span>進行中 ${tasks.filter(t=>t.status==="in_progress").length}</span>
    <span>完了 ${done.length}</span>
  `;
}

function renderTaskGrid(containerId, tasks) {
  const el = document.getElementById(containerId);
  if (!tasks.length) {
    el.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;padding:8px">なし</div>';
    return;
  }
  el.innerHTML = tasks.map(t => taskCardHTML(t)).join("");
  el.querySelectorAll(".task-card").forEach((card, i) => {
    card.addEventListener("click", () => openEditModal(tasks[i]));
  });
}

function taskCardHTML(t) {
  const pl = { high: "🔴 高", medium: "🟡 中", low: "🟢 低" };
  const today = new Date().toISOString().split("T")[0];
  const overdue = t.deadline && t.deadline < today && t.status !== "done";
  const deadlineBadge = t.deadline
    ? `<span class="badge ${overdue ? "badge-overdue" : "badge-deadline"}">${esc(t.deadline)}</span>` : "";
  const name = t.assignee_display || t.assignee_name || "";

  return `<div class="task-card priority-${t.priority}">
    <div class="tc-title">${esc(t.title)}</div>
    ${t.description ? `<div class="tc-desc">${esc(t.description)}</div>` : ""}
    <div class="tc-meta">
      <span class="badge badge-${t.priority}">${pl[t.priority] || "中"}</span>
      ${name ? `<span class="badge badge-assignee">${esc(name)}</span>` : ""}
      ${deadlineBadge}
    </div>
  </div>`;
}

// ========== マイタスク追加 ==========
document.getElementById("add-my-task-btn").addEventListener("click", () => {
  document.getElementById("add-task-title").value = "";
  document.getElementById("add-task-description").value = "";
  document.getElementById("add-task-deadline").value = "";
  document.getElementById("add-task-priority").value = "medium";
  document.getElementById("add-task-msg").classList.add("hidden");
  document.getElementById("add-task-modal").classList.remove("hidden");
});

document.getElementById("add-task-cancel").addEventListener("click", () => {
  document.getElementById("add-task-modal").classList.add("hidden");
});

document.getElementById("add-task-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.target.classList.add("hidden");
});

// Enterキーで保存されないようにする（モーダル全体で捕捉）
document.getElementById("add-task-modal").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

document.getElementById("add-task-save").addEventListener("click", async () => {
  const title = document.getElementById("add-task-title").value.trim();
  const msg = document.getElementById("add-task-msg");

  if (!title) { alert("タスク名を入力してください"); return; }
  if (!confirm("このタスクを追加しますか？")) return;

  try {
    await api("/tasks/send", {
      method: "POST",
      body: {
        title,
        description: document.getElementById("add-task-description").value.trim(),
        assignee_id: currentUser.id,
        deadline: document.getElementById("add-task-deadline").value,
        priority: document.getElementById("add-task-priority").value,
        sender_id: currentUser.id,
      },
    });
    document.getElementById("add-task-modal").classList.add("hidden");
    loadMyTasks();
  } catch (e) {
    msg.textContent = e.message;
    msg.style.color = "var(--danger)";
    msg.classList.remove("hidden");
  }
});

// ========== タスクボード ==========
async function loadBoard() {
  const params = new URLSearchParams();
  const priority = document.getElementById("filter-priority").value;
  const assigneeId = document.getElementById("filter-assignee").value;
  const search = document.getElementById("search-input").value.trim();
  if (priority) params.set("priority", priority);
  if (assigneeId) params.set("assignee_id", assigneeId);
  if (search) params.set("search", search);

  const tasks = await api("/tasks?" + params.toString());

  // 担当者フィルタを更新
  await updateAssigneeFilter();

  for (const col of ["todo", "in_progress", "done"]) {
    const list = document.getElementById(`${col}-tasks`);
    const colTasks = tasks.filter(t => t.status === col);
    document.getElementById(`count-${col}`).textContent = colTasks.length;
    list.innerHTML = colTasks.map(t => taskCardHTML(t)).join("");
    list.querySelectorAll(".task-card").forEach((card, i) => {
      card.addEventListener("click", () => openEditModal(colTasks[i]));
    });
  }
}

async function updateAssigneeFilter() {
  const users = await api("/users");
  allUsers = users;
  const select = document.getElementById("filter-assignee");
  const current = select.value;
  select.innerHTML = '<option value="">全ての担当者</option>' +
    users.filter(u => u.role === "member").map(u =>
      `<option value="${u.id}">${esc(u.name)}</option>`
    ).join("");
  select.value = current;

  // 編集モーダルの担当者も更新
  const editSelect = document.getElementById("edit-assignee");
  editSelect.innerHTML = '<option value="">未割当</option>' +
    users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
}

document.getElementById("filter-priority").addEventListener("change", loadBoard);
document.getElementById("filter-assignee").addEventListener("change", loadBoard);
let searchTimeout;
document.getElementById("search-input").addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadBoard, 300);
});

// ========== 議事録入力 → 割り振りフロー ==========
let pendingTasks = []; // 抽出後・確定前のタスク
let pendingMeetingTitle = "";
let pendingMeetingContent = "";

document.getElementById("extract-btn").addEventListener("click", async () => {
  const content = document.getElementById("meeting-content").value.trim();
  if (!content) { alert("議事録の内容を入力してください"); return; }

  const btn = document.getElementById("extract-btn");
  const loading = document.getElementById("extract-loading");
  const errorEl = document.getElementById("extract-error");
  const assignPanel = document.getElementById("assign-panel");
  const assignDone = document.getElementById("assign-done");

  btn.disabled = true;
  loading.classList.remove("hidden");
  errorEl.classList.add("hidden");
  assignPanel.classList.add("hidden");
  assignDone.classList.add("hidden");

  try {
    const data = await api("/extract", { method: "POST", body: { content } });
    pendingTasks = data.tasks;
    pendingMeetingTitle = document.getElementById("meeting-title").value.trim();
    pendingMeetingContent = content;

    document.getElementById("task-count").textContent = data.tasks.length;
    renderAssignPanel(data.tasks, data.members);
    assignPanel.classList.remove("hidden");
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    loading.classList.add("hidden");
  }
});

function renderAssignPanel(tasks, members) {
  const container = document.getElementById("assign-tasks");
  container.innerHTML = tasks.map((t, i) => `
    <div class="assign-card" data-idx="${i}">
      <div class="ac-title">${esc(t.title)}</div>
      ${t.description ? `<div class="ac-desc">${esc(t.description)}</div>` : ""}
      <div class="ac-fields">
        <select class="assign-member" data-idx="${i}">
          <option value="">-- 担当者 --</option>
          ${allUsers.filter(u => u.role === "member").map(u =>
            `<option value="${u.id}" ${t.assignee_id === u.id ? "selected" : ""}>${esc(u.name)}</option>`
          ).join("")}
        </select>
        <select class="assign-priority" data-idx="${i}">
          <option value="high" ${t.priority==="high"?"selected":""}>🔴 高</option>
          <option value="medium" ${t.priority==="medium"?"selected":""}>🟡 中</option>
          <option value="low" ${t.priority==="low"?"selected":""}>🟢 低</option>
        </select>
        <input type="date" class="assign-deadline" data-idx="${i}" value="${t.deadline || ""}" />
      </div>
    </div>
  `).join("");
}

document.getElementById("assign-back-btn").addEventListener("click", () => {
  document.getElementById("assign-panel").classList.add("hidden");
});

document.getElementById("assign-confirm-btn").addEventListener("click", async () => {
  // 各カードから値を収集
  const cards = document.querySelectorAll(".assign-card");
  const tasks = [];
  cards.forEach((card, i) => {
    const assigneeId = card.querySelector(".assign-member").value;
    const assignee = allUsers.find(u => u.id === Number(assigneeId));
    tasks.push({
      title: pendingTasks[i].title,
      description: pendingTasks[i].description,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      assignee_name: assignee ? assignee.name : "",
      priority: card.querySelector(".assign-priority").value,
      deadline: card.querySelector(".assign-deadline").value,
    });
  });

  try {
    await api("/tasks/bulk", {
      method: "POST",
      body: {
        title: pendingMeetingTitle,
        content: pendingMeetingContent,
        userId: currentUser?.id,
        tasks,
      },
    });

    document.getElementById("assign-panel").classList.add("hidden");
    document.getElementById("assign-done").classList.remove("hidden");
    document.getElementById("meeting-title").value = "";
    document.getElementById("meeting-content").value = "";
    pendingTasks = [];
  } catch (err) {
    alert("エラー: " + err.message);
  }
});

document.getElementById("done-board-btn").addEventListener("click", () => navigateTo("board"));
document.getElementById("done-new-btn").addEventListener("click", () => {
  document.getElementById("assign-done").classList.add("hidden");
});

// ========== タスクを送る ==========
function loadSendTask() {
  const select = document.getElementById("send-assignee");
  select.innerHTML = '<option value="">-- 送り先を選択 --</option>' +
    allUsers.filter(u => u.role === "member").map(u =>
      `<option value="${u.id}">${esc(u.name)}</option>`
    ).join("");
  document.getElementById("send-msg").classList.add("hidden");
}

document.getElementById("send-task-btn").addEventListener("click", async () => {
  const assigneeId = document.getElementById("send-assignee").value;
  const title = document.getElementById("send-title").value.trim();
  const msg = document.getElementById("send-msg");

  if (!assigneeId) { alert("送り先を選んでください"); return; }
  if (!title) { alert("タスク名を入力してください"); return; }

  try {
    const data = await api("/tasks/send", {
      method: "POST",
      body: {
        title,
        description: document.getElementById("send-description").value.trim(),
        assignee_id: Number(assigneeId),
        deadline: document.getElementById("send-deadline").value,
        priority: document.getElementById("send-priority").value,
        sender_id: currentUser?.id,
      },
    });
    msg.textContent = `✅ ${data.assignee_name} にタスク「${data.title}」を送りました`;
    msg.style.color = "var(--success)";
    msg.classList.remove("hidden");

    // フォームリセット
    document.getElementById("send-title").value = "";
    document.getElementById("send-description").value = "";
    document.getElementById("send-deadline").value = "";
    document.getElementById("send-priority").value = "medium";
  } catch (e) {
    msg.textContent = e.message;
    msg.style.color = "var(--danger)";
    msg.classList.remove("hidden");
  }
});

// ========== 議事録履歴 ==========
async function loadMeetings() {
  const meetings = await api("/meetings");
  const container = document.getElementById("meetings-list");
  if (!meetings.length) {
    container.innerHTML = '<div class="empty-state">まだ議事録がありません</div>';
    return;
  }
  container.innerHTML = meetings.map(m => `
    <div class="meeting-card" onclick="this.classList.toggle('expanded')">
      <h3>${esc(m.title)}</h3>
      <div class="mm-meta">${esc(m.created_at)}${m.created_by_name ? " ・ " + esc(m.created_by_name) : ""} ・ タスク${m.task_count}件</div>
      <div class="mm-content">${esc(m.content)}</div>
    </div>
  `).join("");
}

// ========== ダッシュボード ==========
async function loadDashboard() {
  const data = await api("/dashboard");
  const statusMap = {};
  data.byStatus.forEach(s => statusMap[s.status] = s.count);

  document.getElementById("dashboard-stats").innerHTML = `
    <div class="stat-card stat-primary">
      <div class="stat-num">${data.totalTasks}</div>
      <div class="stat-label">全タスク</div>
    </div>
    <div class="stat-card stat-primary">
      <div class="stat-num">${statusMap.todo || 0}</div>
      <div class="stat-label">未着手</div>
    </div>
    <div class="stat-card stat-warning">
      <div class="stat-num">${statusMap.in_progress || 0}</div>
      <div class="stat-label">進行中</div>
    </div>
    <div class="stat-card stat-success">
      <div class="stat-num">${statusMap.done || 0}</div>
      <div class="stat-label">完了</div>
    </div>
    <div class="stat-card stat-danger">
      <div class="stat-num">${data.overdue}</div>
      <div class="stat-label">期限超過</div>
    </div>
  `;

  const container = document.getElementById("member-progress");
  if (!data.byAssignee.length) {
    container.innerHTML = '<div class="empty-state">メンバーがいません</div>';
    return;
  }
  container.innerHTML = data.byAssignee.map(m => {
    const total = m.total || 1;
    const doneW = (m.done / total * 100).toFixed(1);
    const progW = (m.in_progress / total * 100).toFixed(1);
    const todoW = (m.todo / total * 100).toFixed(1);
    return `<div class="member-row">
      <div class="mr-name">${esc(m.name)}</div>
      <div class="progress-bar">
        <div class="pb-done" style="width:${doneW}%" title="完了 ${m.done}"></div>
        <div class="pb-progress" style="width:${progW}%" title="進行中 ${m.in_progress}"></div>
        <div class="pb-todo" style="width:${todoW}%" title="未着手 ${m.todo}"></div>
      </div>
      <div class="mr-count">${m.done}/${m.total} 完了</div>
    </div>`;
  }).join("");
}

// ========== メンバー管理 ==========
async function loadMembers() {
  const users = await api("/users");
  allUsers = users;
  document.getElementById("members-list").innerHTML = users.map(u => `
    <div class="member-card">
      <div class="mc-info">
        <div class="mc-avatar">${esc(u.initial || u.name[0])}</div>
        <div>
          <div class="mc-name">${esc(u.name)}</div>
          <div class="mc-role">${u.role === "admin" ? "管理者" : "メンバー"}</div>
        </div>
      </div>
      ${u.role !== "admin" || users.filter(x=>x.role==="admin").length > 1
        ? `<button class="btn-icon-sm" onclick="deleteMember(${u.id}, '${esc(u.name)}')">🗑</button>` : ""}
    </div>
  `).join("");
}

document.getElementById("add-member-btn").addEventListener("click", () => {
  document.getElementById("new-member-name").value = "";
  document.getElementById("new-member-initial").value = "";
  document.getElementById("new-member-role").value = "member";
  document.getElementById("member-modal").classList.remove("hidden");
});

document.getElementById("member-save-btn").addEventListener("click", async () => {
  const name = document.getElementById("new-member-name").value.trim();
  const initial = document.getElementById("new-member-initial").value.trim();
  const role = document.getElementById("new-member-role").value;
  if (!name) { alert("名前を入力してください"); return; }
  try {
    await api("/users", { method: "POST", body: { name, initial, role } });
    document.getElementById("member-modal").classList.add("hidden");
    loadMembers();
  } catch (e) { alert(e.message); }
});

window.deleteMember = async function(id, name) {
  if (!confirm(`${name} を削除しますか？`)) return;
  await api(`/users/${id}`, { method: "DELETE" });
  loadMembers();
};

// モーダル背景クリックで閉じる
document.getElementById("member-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.target.classList.add("hidden");
});

// ========== タスク編集モーダル ==========
function openEditModal(task) {
  document.getElementById("edit-id").value = task.id;
  document.getElementById("edit-title").value = task.title;
  document.getElementById("edit-description").value = task.description || "";
  document.getElementById("edit-deadline").value = task.deadline || "";
  document.getElementById("edit-priority").value = task.priority;
  document.getElementById("edit-status").value = task.status;

  // 担当者セレクト更新
  const editSelect = document.getElementById("edit-assignee");
  editSelect.innerHTML = '<option value="">未割当</option>' +
    allUsers.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("");
  editSelect.value = task.assignee_id || "";

  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.target.classList.add("hidden");
});

document.getElementById("modal-save").addEventListener("click", async () => {
  const id = document.getElementById("edit-id").value;
  const assigneeId = document.getElementById("edit-assignee").value;
  const assignee = allUsers.find(u => u.id === Number(assigneeId));

  await api(`/tasks/${id}`, {
    method: "PATCH",
    body: {
      title: document.getElementById("edit-title").value,
      description: document.getElementById("edit-description").value,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      assignee_name: assignee ? assignee.name : "",
      deadline: document.getElementById("edit-deadline").value,
      priority: document.getElementById("edit-priority").value,
      status: document.getElementById("edit-status").value,
    },
  });
  document.getElementById("modal-overlay").classList.add("hidden");
  refreshCurrentPage();
});

document.getElementById("modal-delete").addEventListener("click", async () => {
  if (!confirm("このタスクを削除しますか？")) return;
  const id = document.getElementById("edit-id").value;
  await api(`/tasks/${id}`, { method: "DELETE" });
  document.getElementById("modal-overlay").classList.add("hidden");
  refreshCurrentPage();
});

function refreshCurrentPage() {
  const active = document.querySelector(".nav-item.active");
  if (active) navigateTo(active.dataset.page);
}

// ========== API設定 ==========
async function loadSettings() {
  const data = await api("/settings/apikey");
  const statusEl = document.getElementById("apikey-status");
  if (data.configured) {
    statusEl.innerHTML = `<span style="color:var(--success);font-weight:600">設定済み: ${esc(data.masked)}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:var(--danger);font-weight:600">未設定 — 議事録抽出が使えません</span>`;
  }
}

document.getElementById("apikey-save-btn").addEventListener("click", async () => {
  const key = document.getElementById("apikey-input").value.trim();
  const msg = document.getElementById("apikey-msg");
  try {
    await api("/settings/apikey", { method: "POST", body: { apiKey: key } });
    msg.textContent = "保存しました";
    msg.style.color = "var(--success)";
    msg.classList.remove("hidden");
    document.getElementById("apikey-input").value = "";
    loadSettings();
  } catch (e) {
    msg.textContent = e.message;
    msg.style.color = "var(--danger)";
    msg.classList.remove("hidden");
  }
});

// ========== ユーティリティ ==========
function esc(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ========== 初期化 ==========
initUserPicker();

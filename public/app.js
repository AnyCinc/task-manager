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
      const user = allUsers.find(u => u.id === userId);
      if (!user) return;

      if (user.role === "admin") {
        // 管理者はパスワード入力が必要
        pendingAdminUser = user;
        document.getElementById("admin-pw-input").value = "";
        document.getElementById("admin-pw-error").classList.add("hidden");
        document.getElementById("admin-pw-modal").classList.remove("hidden");
        document.getElementById("admin-pw-input").focus();
      } else {
        currentUser = user;
        showApp();
      }
    });
  });
}

let pendingAdminUser = null;

document.getElementById("admin-pw-submit").addEventListener("click", async () => {
  const pin = document.getElementById("admin-pw-input").value;
  const errEl = document.getElementById("admin-pw-error");
  try {
    const data = await api("/login", { method: "POST", body: { name: pendingAdminUser.name, pin } });
    currentUser = data;
    document.getElementById("admin-pw-modal").classList.add("hidden");
    showApp();
  } catch (e) {
    errEl.textContent = "パスワードが正しくありません";
    errEl.classList.remove("hidden");
  }
});

document.getElementById("admin-pw-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("admin-pw-submit").click();
});

document.getElementById("admin-pw-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.target.classList.add("hidden");
});

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

  // 案件管理は営業または管理者のみ表示
  const canSeeCases = currentUser.role === "admin" || currentUser.department === "営業";
  document.querySelectorAll(".cases-only").forEach(el => {
    el.style.display = canSeeCases ? "" : "none";
  });

  navigateTo(canSeeCases ? "cases-dashboard" : "my-tasks");
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

  if (page === "cases-dashboard") loadCasesDashboard();
  else if (page === "cases-list") loadCasesList();
  else if (page === "cases-add") initAddCase();
  else if (page === "my-tasks") loadMyTasks();
  else if (page === "board") loadBoard();
  else if (page === "send-task") loadSendTask();
  else if (page === "history") loadMeetings();
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
  const inProgress = tasks.filter(t => t.status === "in_progress");
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
  const pl = { high: "高", medium: "中", low: "低" };
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

  // 管理者: 統計+期限アラートをボード上部に表示
  if (currentUser && currentUser.role === "admin") {
    const data = await api("/dashboard");
    const statusMap = {};
    data.byStatus.forEach(s => statusMap[s.status] = s.count);
    document.getElementById("board-stats").innerHTML = `
      <div class="stat-card stat-primary"><div class="stat-num">${data.totalTasks}</div><div class="stat-label">全タスク</div></div>
      <div class="stat-card stat-primary"><div class="stat-num">${statusMap.todo || 0}</div><div class="stat-label">未着手</div></div>
      <div class="stat-card stat-warning"><div class="stat-num">${statusMap.in_progress || 0}</div><div class="stat-label">進行中</div></div>
      <div class="stat-card stat-success"><div class="stat-num">${statusMap.done || 0}</div><div class="stat-label">完了</div></div>
      <div class="stat-card stat-danger"><div class="stat-num">${data.overdue}</div><div class="stat-label">期限超過</div></div>
    `;
    // 期日超過・2日前
    const dlEl = document.getElementById("board-deadline-list");
    if (data.deadlineTasks && data.deadlineTasks.length) {
      const todayS = new Date().toISOString().split("T")[0];
      const twoS = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];
      const filtered = data.deadlineTasks.filter(t => t.deadline <= twoS);
      if (filtered.length) {
        dlEl.innerHTML = `<h3 style="margin:12px 0 8px;font-size:0.9rem;font-weight:600">期日超過・期日2日前</h3>
          <div class="dash-dl-table">
          <div class="dash-dl-header"><span>タスク</span><span>担当者</span><span>期日</span><span>状態</span></div>
          ${filtered.map(t => {
            const isOver = t.deadline < todayS;
            return `<div class="dash-dl-row ${isOver ? 'dash-dl-over' : 'dash-dl-soon'}">
              <span>${esc(t.title)}</span>
              <span>${esc(t.assignee_display || t.assignee_name || "未割当")}</span>
              <span class="dash-dl-date">${esc(t.deadline)}</span>
              <span class="dash-dl-tag ${isOver ? 'tag-over' : 'tag-soon'}">${isOver ? '超過' : '2日以内'}</span>
            </div>`;
          }).join("")}
        </div>`;
      } else {
        dlEl.innerHTML = "";
      }
    } else {
      dlEl.innerHTML = "";
    }
  }

  if (boardView === "member") {
    renderMemberBoard(tasks);
  } else {
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
}

let boardView = "member"; // "status" or "member"

document.getElementById("view-status").addEventListener("click", () => {
  boardView = "status";
  document.getElementById("view-status").classList.add("active");
  document.getElementById("view-member").classList.remove("active");
  document.getElementById("board-status-view").classList.remove("hidden");
  document.getElementById("board-member-view").classList.add("hidden");
  loadBoard();
});
document.getElementById("view-member").addEventListener("click", () => {
  boardView = "member";
  document.getElementById("view-member").classList.add("active");
  document.getElementById("view-status").classList.remove("active");
  document.getElementById("board-status-view").classList.add("hidden");
  document.getElementById("board-member-view").classList.remove("hidden");
  loadBoard();
});

function renderMemberBoard(tasks) {
  const container = document.getElementById("board-member-view");
  const members = allUsers.filter(u => u.role === "member");
  const priLabel = { high: "高", medium: "中", low: "低" };
  const priClass = { high: "badge-high", medium: "badge-mid", low: "badge-low" };

  const today = new Date(); today.setHours(0,0,0,0);
  const soon = new Date(today.getTime() + 3 * 86400000);
  const todayStr = today.toISOString().split("T")[0];
  const soonStr = soon.toISOString().split("T")[0];

  function deadlineTag(t) {
    if (!t.deadline || t.status === "done") return "";
    if (t.deadline < todayStr) return '<span class="mb-dl mb-dl-over">超過</span>';
    if (t.deadline <= soonStr) return '<span class="mb-dl mb-dl-soon">3日以内</span>';
    return "";
  }

  // 未割当タスク用の仮メンバーを末尾に追加
  const unassigned = { id: null, name: "未割当", department: "", _unassigned: true };
  const allSlots = [...members, unassigned];

  container.innerHTML = allSlots.map(m => {
    const mTasks = m._unassigned
      ? tasks.filter(t => !t.assignee_id)
      : tasks.filter(t => t.assignee_id === m.id);
    const todo = mTasks.filter(t => t.status === "todo");
    const prog = mTasks.filter(t => t.status === "in_progress");
    const done = mTasks.filter(t => t.status === "done");
    const urgent = mTasks.filter(t => t.status !== "done" && t.deadline && t.deadline <= soonStr);
    const sorted = [...todo, ...prog, ...done];
    return `<div class="mb-card${urgent.length ? ' mb-card-urgent' : ''}">
      <div class="mb-card-header">
        <div>
          <strong>${esc(m.name)}</strong>${m.department ? ` <small style="color:var(--text-secondary);font-weight:400">${esc(m.department)}</small>` : ""}
        </div>
        <div class="mb-counts">
          <span class="mb-count">${mTasks.length}件</span>
          ${urgent.length ? `<span class="mb-urgent-badge">${urgent.length}件期限迫</span>` : ""}
          <span class="mb-breakdown">
            <span style="color:var(--blue)">${todo.length}未</span>
            <span style="color:var(--orange)">${prog.length}中</span>
            <span style="color:var(--green)">${done.length}済</span>
          </span>
        </div>
      </div>
      ${sorted.length ? `<div class="mb-task-list">
        ${sorted.map(t => `<div class="mb-task-item${!t.deadline ? '' : t.deadline < todayStr && t.status !== 'done' ? ' mb-item-over' : t.deadline <= soonStr && t.status !== 'done' ? ' mb-item-soon' : ''}" data-task-id="${t.id}">
          <span class="mb-task-dot s-${t.status}"></span>
          <span class="mb-task-title${t.status === 'done' ? ' mb-done' : ''}">${esc(t.title)}</span>
          ${deadlineTag(t)}
          <span class="mb-task-pri ${priClass[t.priority] || ''}">${priLabel[t.priority] || ""}</span>
        </div>`).join("")}
      </div>` : '<div class="mb-empty">タスクなし</div>'}
    </div>`;
  }).join("");

  // クリックでタスク編集
  container.querySelectorAll(".mb-task-item").forEach(item => {
    item.addEventListener("click", () => {
      const taskId = Number(item.dataset.taskId);
      const task = tasks.find(t => t.id === taskId);
      if (task) openEditModal(task);
    });
  });
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
  const mbrs = allUsers.filter(u => u.role === "member");
  const depts = [...new Set(mbrs.map(u => u.department || "").filter(Boolean))];

  // 部署グループ付きoptions生成
  function memberOptions(selectedId) {
    let html = '<option value="">-- 担当者 --</option>';
    if (depts.length) {
      for (const d of depts) {
        html += `<optgroup label="${esc(d)}">`;
        mbrs.filter(u => (u.department || "") === d).forEach(u => {
          html += `<option value="${u.id}" ${u.id === selectedId ? "selected" : ""}>${esc(u.name)}</option>`;
        });
        html += '</optgroup>';
      }
      const noDept = mbrs.filter(u => !(u.department));
      if (noDept.length) {
        html += '<optgroup label="未設定">';
        noDept.forEach(u => {
          html += `<option value="${u.id}" ${u.id === selectedId ? "selected" : ""}>${esc(u.name)}</option>`;
        });
        html += '</optgroup>';
      }
    } else {
      mbrs.forEach(u => {
        html += `<option value="${u.id}" ${u.id === selectedId ? "selected" : ""}>${esc(u.name)}</option>`;
      });
    }
    return html;
  }

  const container = document.getElementById("assign-tasks");
  container.innerHTML = tasks.map((t, i) => `
    <div class="assign-card" data-idx="${i}">
      <div class="ac-title">${esc(t.title)}</div>
      ${t.description ? `<div class="ac-desc">${esc(t.description)}</div>` : ""}
      <div class="ac-fields">
        <select class="assign-member" data-idx="${i}">
          ${memberOptions(t.assignee_id)}
        </select>
        <select class="assign-priority" data-idx="${i}">
          <option value="high" ${t.priority==="high"?"selected":""}>高</option>
          <option value="medium" ${t.priority==="medium"?"selected":""}>中</option>
          <option value="low" ${t.priority==="low"?"selected":""}>低</option>
        </select>
        <input type="date" class="assign-deadline" data-idx="${i}" value="${t.deadline || ""}" />
      </div>
    </div>
  `).join("");

  // 一括割り振りバー
  const bar = document.getElementById("assign-bulk-bar");
  bar.innerHTML = `
    <button type="button" data-dept="__all__">全員に割り振り</button>
    ${depts.map(d => `<button type="button" data-dept="${esc(d)}">${esc(d)}全員</button>`).join("")}
    <button type="button" data-dept="__clear__">担当クリア</button>
  `;
  bar.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const dept = btn.dataset.dept;
      const selects = document.querySelectorAll(".assign-member");
      if (dept === "__clear__") {
        selects.forEach(s => s.value = "");
        return;
      }
      // 対象メンバーのIDリスト
      const targetIds = dept === "__all__"
        ? mbrs.map(u => u.id)
        : mbrs.filter(u => (u.department || "") === dept).map(u => u.id);
      if (!targetIds.length) return;
      // ラウンドロビンで割り振り
      selects.forEach((s, i) => {
        s.value = String(targetIds[i % targetIds.length]);
      });
    });
  });
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
function buildDeptBar(containerId, checklistId) {
  const members = allUsers.filter(u => u.role === "member");
  const depts = [...new Set(members.map(u => u.department || "").filter(Boolean))];
  const bar = document.getElementById(containerId);
  bar.innerHTML = `
    <button type="button" data-dept="__all__">全員選択</button>
    ${depts.map(d => `<button type="button" data-dept="${esc(d)}">${esc(d)}</button>`).join("")}
    <button type="button" data-dept="__none__">全解除</button>
  `;
  bar.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const dept = btn.dataset.dept;
      const cbs = document.querySelectorAll(`#${checklistId} input[type=checkbox]`);
      if (dept === "__all__") {
        cbs.forEach(cb => cb.checked = true);
      } else if (dept === "__none__") {
        cbs.forEach(cb => cb.checked = false);
      } else {
        // 部署メンバーだけをトグル
        const ids = members.filter(u => (u.department || "") === dept).map(u => String(u.id));
        const allChecked = ids.every(id => {
          const cb = document.querySelector(`#${checklistId} input[value="${id}"]`);
          return cb && cb.checked;
        });
        cbs.forEach(cb => {
          if (ids.includes(cb.value)) cb.checked = !allChecked;
        });
      }
    });
  });
}

function loadSendTask() {
  const members = allUsers.filter(u => u.role === "member");
  const list = document.getElementById("send-assignee-list");
  list.innerHTML = members.map(u =>
    `<label><input type="checkbox" value="${u.id}" /><span>${esc(u.name)}${u.department ? ' <small style="color:var(--text-secondary)">(' + esc(u.department) + ')</small>' : ''}</span></label>`
  ).join("");
  buildDeptBar("send-dept-bar", "send-assignee-list");
  document.getElementById("send-msg").classList.add("hidden");
}

document.getElementById("send-task-btn").addEventListener("click", async () => {
  const checked = [...document.querySelectorAll("#send-assignee-list input:checked")];
  const assigneeIds = checked.map(cb => Number(cb.value));
  const title = document.getElementById("send-title").value.trim();
  const msg = document.getElementById("send-msg");

  if (!assigneeIds.length) { alert("送り先を選んでください"); return; }
  if (!title) { alert("タスク名を入力してください"); return; }

  try {
    const names = [];
    for (const assigneeId of assigneeIds) {
      const data = await api("/tasks/send", {
        method: "POST",
        body: {
          title,
          description: document.getElementById("send-description").value.trim(),
          assignee_id: assigneeId,
          deadline: document.getElementById("send-deadline").value,
          priority: document.getElementById("send-priority").value,
          sender_id: currentUser?.id,
        },
      });
      names.push(data.assignee_name);
    }
    msg.textContent = `${names.join("、")} にタスク「${title}」を送りました`;
    msg.style.color = "var(--success)";
    msg.classList.remove("hidden");

    // フォームリセット
    document.getElementById("send-title").value = "";
    document.getElementById("send-description").value = "";
    document.getElementById("send-deadline").value = "";
    document.getElementById("send-priority").value = "medium";
    document.querySelectorAll("#send-assignee-list input:checked").forEach(cb => cb.checked = false);
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


// ========== メンバー管理 ==========
async function loadMembers() {
  const users = await api("/users");
  allUsers = users;
  const DEPTS = ["", "営業", "事務", "マーケティング", "人事"];
  document.getElementById("members-list").innerHTML = users.map(u => `
    <div class="member-card">
      <div class="mc-info">
        <div class="mc-avatar">${esc(u.initial || u.name[0])}</div>
        <div>
          <div class="mc-name">${esc(u.name)}</div>
          <div class="mc-role">${u.role === "admin" ? "管理者" : "メンバー"}</div>
        </div>
      </div>
      <div class="mc-actions">
        <select class="input input-sm dept-select" data-user-id="${u.id}" ${u.role === "admin" ? "disabled" : ""}>
          ${DEPTS.map(d => `<option value="${d}" ${(u.department || "") === d ? "selected" : ""}>${d || "未設定"}</option>`).join("")}
        </select>
        ${u.role !== "admin" || users.filter(x=>x.role==="admin").length > 1
          ? `<button class="btn-icon-sm" onclick="deleteMember(${u.id}, '${esc(u.name)}')">削除</button>` : ""}
      </div>
      <div class="mc-email">
        <input type="email" class="input input-sm email-input" data-user-id="${u.id}"
          placeholder="Teams メール" value="${esc(u.email || "")}" />
        <button class="btn-icon-sm email-save" data-user-id="${u.id}">${u.email ? '✓' : '保存'}</button>
      </div>
    </div>
  `).join("");

  // 部署変更ハンドラー
  document.querySelectorAll(".dept-select").forEach(sel => {
    sel.addEventListener("change", async () => {
      const userId = sel.dataset.userId;
      await api(`/users/${userId}`, { method: "PATCH", body: { department: sel.value } });
      allUsers = await api("/users");
    });
  });

  // メール保存
  document.querySelectorAll(".email-save").forEach(btn => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.userId;
      const input = document.querySelector(`.email-input[data-user-id="${userId}"]`);
      await api(`/users/${userId}`, { method: "PATCH", body: { email: input.value.trim() } });
      btn.textContent = "✓";
      setTimeout(() => { btn.textContent = "保存"; }, 2000);
    });
  });
}

document.getElementById("add-member-btn").addEventListener("click", () => {
  document.getElementById("new-member-name").value = "";
  document.getElementById("new-member-initial").value = "";
  document.getElementById("new-member-dept").value = "";
  document.getElementById("new-member-email").value = "";
  document.getElementById("new-member-role").value = "member";
  document.getElementById("member-modal").classList.remove("hidden");
});

document.getElementById("member-save-btn").addEventListener("click", async () => {
  const name = document.getElementById("new-member-name").value.trim();
  const initial = document.getElementById("new-member-initial").value.trim();
  const department = document.getElementById("new-member-dept").value;
  const email = document.getElementById("new-member-email").value.trim();
  const role = document.getElementById("new-member-role").value;
  if (!name) { alert("名前を入力してください"); return; }
  try {
    await api("/users", { method: "POST", body: { name, initial, role, department, email } });
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

  // 担当者チェックボックスリスト
  const members = allUsers.filter(u => u.role === "member");
  const list = document.getElementById("edit-assignee-list");
  list.innerHTML = members.map(u =>
    `<label><input type="checkbox" value="${u.id}" ${task.assignee_id === u.id ? "checked" : ""} /><span>${esc(u.name)}${u.department ? ' <small>(' + esc(u.department) + ')</small>' : ''}</span></label>`
  ).join("");

  // 部署ボタンバー
  buildDeptBar("edit-dept-bar", "edit-assignee-list");

  // ヒント
  const hint = document.getElementById("edit-assignee-hint");
  function updateHint() {
    const cnt = list.querySelectorAll("input:checked").length;
    if (cnt > 1) {
      hint.textContent = `${cnt}人選択中 — 保存すると選択メンバー全員にタスクが割り振られます`;
      hint.classList.remove("hidden");
    } else {
      hint.classList.add("hidden");
    }
  }
  list.addEventListener("change", updateHint);
  updateHint();

  // 権限制御: 削除は管理者のみ
  const isAdmin = currentUser && currentUser.role === "admin";
  document.getElementById("modal-delete").style.display = isAdmin ? "" : "none";

  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.target.classList.add("hidden");
});

document.getElementById("modal-save").addEventListener("click", async () => {
  const id = document.getElementById("edit-id").value;
  const checked = [...document.querySelectorAll("#edit-assignee-list input:checked")];
  const assigneeIds = checked.map(cb => Number(cb.value));
  const title = document.getElementById("edit-title").value;
  const description = document.getElementById("edit-description").value;
  const deadline = document.getElementById("edit-deadline").value;
  const priority = document.getElementById("edit-priority").value;
  const status = document.getElementById("edit-status").value;

  if (assigneeIds.length === 0) {
    // 未割当
    await api(`/tasks/${id}`, {
      method: "PATCH",
      body: { title, description, assignee_id: null, assignee_name: "", deadline, priority, status },
    });
  } else if (assigneeIds.length === 1) {
    // 1人だけ → 通常更新
    const assignee = allUsers.find(u => u.id === assigneeIds[0]);
    await api(`/tasks/${id}`, {
      method: "PATCH",
      body: { title, description, assignee_id: assigneeIds[0], assignee_name: assignee ? assignee.name : "", deadline, priority, status },
    });
  } else {
    // 複数人 → 元タスクを1人目に更新、残りは複製
    const [firstId, ...restIds] = assigneeIds;
    const first = allUsers.find(u => u.id === firstId);
    await api(`/tasks/${id}`, {
      method: "PATCH",
      body: { title, description, assignee_id: firstId, assignee_name: first ? first.name : "", deadline, priority, status },
    });
    for (const uid of restIds) {
      await api("/tasks/send", {
        method: "POST",
        body: { title, description, assignee_id: uid, deadline, priority, sender_id: currentUser?.id },
      });
    }
  }
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
  // APIキー
  const data = await api("/settings/apikey");
  const statusEl = document.getElementById("apikey-status");
  if (data.configured) {
    statusEl.innerHTML = `<span style="color:var(--success);font-weight:600">設定済み: ${esc(data.masked)}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:var(--danger);font-weight:600">未設定 — 議事録抽出が使えません</span>`;
  }

  // Webhook
  const wh = await api("/settings/webhook");
  const whStatus = document.getElementById("webhook-status");
  if (wh.configured) {
    whStatus.innerHTML = `<span style="color:var(--success);font-weight:600">接続済み: ${esc(wh.masked)}</span>`;
  } else {
    whStatus.innerHTML = `<span style="color:var(--text-secondary)">未設定 — Teams通知は無効です</span>`;
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

// Webhook保存
document.getElementById("webhook-save-btn").addEventListener("click", async () => {
  const url = document.getElementById("webhook-input").value.trim();
  const msg = document.getElementById("webhook-msg");
  try {
    await api("/settings/webhook", { method: "POST", body: { webhookUrl: url } });
    msg.textContent = "保存しました";
    msg.style.color = "var(--success)";
    msg.classList.remove("hidden");
    document.getElementById("webhook-input").value = "";
    loadSettings();
  } catch (e) {
    msg.textContent = e.message;
    msg.style.color = "var(--danger)";
    msg.classList.remove("hidden");
  }
});

// Webhookテスト
document.getElementById("webhook-test-btn").addEventListener("click", async () => {
  const msg = document.getElementById("webhook-msg");
  try {
    await api("/settings/webhook/test", { method: "POST" });
    msg.textContent = "テスト通知を送信しました。Teamsを確認してください";
    msg.style.color = "var(--success)";
    msg.classList.remove("hidden");
  } catch (e) {
    msg.textContent = e.message;
    msg.style.color = "var(--danger)";
    msg.classList.remove("hidden");
  }
});

// Webhook解除
document.getElementById("webhook-clear-btn").addEventListener("click", async () => {
  const msg = document.getElementById("webhook-msg");
  await api("/settings/webhook", { method: "POST", body: { webhookUrl: "" } });
  msg.textContent = "Webhook連携を解除しました";
  msg.style.color = "var(--text-secondary)";
  msg.classList.remove("hidden");
  loadSettings();
});

// 期限アラート手動送信
document.getElementById("notify-deadline-btn").addEventListener("click", async () => {
  const msg = document.getElementById("notify-deadline-msg");
  try {
    const data = await api("/notify/deadline", { method: "POST" });
    if (data.message) {
      msg.textContent = data.message;
      msg.style.color = "var(--text-secondary)";
    } else {
      msg.textContent = `送信完了 — 期限超過: ${data.overdue}件, 2日以内: ${data.soon}件`;
      msg.style.color = "var(--success)";
    }
    msg.classList.remove("hidden");
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

// ========== マイタスク: クイック追加 ==========
document.getElementById("my-quick-title").addEventListener("focus", () => {
  document.getElementById("my-quick-extra").classList.remove("hidden");
});

document.getElementById("my-quick-submit").addEventListener("click", async () => {
  const title = document.getElementById("my-quick-title").value.trim();
  if (!title) { alert("タスク名を入力してください"); return; }

  try {
    await api("/tasks/send", {
      method: "POST",
      body: {
        title,
        description: "",
        assignee_id: currentUser.id,
        deadline: document.getElementById("my-quick-deadline").value,
        priority: document.getElementById("my-quick-priority").value,
        sender_id: currentUser.id,
      },
    });
    document.getElementById("my-quick-title").value = "";
    document.getElementById("my-quick-deadline").value = "";
    document.getElementById("my-quick-priority").value = "medium";
    document.getElementById("my-quick-extra").classList.add("hidden");
    loadMyTasks();
  } catch (e) { alert(e.message); }
});

// Enterキーで自動追加しない（ボタンクリックのみ追加）

// ========== ユーザー選択画面: メンバー簡単追加 ==========
document.getElementById("quick-add-btn").addEventListener("click", () => {
  document.getElementById("quick-add-form").classList.remove("hidden");
  document.getElementById("quick-name").focus();
});

document.getElementById("quick-cancel").addEventListener("click", () => {
  document.getElementById("quick-add-form").classList.add("hidden");
  document.getElementById("quick-name").value = "";
  document.getElementById("quick-initial").value = "";
});

document.getElementById("quick-save").addEventListener("click", async () => {
  const name = document.getElementById("quick-name").value.trim();
  const initial = document.getElementById("quick-initial").value.trim();
  if (!name) { alert("名前を入力してください"); return; }
  try {
    await api("/users", { method: "POST", body: { name, initial, role: "member" } });
    document.getElementById("quick-add-form").classList.add("hidden");
    document.getElementById("quick-name").value = "";
    document.getElementById("quick-initial").value = "";
    initUserPicker();
  } catch (e) { alert(e.message); }
});

// ========== 案件管理 ==========
const AVATAR_COLORS_CASES = ["#7b68ee","#20b2aa","#ff8c69","#dda0dd","#87ceeb","#98fb98","#ffa07a","#66cdaa","#db7093","#f0e68c"];
function caseAvatarColor(name) {
  if (!name) return "#ccc";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS_CASES.length;
  return AVATAR_COLORS_CASES[h];
}
function typeBadgeClass(type) {
  if (type === "FAX受電") return "badge-fax";
  if (type === "架電バイト") return "badge-kaden";
  if (type === "ヒトキワ広告") return "badge-hitokiwa";
  return "";
}
function typeSelClass(type) {
  if (type === "FAX受電") return "sel-fax";
  if (type === "架電バイト") return "sel-kaden";
  if (type === "ヒトキワ広告") return "sel-hitokiwa";
  return "";
}
function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${y}/${m}/${day}` : d;
}
function dateDiff(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}

function rateStr(interview, total) {
  if (!total) return "—";
  return Math.round(interview / total * 100) + "%";
}

// ダッシュボード
async function loadCasesDashboard() {
  const data = await api("/cases/dashboard");
  const fax = data.byType.find(t => t.type === "FAX受電")?.count || 0;
  const kaden = data.byType.find(t => t.type === "架電バイト")?.count || 0;
  const hitokiwa = data.byType.find(t => t.type === "ヒトキワ広告")?.count || 0;

  document.getElementById("cases-stats-row").innerHTML = `
    <div class="cases-stat-card">
      <div class="cases-stat-label">案件合計</div>
      <div class="cases-stat-value">${data.total}</div>
      <div class="cases-stat-sub">対応中: ${data.active}件</div>
    </div>
    <div class="cases-stat-card" style="border-left:3px solid var(--fax-color)">
      <div class="cases-stat-label" style="color:var(--fax-color)">FAX受電</div>
      <div class="cases-stat-value" style="color:var(--fax-color)">${fax}</div>
      <div class="cases-stat-sub">件</div>
    </div>
    <div class="cases-stat-card" style="border-left:3px solid var(--kaden-color)">
      <div class="cases-stat-label" style="color:var(--kaden-color)">架電バイト</div>
      <div class="cases-stat-value" style="color:var(--kaden-color)">${kaden}</div>
      <div class="cases-stat-sub">件</div>
    </div>
    <div class="cases-stat-card" style="border-left:3px solid var(--hitokiwa-color)">
      <div class="cases-stat-label" style="color:var(--hitokiwa-color)">ヒトキワ広告</div>
      <div class="cases-stat-value" style="color:var(--hitokiwa-color)">${hitokiwa}</div>
      <div class="cases-stat-sub">件</div>
    </div>
  `;

  const types = [
    { key: "fax",      label: "FAX受電",    color: "var(--fax-color)",      bg: "var(--fax-bg)",      totalKey: "fax_total",      iKey: "fax_interview",      cKey: "fax_cancel" },
    { key: "kaden",    label: "架電バイト",   color: "var(--kaden-color)",    bg: "var(--kaden-bg)",    totalKey: "kaden_total",    iKey: "kaden_interview",    cKey: "kaden_cancel" },
    { key: "hitokiwa", label: "ヒトキワ広告", color: "var(--hitokiwa-color)", bg: "var(--hitokiwa-bg)", totalKey: "hitokiwa_total", iKey: "hitokiwa_interview", cKey: "hitokiwa_cancel" },
  ];

  const container = document.getElementById("cases-summary-tables");
  const isAdmin = currentUser?.role === "admin";

  // メンバーは自分のデータのみ表示
  if (!isAdmin) {
    const me = data.byMember.find(m => m.id === currentUser?.id);
    if (!me) { container.innerHTML = '<p class="empty-state">自分のデータがありません（営業以外は対象外）</p>'; return; }
    const typeRows = types.map(t => {
      const total = me[t.totalKey]||0;
      const iv = me[t.iKey]||0;
      const ca = me[t.cKey]||0;
      return `<tr>
        <td><span class="case-type-badge ${t.key==="fax"?"badge-fax":t.key==="kaden"?"badge-kaden":"badge-hitokiwa"}">${t.label}</span></td>
        <td><strong>${total}</strong></td>
        <td>${iv}</td>
        <td>${ca}</td>
        <td class="rate-cell"><strong>${rateStr(iv, total)}</strong></td>
      </tr>`;
    }).join("");
    const totalAll = (me.fax_total||0)+(me.kaden_total||0)+(me.hitokiwa_total||0);
    const ivAll = (me.fax_interview||0)+(me.kaden_interview||0)+(me.hitokiwa_interview||0);
    const caAll = (me.fax_cancel||0)+(me.kaden_cancel||0)+(me.hitokiwa_cancel||0);
    container.innerHTML = `<div class="cases-table-wrap" style="max-width:500px">
      <table class="cases-summary-table">
        <thead><tr><th>種類</th><th>件数</th><th>面接完了</th><th>バラシ</th><th>面接到達率</th></tr></thead>
        <tbody>${typeRows}</tbody>
        <tfoot><tr><td>合計</td><td><strong>${totalAll}</strong></td><td>${ivAll}</td><td>${caAll}</td><td class="rate-cell"><strong>${rateStr(ivAll, totalAll)}</strong></td></tr></tfoot>
      </table>
    </div>`;
    // 自分の面接予定のみ表示
    const upcoming = document.getElementById("cases-upcoming-list");
    const myUpcoming = data.upcoming.filter(c => c.assignee_id === currentUser?.id);
    if (!myUpcoming.length) { upcoming.innerHTML = '<div class="empty-state">面接予定の案件はありません</div>'; return; }
    upcoming.innerHTML = myUpcoming.map(c => {
      const diff = dateDiff(c.interview_date);
      let dateClass = "", suffix = "";
      if (diff === 0) { dateClass = "upcoming-today"; suffix = "（今日）"; }
      else if (diff === 1) { dateClass = "upcoming-soon"; suffix = "（明日）"; }
      else if (diff !== null && diff <= 3 && diff > 0) { dateClass = "upcoming-soon"; suffix = `（${diff}日後）`; }
      return `<div class="cases-upcoming-item">
        <span class="upcoming-date-text ${dateClass}">${esc(fmtDate(c.interview_date))}${suffix}</span>
        <span class="case-type-badge ${typeBadgeClass(c.type)}">${esc(c.type)}</span>
        <span style="font-size:0.85rem">${esc(c.case_no)} <span class="case-desc-text">${esc(c.description||"")}</span></span>
      </div>`;
    }).join("");
    return;
  }

  // 管理者: 全メンバー × 全種別 の横長テーブル
  let tFaxTotal=0, tFaxIv=0, tKadenTotal=0, tKadenIv=0, tHitoTotal=0, tHitoIv=0;
  const memberRows = data.byMember.map(m => {
    const ft=m.fax_total||0, fi=m.fax_interview||0;
    const kt=m.kaden_total||0, ki=m.kaden_interview||0;
    const ht=m.hitokiwa_total||0, hi=m.hitokiwa_interview||0;
    tFaxTotal+=ft; tFaxIv+=fi; tKadenTotal+=kt; tKadenIv+=ki; tHitoTotal+=ht; tHitoIv+=hi;
    const color = caseAvatarColor(m.name);
    return `<tr>
      <td><span class="member-avatar-xs" style="background:${color}">${esc(m.initial||m.name[0])}</span>${esc(m.name)}</td>
      <td class="td-fax">${ft||'<span class="c-zero">0</span>'}</td>
      <td class="td-fax">${fi||'<span class="c-zero">0</span>'}</td>
      <td class="td-fax rate-cell">${rateStr(fi,ft)}</td>
      <td class="td-kaden">${kt||'<span class="c-zero">0</span>'}</td>
      <td class="td-kaden">${ki||'<span class="c-zero">0</span>'}</td>
      <td class="td-kaden rate-cell">${rateStr(ki,kt)}</td>
      <td class="td-hitokiwa">${ht||'<span class="c-zero">0</span>'}</td>
      <td class="td-hitokiwa">${hi||'<span class="c-zero">0</span>'}</td>
      <td class="td-hitokiwa rate-cell">${rateStr(hi,ht)}</td>
    </tr>`;
  }).join("");

  container.innerHTML = `<div class="cases-table-wrap">
    <table class="cases-summary-table cases-summary-wide">
      <thead>
        <tr>
          <th rowspan="2">担当者</th>
          <th colspan="3" class="th-fax">FAX受電</th>
          <th colspan="3" class="th-kaden">架電バイト</th>
          <th colspan="3" class="th-hitokiwa">ヒトキワ広告</th>
        </tr>
        <tr>
          <th class="th-fax th-sub">案件数</th><th class="th-fax th-sub">面接数</th><th class="th-fax th-sub">到達率</th>
          <th class="th-kaden th-sub">案件数</th><th class="th-kaden th-sub">面接数</th><th class="th-kaden th-sub">到達率</th>
          <th class="th-hitokiwa th-sub">案件数</th><th class="th-hitokiwa th-sub">面接数</th><th class="th-hitokiwa th-sub">到達率</th>
        </tr>
      </thead>
      <tbody>${memberRows}</tbody>
      <tfoot><tr>
        <td>合計</td>
        <td class="td-fax"><strong>${tFaxTotal}</strong></td><td class="td-fax">${tFaxIv}</td><td class="td-fax rate-cell"><strong>${rateStr(tFaxIv,tFaxTotal)}</strong></td>
        <td class="td-kaden"><strong>${tKadenTotal}</strong></td><td class="td-kaden">${tKadenIv}</td><td class="td-kaden rate-cell"><strong>${rateStr(tKadenIv,tKadenTotal)}</strong></td>
        <td class="td-hitokiwa"><strong>${tHitoTotal}</strong></td><td class="td-hitokiwa">${tHitoIv}</td><td class="td-hitokiwa rate-cell"><strong>${rateStr(tHitoIv,tHitoTotal)}</strong></td>
      </tr></tfoot>
    </table>
  </div>`;

  const upcoming = document.getElementById("cases-upcoming-list");
  if (!data.upcoming.length) { upcoming.innerHTML = '<div class="empty-state">面接予定の案件はありません</div>'; return; }
  upcoming.innerHTML = data.upcoming.map(c => {
    const diff = dateDiff(c.interview_date);
    let dateClass = "", suffix = "";
    if (diff === 0) { dateClass = "upcoming-today"; suffix = "（今日）"; }
    else if (diff === 1) { dateClass = "upcoming-soon"; suffix = "（明日）"; }
    else if (diff !== null && diff <= 3 && diff > 0) { dateClass = "upcoming-soon"; suffix = `（${diff}日後）`; }
    const color = caseAvatarColor(c.assignee_name);
    return `<div class="cases-upcoming-item">
      <span class="upcoming-date-text ${dateClass}">${esc(fmtDate(c.interview_date))}${suffix}</span>
      <span class="case-type-badge ${typeBadgeClass(c.type)}">${esc(c.type)}</span>
      <span style="font-size:0.85rem">${esc(c.case_no)} <span class="case-desc-text">${esc(c.description||"")}</span></span>
      <span class="case-assignee-chip">
        <span class="case-chip-avatar" style="background:${color}">${c.assignee_name ? esc(c.assignee_name[0]) : "?"}</span>
        ${esc(c.assignee_name||"未担当")}
      </span>
    </div>`;
  }).join("");
}

// 案件一覧
let casesFilterType = "", casesFilterSearch = "", casesFilterAssignee = "", casesFilterStatus = "active";

async function loadCasesList() {
  const sel = document.getElementById("cases-filter-assignee");
  const cur = sel.value;
  sel.innerHTML = '<option value="">全員</option>' + allUsers.filter(u=>u.role==="member").map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("");
  sel.value = cur;

  const params = new URLSearchParams();
  if (casesFilterType) params.set("type", casesFilterType);
  if (casesFilterSearch) params.set("search", casesFilterSearch);
  if (casesFilterAssignee) params.set("assignee_id", casesFilterAssignee);
  if (casesFilterStatus) params.set("status", casesFilterStatus);

  const cases = await api("/cases?" + params);
  const tbody = document.getElementById("cases-list-body");
  const empty = document.getElementById("cases-list-empty");

  if (!cases.length) { tbody.innerHTML = ""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");
  tbody.innerHTML = cases.map(c => {
    const color = caseAvatarColor(c.assignee_name);
    const statusLabel = c.status==="active"?"対応中":c.status==="interview"?"面接完了":"バラシ";
    const statusClass = c.status==="active"?"badge-active":c.status==="interview"?"badge-interview":"badge-cancel";
    const rowClass = c.status==="interview"?"case-done-row":c.status==="cancel"?"case-cancel-row":"";
    return `<tr class="${rowClass}" data-case-id="${c.id}">
      <td><span class="case-no-text">${esc(c.case_no)}</span></td>
      <td><span class="case-type-badge ${typeBadgeClass(c.type)}">${esc(c.type)}</span></td>
      <td><span class="case-desc-text">${esc(c.description||"—")}</span></td>
      <td style="font-size:0.82rem;color:var(--text-secondary)">${esc(fmtDate(c.interview_date)||"—")}</td>
      <td>${c.assignee_name ? `<span class="case-assignee-chip"><span class="case-chip-avatar" style="background:${color}">${esc(c.assignee_name[0])}</span>${esc(c.assignee_name)}</span>` : '<span style="color:var(--text-light);font-size:0.8rem">未担当</span>'}</td>
      <td><span class="case-status-badge ${statusClass}">${statusLabel}</span></td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => {
      const c = cases.find(x => x.id === Number(tr.dataset.caseId));
      if (c) openCaseModal(c);
    });
  });
}

// 案件追加フォーム初期化
function initAddCase() {
  document.getElementById("add-case-no").value = "";
  document.getElementById("add-case-type").value = "";
  document.getElementById("add-case-desc").value = "";
  document.getElementById("add-case-date").value = "";
  document.getElementById("add-case-assignee-id").value = "";
  document.getElementById("add-case-error").classList.add("hidden");
  document.querySelectorAll("#add-case-type-selector .case-type-sel-btn").forEach(b => b.className = "case-type-sel-btn");
  renderCaseAssigneeBtns("add-case-assignee-list", "add-case-assignee-id", null);
}

function renderCaseAssigneeBtns(listId, hiddenId, selectedId) {
  const list = document.getElementById(listId);
  const members = allUsers.filter(u => u.role === "member" && u.department === "営業");
  const unBtn = `<button type="button" class="case-assignee-btn${!selectedId?" selected":""}" data-aid="">未担当</button>`;
  const btns = members.map(u => `<button type="button" class="case-assignee-btn${String(u.id)===String(selectedId)?" selected":""}" data-aid="${u.id}">${esc(u.name)}</button>`);
  list.innerHTML = unBtn + btns.join("");
  list.querySelectorAll(".case-assignee-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      list.querySelectorAll(".case-assignee-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById(hiddenId).value = btn.dataset.aid;
    });
  });
}

// 案件モーダル
function openCaseModal(c) {
  document.getElementById("edit-case-id").value = c.id;
  document.getElementById("edit-case-no").value = c.case_no;
  document.getElementById("edit-case-desc").value = c.description||"";
  document.getElementById("edit-case-date").value = c.interview_date||"";
  document.getElementById("edit-case-status").value = c.status;
  document.getElementById("edit-case-type").value = c.type;
  document.getElementById("edit-case-assignee-id").value = c.assignee_id||"";
  document.querySelectorAll("#edit-case-type-selector .case-type-sel-btn").forEach(b => {
    b.className = "case-type-sel-btn";
    if (b.dataset.type === c.type) b.classList.add(typeSelClass(c.type));
  });
  renderCaseAssigneeBtns("edit-case-assignee-list", "edit-case-assignee-id", c.assignee_id);
  const isAdmin = currentUser?.role === "admin";
  ["edit-case-no","edit-case-desc","edit-case-date","edit-case-status"].forEach(id => {
    document.getElementById(id).disabled = !isAdmin;
  });
  document.querySelectorAll("#edit-case-type-selector .case-type-sel-btn, #edit-case-assignee-list .case-assignee-btn").forEach(b => {
    b.style.pointerEvents = isAdmin ? "" : "none";
  });
  document.getElementById("case-modal-save").style.display = isAdmin ? "" : "none";
  document.getElementById("case-modal-delete").style.display = isAdmin ? "" : "none";
  document.getElementById("case-edit-modal").classList.remove("hidden");
}

// ===== イベントリスナー（案件管理）=====
document.addEventListener("DOMContentLoaded", () => {
  // ダッシュボード更新
  document.getElementById("cases-refresh-btn").addEventListener("click", loadCasesDashboard);

  // 一覧フィルター
  document.getElementById("cases-search").addEventListener("input", e => { casesFilterSearch = e.target.value; loadCasesList(); });
  document.querySelectorAll(".cases-type-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      casesFilterType = btn.dataset.type;
      document.querySelectorAll(".cases-type-btn").forEach(b => b.className = "cases-type-btn");
      const cls = casesFilterType === "" ? "active-all" : casesFilterType === "FAX受電" ? "active-fax" : casesFilterType === "架電バイト" ? "active-kaden" : "active-hitokiwa";
      btn.classList.add(cls);
      loadCasesList();
    });
  });
  document.getElementById("cases-filter-assignee").addEventListener("change", e => { casesFilterAssignee = e.target.value; loadCasesList(); });
  document.getElementById("cases-filter-status").addEventListener("change", e => { casesFilterStatus = e.target.value; loadCasesList(); });

  // 案件追加ナビ
  document.getElementById("cases-add-nav-btn").addEventListener("click", () => navigateTo("cases-add"));

  // 種類選択（追加）
  document.querySelectorAll("#add-case-type-selector .case-type-sel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("add-case-type").value = btn.dataset.type;
      document.querySelectorAll("#add-case-type-selector .case-type-sel-btn").forEach(b => b.className = "case-type-sel-btn");
      btn.classList.add(typeSelClass(btn.dataset.type));
    });
  });

  // 種類選択（編集）
  document.querySelectorAll("#edit-case-type-selector .case-type-sel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("edit-case-type").value = btn.dataset.type;
      document.querySelectorAll("#edit-case-type-selector .case-type-sel-btn").forEach(b => b.className = "case-type-sel-btn");
      btn.classList.add(typeSelClass(btn.dataset.type));
    });
  });

  // 案件追加ボタン
  document.getElementById("add-case-submit-btn").addEventListener("click", async () => {
    const case_no = document.getElementById("add-case-no").value.trim();
    const type = document.getElementById("add-case-type").value;
    const errEl = document.getElementById("add-case-error");
    if (!case_no) { errEl.textContent = "案件番号を入力してください"; errEl.classList.remove("hidden"); return; }
    if (!type) { errEl.textContent = "案件の種類を選んでください"; errEl.classList.remove("hidden"); return; }
    errEl.classList.add("hidden");
    try {
      await api("/cases", { method: "POST", body: {
        case_no, type,
        description: document.getElementById("add-case-desc").value.trim(),
        interview_date: document.getElementById("add-case-date").value,
        assignee_id: document.getElementById("add-case-assignee-id").value || null,
      }});
      navigateTo("cases-list");
      loadCasesDashboard();
    } catch(e) { errEl.textContent = e.message; errEl.classList.remove("hidden"); }
  });
  document.getElementById("add-case-reset-btn").addEventListener("click", initAddCase);

  // モーダル保存・削除
  document.getElementById("case-modal-save").addEventListener("click", async () => {
    const id = document.getElementById("edit-case-id").value;
    const type = document.getElementById("edit-case-type").value;
    if (!type) { alert("案件の種類を選んでください"); return; }
    await api(`/cases/${id}`, { method: "PATCH", body: {
      case_no: document.getElementById("edit-case-no").value.trim(),
      type,
      description: document.getElementById("edit-case-desc").value,
      interview_date: document.getElementById("edit-case-date").value,
      assignee_id: document.getElementById("edit-case-assignee-id").value || null,
      status: document.getElementById("edit-case-status").value,
    }});
    document.getElementById("case-edit-modal").classList.add("hidden");
    loadCasesList();
    loadCasesDashboard();
  });
  document.getElementById("case-modal-delete").addEventListener("click", async () => {
    if (!confirm("この案件を削除しますか？")) return;
    await api(`/cases/${document.getElementById("edit-case-id").value}`, { method: "DELETE" });
    document.getElementById("case-edit-modal").classList.add("hidden");
    loadCasesList();
    loadCasesDashboard();
  });
  document.getElementById("case-modal-cancel").addEventListener("click", () => document.getElementById("case-edit-modal").classList.add("hidden"));
  document.getElementById("case-modal-close").addEventListener("click", () => document.getElementById("case-edit-modal").classList.add("hidden"));
  document.getElementById("case-edit-modal").addEventListener("click", e => {
    if (e.target === e.currentTarget) e.target.classList.add("hidden");
  });
});

// ========== 初期化 ==========
initUserPicker();

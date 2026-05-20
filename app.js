// OAT Dashboard — app.js
// ===== CONFIG =====
// ใส่ URL ของ Cloudflare Worker ที่นี่หลัง deploy
// หรือตั้งผ่านหน้าเว็บ (กดไอคอน Settings)
const DEFAULT_API_BASE = "";

// Notion Database IDs
const DB = {
  habitTracker: "1d20a744-f603-8007-b93b-eba78823d1df",
  vitaminLog:   "3660a744-f603-81c0-9dac-e19bfcc03328",
  routines:     "3660a744-f603-8127-85a5-f942ffcebb5f",
  tasks:        "1ca0a744-f603-801f-9fe7-e1989b735f8f",
};

// Vitamin schedule
const VITAMIN_SCHEDULE = {
  weekday: [
    { key: "Vit C (เช้า)", label: "Vit C", time: "เช้า" },
    { key: "Zinc",         label: "Zinc",   time: "เช้า" },
    { key: "Vit C (เย็น)", label: "Vit C", time: "เย็น" },
    { key: "Fish Oil",     label: "Fish Oil", time: "เย็น" },
  ],
  weekend: [
    { key: "Vit C (เช้า)", label: "Vit C", time: "เช้า" },
    { key: "Zinc",         label: "Zinc",   time: "เช้า" },
    { key: "Vit C (เย็น)", label: "Vit C", time: "เย็น" },
    { key: "Fish Oil",     label: "Fish Oil", time: "เย็น" },
    { key: "Vit D",        label: "Vit D",  time: "เย็น" },
  ],
};

const HABIT_KEYS = ["8 hr. Sleep","2 lt. Water","Workout","Reading","Content"];
const HABIT_LABELS = {
  "8 hr. Sleep": "นอน 8 ชั่วโมง",
  "2 lt. Water": "ดื่มน้ำ 2 ลิตร",
  "Workout": "ออกกำลังกาย",
  "Reading": "อ่านหนังสือ",
  "Content": "ทำ Content",
};

// ===== STATE =====
let apiBase = localStorage.getItem("oat_api_base") || DEFAULT_API_BASE;
let todayHabitPageId = null;
let todayVitPageId   = null;
let routineData = [];

// ===== UTILS =====
const today = new Date();
const todayStr = today.toISOString().slice(0,10);
const isWeekend = today.getDay() === 0 || today.getDay() === 6;

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date(todayStr);
  return Math.round((d - now) / 86400000);
}

function thaiDate(d) {
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const days = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  const date = new Date(dateStr(d));
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}
function dateStr(d) { return d instanceof Date ? d.toISOString().slice(0,10) : d; }

function freqLabel(f) {
  const m = { weekly:"ทุกสัปดาห์", monthly:"ทุกเดือน", "3months":"ทุก 3 เดือน", "6months":"ทุก 6 เดือน", yearly:"ทุกปี" };
  return m[f] || f;
}

function showToast(msg, type="success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ""; }, 2500);
}

// ===== API =====
async function notionGet(path) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, { method:"GET" });
  return res.ok ? res.json() : null;
}

async function notionPost(path, body) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

async function notionPatch(path, body) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, {
    method: "PATCH",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

// ===== RENDER HELPERS =====
function checkIcon() {
  return `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l3 3 5-5"/></svg>`;
}

// ===== HABITS =====
async function loadHabits() {
  const el = document.getElementById("habit-list");
  const data = await notionPost(`/databases/${DB.habitTracker}/query`, {
    filter: { property:"Date", date:{ equals: todayStr } },
    page_size: 1,
  });

  if (!data || !data.results) { el.innerHTML = `<div class="empty">ไม่สามารถโหลดข้อมูลได้</div>`; return; }

  let page = data.results[0];
  if (!page) {
    // สร้าง entry วันนี้อัตโนมัติ
    page = await notionPost("/pages", {
      parent: { database_id: DB.habitTracker },
      properties: {
        Name: { title: [{ text: { content: todayStr } }] },
        Date: { date: { start: todayStr } },
      },
    });
  }
  if (!page) { el.innerHTML = `<div class="empty">ไม่สามารถสร้าง entry ได้</div>`; return; }

  todayHabitPageId = page.id;
  renderHabits(page.properties);
}

function renderHabits(props) {
  const el = document.getElementById("habit-list");
  let done = 0, total = 0;
  let html = "";

  for (const key of HABIT_KEYS) {
    if (!(key in props)) continue;
    const checked = props[key].checkbox;
    total++;
    if (checked) done++;
    html += `
      <div class="check-row${checked?" checked":""}" data-type="habit" data-key="${key}" data-checked="${checked}">
        <div class="check-box">${checkIcon()}</div>
        <div class="check-label">${HABIT_LABELS[key]||key}</div>
      </div>`;
  }

  el.innerHTML = html || `<div class="empty">ไม่มี habits</div>`;
  document.getElementById("habit-count").textContent = `${done}/${total}`;
  el.querySelectorAll(".check-row[data-type=habit]").forEach(row => {
    row.addEventListener("click", () => toggleHabit(row));
  });
}

async function toggleHabit(row) {
  if (!todayHabitPageId) return;
  const key = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal;
  row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayHabitPageId}`, {
    properties: { [key]: { checkbox: newVal } },
  });
  if (res) {
    showToast(newVal ? `✅ ${HABIT_LABELS[key]||key}` : `↩ ${HABIT_LABELS[key]||key}`);
    renderHabits(res.properties);
    loadFocus();
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

// ===== VITAMINS =====
async function loadVitamins() {
  const el = document.getElementById("vit-list");
  const data = await notionPost(`/databases/${DB.vitaminLog}/query`, {
    filter: { property:"Date", title:{ equals: todayStr } },
    page_size: 1,
  });

  if (!data || !data.results) { el.innerHTML = `<div class="empty">ไม่สามารถโหลดข้อมูลได้</div>`; return; }

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.vitaminLog },
      properties: {
        Date: { title: [{ text: { content: todayStr } }] },
      },
    });
  }
  if (!page) { el.innerHTML = `<div class="empty">ไม่สามารถสร้าง entry ได้</div>`; return; }

  todayVitPageId = page.id;
  renderVitamins(page.properties);
}

function renderVitamins(props) {
  const el = document.getElementById("vit-list");
  const schedule = isWeekend ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
  let done = 0;
  let html = "";

  for (const vit of schedule) {
    const checked = props[vit.key]?.checkbox || false;
    if (checked) done++;
    html += `
      <div class="check-row${checked?" checked":""}" data-type="vit" data-key="${vit.key}" data-checked="${checked}">
        <div class="check-box">${checkIcon()}</div>
        <div class="check-label">${vit.label}</div>
        <span class="vit-time">${vit.time}</span>
      </div>`;
  }

  el.innerHTML = html;
  document.getElementById("vit-count").textContent = `${done}/${schedule.length}`;
  el.querySelectorAll(".check-row[data-type=vit]").forEach(row => {
    row.addEventListener("click", () => toggleVitamin(row));
  });
}

async function toggleVitamin(row) {
  if (!todayVitPageId) return;
  const key = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal;
  row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayVitPageId}`, {
    properties: { [key]: { checkbox: newVal } },
  });
  if (res) {
    showToast(newVal ? `💊 ${key}` : `↩ ${key}`);
    renderVitamins(res.properties);
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

// ===== ROUTINES =====
function isDueThisMonthOrOverdue(dateStr) {
  if (!dateStr) return true; // ไม่มีวัน Last Done เลย → แสดงเสมอ
  const d = new Date(dateStr);
  const now = new Date(todayStr);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return d <= endOfMonth;
}

async function loadRoutines() {
  const el = document.getElementById("routine-list");
  const data = await notionPost(`/databases/${DB.routines}/query`, {
    sorts: [{ property:"Next Due", direction:"ascending" }],
    page_size: 50,
  });

  if (!data || !data.results) { el.innerHTML = `<div class="empty">ไม่สามารถโหลดข้อมูลได้</div>`; return; }

  routineData = data.results;
  // แสดงเฉพาะที่ Due เดือนนี้หรือเลยกำหนดแล้ว
  const visible = routineData.filter(r => {
    const nextDue = r.properties["Next Due"]?.formula?.date?.start || null;
    return isDueThisMonthOrOverdue(nextDue);
  });
  renderRoutines(visible);
  loadFocus();
}

function renderRoutines(routines) {
  const el = document.getElementById("routine-list");
  if (!routines.length) {
    el.innerHTML = `<div class="empty">ไม่มี Routines ที่ต้องทำเดือนนี้ 🎉</div>`;
    document.getElementById("routine-count").textContent = "0";
    return;
  }

  let html = "";
  for (const r of routines) {
    const p = r.properties;
    const name = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const cat = p.Category?.select?.name || "อื่นๆ";
    const freq = p.Frequency?.select?.name || "";
    const nextDue = p["Next Due"]?.formula?.date?.start || null;
    const diff = daysDiff(nextDue);

    let nextLabel = "ยังไม่ได้ตั้งวัน";
    let nextClass = "";
    if (nextDue) {
      if (diff < 0)       { nextLabel = `เลยกำหนด ${Math.abs(diff)} วัน`; nextClass = "overdue"; }
      else if (diff === 0) { nextLabel = "ครบวันนี้"; nextClass = "soon"; }
      else if (diff <= 7)  { nextLabel = `อีก ${diff} วัน (${thaiDate(nextDue)})`; nextClass = "soon"; }
      else                 { nextLabel = thaiDate(nextDue); }
    }

    html += `
      <div class="routine-row" data-id="${r.id}">
        <div class="routine-info">
          <div class="routine-name">
            <span class="cat-chip cat-${cat}">${cat}</span>${name}
          </div>
          <div class="routine-next ${nextClass}">${nextLabel}</div>
        </div>
        <span class="routine-freq">${freqLabel(freq)}</span>
        <button class="done-btn" onclick="markRoutineDone('${r.id}', this)">Done</button>
      </div>`;
  }

  el.innerHTML = html;
  document.getElementById("routine-count").textContent = routines.length;
}

function calcNextDue(freq, fromDate) {
  const d = new Date(fromDate);
  if (freq === "weekly")   d.setDate(d.getDate() + 7);
  else if (freq === "monthly")  d.setMonth(d.getMonth() + 1);
  else if (freq === "3months")  d.setMonth(d.getMonth() + 3);
  else if (freq === "6months")  d.setMonth(d.getMonth() + 6);
  else if (freq === "yearly")   d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function markRoutineDone(pageId, btn) {
  btn.disabled = true;
  btn.textContent = "...";

  const routine = routineData.find(r => r.id === pageId);
  const freq = routine?.properties?.Frequency?.select?.name || "";
  const nextDueDate = freq ? calcNextDue(freq, todayStr) : null;

  const props = { "Last Done": { date: { start: todayStr } } };
  if (nextDueDate) props["Next Due Date"] = { date: { start: nextDueDate } };

  const res = await notionPatch(`/pages/${pageId}`, { properties: props });

  if (res) {
    showToast("✅ บันทึกแล้ว");
    await loadRoutines();
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
    btn.disabled = false;
    btn.textContent = "Done";
  }
}

// ===== TASKS =====
async function loadTasks() {
  const el = document.getElementById("task-list");
  const data = await notionPost(`/databases/${DB.tasks}/query`, {
    filter: { property:"Done", checkbox:{ equals: false } },
    sorts: [{ property:"Due Date", direction:"ascending" }],
    page_size: 20,
  });

  if (!data || !data.results) { el.innerHTML = `<div class="empty">ไม่สามารถโหลดข้อมูลได้</div>`; return; }

  if (!data.results.length) {
    el.innerHTML = `<div class="empty">ไม่มี Tasks ค้าง</div>`;
    document.getElementById("task-count").textContent = "0";
    return;
  }

  let html = "";
  for (const r of data.results) {
    const p = r.properties;
    const name = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const dueDate = p["Due Date"]?.date?.start || null;
    const status = p.Status?.select?.name || "";
    const diff = daysDiff(dueDate);

    let dueLabel = dueDate ? thaiDate(dueDate) : "ไม่มีกำหนด";
    let dueClass = "";
    if (diff !== null && diff < 0) { dueLabel = `เลยกำหนด ${Math.abs(diff)} วัน`; dueClass = "overdue"; }

    const statusClass = status === "IN PROGRESS" ? "in-progress" : "todo";
    const statusLabel = status === "IN PROGRESS" ? "In Progress" : (status || "To Do");

    html += `
      <div class="task-row" data-id="${r.id}">
        <div class="task-info">
          <div class="task-name">${name}</div>
          <div class="task-meta ${dueClass}">${dueLabel}</div>
        </div>
        <span class="status-chip ${statusClass}">${statusLabel}</span>
        <button class="done-btn" onclick="markTaskDone('${r.id}', this)">Done</button>
      </div>`;
  }

  el.innerHTML = html;
  document.getElementById("task-count").textContent = data.results.length;
}

async function markTaskDone(pageId, btn) {
  btn.disabled = true;
  btn.textContent = "...";
  const res = await notionPatch(`/pages/${pageId}`, {
    properties: { Done: { checkbox: true } },
  });
  if (res) {
    showToast("✅ Task เสร็จแล้ว");
    await loadTasks();
    loadFocus();
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
    btn.disabled = false;
    btn.textContent = "Done";
  }
}

// ===== FOCUS NOW =====
function loadFocus() {
  const el = document.getElementById("focus-list");
  const items = [];

  // Routines เลยกำหนด / ครบวันนี้ / อีก 3 วัน
  for (const r of routineData) {
    const p = r.properties;
    const name = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const nextDue = p["Next Due"]?.formula?.date?.start || null;
    const diff = daysDiff(nextDue);
    if (diff === null) continue;
    if (diff <= 3) {
      items.push({ name, diff, type: "routine", id: r.id,
        meta: diff < 0 ? `Routine — เลย ${Math.abs(diff)} วัน` : diff === 0 ? "Routine — ครบวันนี้" : `Routine — อีก ${diff} วัน` });
    }
  }

  items.sort((a,b) => a.diff - b.diff);

  if (!items.length) {
    el.innerHTML = `<div class="empty">ไม่มีงานเร่งด่วน</div>`;
    document.getElementById("focus-count").textContent = "0";
    return;
  }

  let html = "";
  for (const item of items) {
    let cls = item.diff < 0 ? "overdue" : item.diff === 0 ? "today" : "soon";
    let badge = item.diff < 0 ? "เลยกำหนด" : item.diff === 0 ? "วันนี้" : `${item.diff}d`;
    html += `
      <div class="focus-card ${cls}">
        <div class="focus-dot"></div>
        <div class="focus-info">
          <div class="focus-name">${item.name}</div>
          <div class="focus-meta">${item.meta}</div>
        </div>
        <span class="focus-badge">${badge}</span>
      </div>`;
  }

  el.innerHTML = html;
  document.getElementById("focus-count").textContent = items.length;
}

// ===== HEADER DATE =====
function setHeaderDate() {
  const d = new Date();
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  document.getElementById("header-date").textContent =
    `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}

// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem("oat_theme") || "dark";
  document.documentElement.dataset.theme = saved;
  updateThemeIcon(saved);
}
function updateThemeIcon(t) {
  document.getElementById("icon-sun").style.display  = t==="dark"  ? "block" : "none";
  document.getElementById("icon-moon").style.display = t==="light" ? "block" : "none";
}
document.getElementById("theme-btn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme;
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("oat_theme", next);
  updateThemeIcon(next);
});

// ===== SETUP =====
document.getElementById("setup-btn").addEventListener("click", () => {
  const banner = document.getElementById("setup-banner");
  banner.style.display = banner.style.display === "none" ? "block" : "none";
  document.getElementById("api-url-input").value = apiBase;
});
document.getElementById("setup-save").addEventListener("click", () => {
  const val = document.getElementById("api-url-input").value.trim().replace(/\/$/, "");
  if (!val) return;
  apiBase = val;
  localStorage.setItem("oat_api_base", val);
  document.getElementById("setup-banner").style.display = "none";
  showToast("✅ บันทึก API URL แล้ว");
  loadAll();
});

// ===== REFRESH =====
document.getElementById("refresh-btn").addEventListener("click", loadAll);

// ===== INIT =====
function loadAll() {
  if (!apiBase) {
    document.getElementById("setup-banner").style.display = "block";
    ["focus-list","habit-list","vit-list","routine-list","task-list"].forEach(id => {
      document.getElementById(id).innerHTML = `<div class="empty">ยังไม่ได้ตั้งค่า API URL</div>`;
    });
    return;
  }
  loadHabits();
  loadVitamins();
  loadRoutines();
  loadTasks();
}

initTheme();
setHeaderDate();
loadAll();

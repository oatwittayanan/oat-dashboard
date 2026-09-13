// OAT Dashboard — app.js v4 (Habits + Cardio Log + Tasks/Routines + Content Stage Tracker)

// ===== CONFIG =====
const DEFAULT_API_BASE = "https://oat-notion-proxy.wittayanan-oat.workers.dev";

const DB = {
  habitTracker: "1d20a744-f603-8007-b93b-eba78823d1df",
  vitaminLog:   "3660a744-f603-81c0-9dac-e19bfcc03328",
  routines:     "3660a744-f603-8127-85a5-f942ffcebb5f",
  tasks:        "1ca0a744-f603-801f-9fe7-e1989b735f8f",
  gameState:    "36e0a744-f603-811c-9d82-cbd84c5cbd25",
  runLog:       "36e0a744-f603-8188-8446-f117e233d374",
};

const VITAMIN_SCHEDULE = {
  weekday: [
    { key:"Vit C (เช้า)", label:"Vit C",    time:"เช้า" },
    { key:"Zinc",          label:"Zinc",     time:"เช้า" },
    { key:"Vit C (เย็น)", label:"Vit C",    time:"เย็น" },
    { key:"Fish Oil",      label:"Fish Oil", time:"เย็น" },
  ],
  weekend: [
    { key:"Vit C (เช้า)", label:"Vit C",    time:"เช้า" },
    { key:"Zinc",          label:"Zinc",     time:"เช้า" },
    { key:"Vit C (เย็น)", label:"Vit C",    time:"เย็น" },
    { key:"Fish Oil",      label:"Fish Oil", time:"เย็น" },
    { key:"Vit D",         label:"Vit D",   time:"เย็น" },
  ],
};

// ===== HABIT CONSTANTS (โฟกัสแค่ 6 ตัวที่สำคัญจริงๆ) =====
const HABIT_CHECKS = ["8 hr. Sleep","Water 2 lt.","Workout","Reading","Content","No Coffee"];

const HABIT_META = {
  "8 hr. Sleep": { icon:"😴", label:"8 hr. Sleep" },
  "Water 2 lt.": { icon:"💧", label:"Water 2 lt." },
  "Workout":     { icon:"🏋️", label:"Workout" },
  "Reading":     { icon:"📖", label:"Reading" },
  "Content":     { icon:"📹", label:"Content" },
  "No Coffee":   { icon:"☕", label:"Coffee No-Buy", saving:50 },
};

// Cardio Log — จดบันทึกเฉยๆ ไม่ผูกกับ habit/gamification ใดๆ
const CARDIO_LOG_FIELDS = [
  { key:"Run km",     icon:"🏃", label:"ระยะวิ่ง",   unit:"km",  step:"0.1" },
  { key:"Run min",    icon:"⏱️", label:"เวลาวิ่ง",   unit:"min", step:"1" },
  { key:"Run Avg HR", icon:"❤️", label:"HR เฉลี่ย",  unit:"bpm", step:"1" },
  { key:"Cardio min", icon:"🚴", label:"Cardio อื่นๆ", unit:"min", step:"5" },
];

const SAVING_PER_CUP = 50;

// Content-task stage tracker (Idea → Script → Film → Edit → Published), reuses Notion "Status" select
const CONTENT_STAGES = [
  { key:"IDEA",   label:"Idea" },
  { key:"SCRIPT", label:"Script" },
  { key:"FILM",   label:"Film" },
  { key:"EDIT",   label:"Edit" },
  { key:"PUBLISH",label:"Published" },
];

// ===== STATE =====
let apiBase          = localStorage.getItem("oat_api_base") || DEFAULT_API_BASE;
let todayHabitPageId = null;
let todayVitPageId   = null;
let routineData      = [];
let taskData         = [];
let gameState        = null;
let gameStatePageId  = null;

// ===== DATE UTILS =====
const todayStr  = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Bangkok" });
const today     = new Date(todayStr + "T00:00:00");
const isWeekend = today.getDay() === 0 || today.getDay() === 6;

// ===== UTILS =====
function daysDiff(ds) {
  if (!ds) return null;
  return Math.round((new Date(ds + "T00:00:00") - today) / 86400000);
}
function thaiDate(d) {
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const days   = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  const date   = new Date(dateStr(d) + "T00:00:00");
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}
function dateStr(d) { return d instanceof Date ? d.toISOString().slice(0,10) : d; }
function freqLabel(f) {
  return { weekly:"ทุกสัปดาห์", monthly:"ทุกเดือน", "3months":"ทุก 3 เดือน",
           "6months":"ทุก 6 เดือน", yearly:"ทุกปี" }[f] || f;
}
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `show ${type}`;
  setTimeout(() => { t.className = ""; }, 2500);
}
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ===== API =====
async function notionGet(path) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, { method:"GET" });
  return res.ok ? res.json() : null;
}
async function notionPost(path, body) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}
async function notionPatch(path, body) {
  if (!apiBase) return null;
  const res = await fetch(`${apiBase}/api${path}`, {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

function checkIcon() {
  return `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l3 3 5-5"/></svg>`;
}

// ===== SAVING COUNTER + QUIT STREAK STATE (Notion "Game State" DB — slimmed down) =====

async function loadGameState() {
  const data = await notionPost(`/databases/${DB.gameState}/query`, { page_size:1 });
  if (!data || !data.results) return;

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.gameState },
      properties: {
        Name:           { title:[{ text:{ content:"OAT" } }] },
        "Saving Total": { number:0 },
      },
    });
  }
  if (!page) return;

  gameStatePageId = page.id;
  parseGameState(page.properties);
  renderAll();
}

function parseGameState(props) {
  gameState = {
    savingTotal:      props["Saving Total"]?.number ?? 0,
    coffeeQuitSince:  props["Coffee Quit Since"]?.date?.start ?? null,
    alcoholQuitSince: props["Alcohol Quit Since"]?.date?.start ?? null,
  };
}

async function saveGameState(updates = {}) {
  if (!gameStatePageId || !gameState) return;
  Object.assign(gameState, updates);

  const props = {
    "Saving Total": { number: Math.max(0, gameState.savingTotal || 0) },
  };
  if (gameState.coffeeQuitSince)  props["Coffee Quit Since"]  = { date:{ start: gameState.coffeeQuitSince } };
  if (gameState.alcoholQuitSince) props["Alcohol Quit Since"] = { date:{ start: gameState.alcoholQuitSince } };

  await notionPatch(`/pages/${gameStatePageId}`, { properties: props });
  renderAll();
}

function renderAll() {
  renderSaving();
  renderQuitCounters();
}

function renderSaving() {
  if (!gameState) return;
  const total = gameState.savingTotal || 0;
  const cups  = Math.round(total / SAVING_PER_CUP);
  setEl("saving-total", `฿${total.toLocaleString()}`);
  setEl("saving-cups",  `${cups} แก้ว × ฿${SAVING_PER_CUP}`);
}

// ===== QUIT STREAK COUNTERS =====

const QUIT_KEYS = {
  coffee:  { stateKey:"coffeeQuitSince",  label:"หยุดกาแฟ" },
  alcohol: { stateKey:"alcoholQuitSince", label:"หยุดแอลกอฮอล์" },
};

function formatQuitElapsed(sinceIso) {
  if (!sinceIso) return null;
  const start = new Date(sinceIso);
  const diffMs = Math.max(0, Date.now() - start.getTime());
  const totalMin = Math.floor(diffMs / 60000);
  const days  = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins  = totalMin % 60;
  return `${days} วัน ${hours} ชม. ${mins} นาที`;
}

function renderQuitCounters() {
  if (!gameState) return;
  for (const key of Object.keys(QUIT_KEYS)) {
    const { stateKey } = QUIT_KEYS[key];
    const el  = document.getElementById(`quit-${key}-time`);
    const btn = document.getElementById(`quit-${key}-reset`);
    if (!el) continue;
    const since = gameState[stateKey];
    const elapsed = formatQuitElapsed(since);
    if (elapsed) {
      el.textContent = elapsed;
      el.classList.remove("unset");
    } else {
      el.textContent = "ยังไม่เริ่มนับ — กด Reset เพื่อเริ่ม";
      el.classList.add("unset");
    }
    if (btn) btn.textContent = since ? "Reset" : "เริ่มนับ";
  }
}

async function resetQuitCounter(key) {
  const cfg = QUIT_KEYS[key];
  if (!cfg || !gameState) return;
  const hadStart = !!gameState[cfg.stateKey];
  if (hadStart && !confirm(`รีเซ็ตตัวนับ "${cfg.label}" เป็น 0 เลยไหมคะ?`)) return;
  const btn = document.getElementById(`quit-${key}-reset`);
  if (btn) { btn.disabled = true; }
  await saveGameState({ [cfg.stateKey]: new Date().toISOString() });
  if (btn) { btn.disabled = false; }
  showToast(`⏳ เริ่มนับ${cfg.label}ใหม่แล้ว`);
}

document.getElementById("quit-coffee-reset").addEventListener("click", () => resetQuitCounter("coffee"));
document.getElementById("quit-alcohol-reset").addEventListener("click", () => resetQuitCounter("alcohol"));
setInterval(renderQuitCounters, 60000);

// ===== HABITS =====

async function loadHabits() {
  const el   = document.getElementById("habit-list");
  const data = await notionPost(`/databases/${DB.habitTracker}/query`, {
    filter: { property:"Date", date:{ equals: todayStr } }, page_size:1,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.habitTracker },
      properties: {
        Name: { title:[{ text:{ content: todayStr } }] },
        Date: { date:{ start: todayStr } },
      },
    });
  }
  if (!page) { el.innerHTML = `<div class="empty">สร้าง entry ไม่ได้</div>`; return; }
  todayHabitPageId = page.id;
  renderHabits(page.properties);
  renderCardioLog(page.properties);
}

function countHabitsDone(props) {
  let done = 0;
  for (const k of HABIT_CHECKS) if (props[k]?.checkbox) done++;
  return done;
}

function renderHabitCheck(key, props) {
  const meta    = HABIT_META[key];
  const checked = props[key]?.checkbox ?? false;
  const chips   = meta.saving ? `<span class="xp-chip save-chip">฿+${meta.saving}</span>` : "";
  return `
      <div class="check-row${checked?" checked":""}" data-type="habit" data-key="${key}" data-checked="${checked}">
        <div class="check-box">${checkIcon()}</div>
        <div class="check-label">${meta.icon} ${meta.label}</div>
        ${chips}
      </div>`;
}

function renderHabits(props) {
  const el  = document.getElementById("habit-list");
  let html = "";
  for (const key of HABIT_CHECKS) html += renderHabitCheck(key, props);
  el.innerHTML = html;
  document.getElementById("habit-count").textContent = `${countHabitsDone(props)}/${HABIT_CHECKS.length}`;

  el.querySelectorAll(".check-row[data-type=habit]").forEach(row => {
    row.addEventListener("click", () => toggleHabit(row));
  });
}

function renderCardioLog(props) {
  const el = document.getElementById("cardio-log-list");
  if (!el) return;
  let html = "";
  for (const f of CARDIO_LOG_FIELDS) {
    const val = props[f.key]?.number ?? 0;
    html += `
      <div class="num-row run-detail-row${val > 0 ? " done" : ""}">
        <div class="num-label">${f.icon} ${f.label}</div>
        <div class="num-input-wrap">
          <input class="num-input run-detail-input" type="number" inputmode="decimal"
            data-key="${f.key}" data-prev="${val}"
            value="${val || ""}" placeholder="0" min="0" step="${f.step}" />
          <span class="num-unit">${f.unit}</span>
        </div>
      </div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll(".run-detail-input").forEach(input => {
    input.addEventListener("change", () => updateRunDetail(input));
    input.addEventListener("blur",   () => updateRunDetail(input));
  });
}

async function updateRunDetail(input) {
  if (!todayHabitPageId) return;
  const key    = input.dataset.key;
  const newVal = parseFloat(input.value) || 0;
  if (newVal === (parseFloat(input.dataset.prev) || 0)) return;
  input.dataset.prev = newVal;

  const res = await notionPatch(`/pages/${todayHabitPageId}`, {
    properties: { [key]: { number: newVal > 0 ? newVal : null } },
  });
  if (!res) { showToast("บันทึกไม่สำเร็จ", "error"); return; }
  input.closest(".run-detail-row")?.classList.toggle("done", newVal > 0);
}

async function toggleHabit(row) {
  if (!todayHabitPageId) return;
  const key    = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal;
  row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayHabitPageId}`, {
    properties: { [key]:{ checkbox: newVal } },
  });
  if (!res) {
    row.dataset.checked = !newVal; row.classList.toggle("checked", !newVal);
    showToast("บันทึกไม่สำเร็จ", "error"); return;
  }

  const meta = HABIT_META[key];
  if (meta.saving && gameState) {
    gameState.savingTotal = Math.max(0, (gameState.savingTotal||0) + (newVal ? meta.saving : -meta.saving));
    await saveGameState({ savingTotal: gameState.savingTotal });
    showToast(newVal ? `${meta.icon} ${meta.label}  ฿+${meta.saving}` : `↩ ${meta.label}`);
  } else {
    showToast(newVal ? `${meta.icon} ${meta.label}` : `↩ ${meta.label}`);
  }

  renderHabits(res.properties);
  loadFocus();
}

// ===== HABIT SUMMARY 7 วัน =====
async function loadHabitSummary() {
  const el = document.getElementById("habit-summary");
  const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const startStr = sevenAgo.toISOString().slice(0, 10);

  const data = await notionPost(`/databases/${DB.habitTracker}/query`, {
    filter: { and:[
      { property:"Date", date:{ on_or_after: startStr } },
      { property:"Date", date:{ on_or_before: todayStr } },
    ]},
    sorts: [{ property:"Date", direction:"ascending" }], page_size:7,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  const dayMap = {};
  for (const p of data.results) {
    const d = p.properties?.Date?.date?.start;
    if (d) dayMap[d] = p.properties;
  }
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  let html = "";
  for (const key of HABIT_CHECKS) {
    const label = HABIT_META[key]?.label || key;
    let count = 0, dots = "";
    days.forEach(day => {
      const props   = dayMap[day];
      const checked = props?.[key]?.checkbox || false;
      if (checked) count++;
      dots += `<span class="dot ${checked?"done":"miss"}${day===todayStr?" today-dot":""}" title="${day}"></span>`;
    });
    const pct   = count / 7;
    const emoji = pct>=1?"🔥":pct>=0.71?"🟢":pct>=0.43?"🟡":count>0?"🔴":"⚪";
    html += `
      <div class="summary-row">
        <div class="summary-label">${label}</div>
        <div class="summary-dots">${dots}</div>
        <div class="summary-score">${count}/7 ${emoji}</div>
      </div>`;
  }
  el.innerHTML = html;
}

// ===== VITAMIN STREAK =====
async function loadVitaminStreak() {
  const data = await notionPost(`/databases/${DB.vitaminLog}/query`, {
    sorts:[{ property:"Date", direction:"descending" }], page_size:60,
  });
  if (!data || !data.results) return;

  const vitMap = {};
  for (const p of data.results) {
    const dateVal = p.properties?.Date?.title?.map(t=>t.plain_text).join("") || "";
    if (!dateVal) continue;
    const d  = new Date(dateVal);
    const sc = (d.getDay()===0||d.getDay()===6) ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
    vitMap[dateVal] = sc.every(v => p.properties?.[v.key]?.checkbox===true);
  }

  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const ds = cur.toISOString().slice(0,10);
    if (vitMap[ds]===true) { streak++; cur.setDate(cur.getDate()-1); } else break;
  }

  const el = document.getElementById("vit-streak");
  if (!el) return;
  const msgs = [[0,"😐","เริ่มวันนี้เลย"],[4,"🙂","กำลังไปได้ดี"],[7,"😊","ทำต่อไป!"],[14,"💪","สัปดาห์แรกผ่านแล้ว"],[30,"😄","วินัยดีมาก"],[Infinity,"🏆","ยอดเยี่ยม!"]];
  const [,emoji,msg] = msgs.slice().reverse().find(([m]) => streak>=m)||msgs[0];
  const barPct   = Math.min(streak/30*100,100);
  const barColor = streak<4?"var(--red)":streak<7?"var(--amber)":"var(--green)";
  el.innerHTML = `
    <div class="streak-display">
      <span class="streak-emoji">${emoji}</span>
      <span class="streak-num">${streak}</span>
      <span class="streak-label">วันติดต่อกัน</span>
      <span class="streak-msg">${msg}</span>
    </div>
    <div class="streak-bar-bg">
      <div class="streak-bar-fill" style="width:${barPct}%;background:${barColor}"></div>
    </div>`;
}

// ===== VITAMINS =====
async function loadVitamins() {
  const el   = document.getElementById("vit-list");
  const data = await notionPost(`/databases/${DB.vitaminLog}/query`, {
    filter: { property:"Date", title:{ equals: todayStr } }, page_size:1,
  });
  if (!data || !data.results) { el.innerHTML=`<div class="empty">โหลดไม่ได้</div>`; return; }

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.vitaminLog },
      properties: { Date:{ title:[{ text:{ content:todayStr } }] } },
    });
  }
  if (!page) { el.innerHTML=`<div class="empty">สร้าง entry ไม่ได้</div>`; return; }
  todayVitPageId = page.id;
  renderVitamins(page.properties);
}

function renderVitamins(props) {
  const el       = document.getElementById("vit-list");
  const schedule = isWeekend ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
  let done=0, html="";
  for (const vit of schedule) {
    const checked = props[vit.key]?.checkbox||false;
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
  const key    = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal; row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayVitPageId}`, { properties:{ [key]:{ checkbox:newVal } } });
  if (res) {
    showToast(newVal ? `💊 ${key}` : `↩ ${key}`);
    renderVitamins(res.properties);
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

// ===== ROUTINES =====
async function loadRoutines() {
  const el   = document.getElementById("routine-list");
  const data = await notionPost(`/databases/${DB.routines}/query`, {
    sorts:[{ property:"Next Due", direction:"ascending" }], page_size:50,
  });
  if (!data || !data.results) { el.innerHTML=`<div class="empty">โหลดไม่ได้</div>`; return; }
  routineData = data.results;
  const endOfMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().slice(0,10);
  renderRoutines(routineData.filter(r => {
    const nd = r.properties["Next Due"]?.formula?.date?.start||null;
    return nd && nd <= endOfMonth;
  }));
  loadFocus();
}

function renderRoutines(routines) {
  const el = document.getElementById("routine-list");
  if (!routines.length) {
    el.innerHTML=`<div class="empty">ไม่มี Routines ที่ต้องทำเดือนนี้ 🎉</div>`;
    document.getElementById("routine-count").textContent="0"; return;
  }
  let html="";
  for (const r of routines) {
    const p=r.properties;
    const name=p.Name?.title?.map(t=>t.plain_text).join("")||"";
    const cat=p.Category?.select?.name||"อื่นๆ";
    const freq=p.Frequency?.select?.name||"";
    const nextDue=p["Next Due"]?.formula?.date?.start||null;
    const diff=daysDiff(nextDue);
    let nextLabel="ยังไม่ได้ตั้งวัน",nextClass="";
    if (nextDue) {
      if (diff<0)       { nextLabel=`เลยกำหนด ${Math.abs(diff)} วัน`; nextClass="overdue"; }
      else if (diff===0){ nextLabel="ครบวันนี้"; nextClass="soon"; }
      else if (diff<=7) { nextLabel=`อีก ${diff} วัน (${thaiDate(nextDue)})`; nextClass="soon"; }
      else              { nextLabel=thaiDate(nextDue); }
    }
    html+=`
      <div class="routine-row" data-id="${r.id}">
        <div class="routine-info">
          <div class="routine-name"><span class="cat-chip cat-${cat}">${cat}</span>${name}</div>
          <div class="routine-next ${nextClass}">${nextLabel}</div>
        </div>
        <span class="routine-freq">${freqLabel(freq)}</span>
        <button class="done-btn" onclick="markRoutineDone('${r.id}',this)">Done</button>
      </div>`;
  }
  el.innerHTML=html;
  document.getElementById("routine-count").textContent=routines.length;
}

function calcNextDue(freq, fromDate) {
  const d=new Date(fromDate+"T00:00:00");
  if (freq==="weekly") d.setDate(d.getDate()+7);
  else if (freq==="monthly") d.setMonth(d.getMonth()+1);
  else if (freq==="3months") d.setMonth(d.getMonth()+3);
  else if (freq==="6months") d.setMonth(d.getMonth()+6);
  else if (freq==="yearly")  d.setFullYear(d.getFullYear()+1);
  return d.toISOString().slice(0,10);
}

async function markRoutineDone(pageId, btn) {
  btn.disabled=true; btn.textContent="...";
  const r=routineData.find(r=>r.id===pageId);
  const freq=r?.properties?.Frequency?.select?.name||"";
  const nd=freq?calcNextDue(freq,todayStr):null;
  const props={"Last Done":{date:{start:todayStr}}};
  if (nd) props["Next Due Date"]={date:{start:nd}};
  const res=await notionPatch(`/pages/${pageId}`,{properties:props});
  if (res) { showToast("✅ บันทึกแล้ว"); await loadRoutines(); }
  else { showToast("บันทึกไม่สำเร็จ","error"); btn.disabled=false; btn.textContent="Done"; }
}

// ===== TASKS =====

function isContentTask(props) {
  const tags = (props.Tags?.multi_select || []).map(t => t.name);
  return tags.includes("Youtube") || tags.includes("Tiktok");
}

function renderContentStages(taskId, status) {
  const curIdx = CONTENT_STAGES.findIndex(s => s.key === status);
  let html = `<div class="content-stages" data-id="${taskId}">`;
  CONTENT_STAGES.forEach((s, i) => {
    const done = curIdx >= 0 && i <= curIdx;
    html += `<div class="stage-check${done?" done":""}" data-stage="${s.key}" title="${s.label}">${checkIcon()}<span class="stage-label">${s.label}</span></div>`;
  });
  html += `</div>`;
  return html;
}

async function loadTasks() {
  const el=document.getElementById("task-list");
  const data=await notionPost(`/databases/${DB.tasks}/query`,{
    filter:{property:"Done",checkbox:{equals:false}},
    sorts:[{property:"Due Date",direction:"ascending"}], page_size:20,
  });
  if (!data||!data.results) { el.innerHTML=`<div class="empty">โหลดไม่ได้</div>`; return; }
  taskData=data.results; loadFocus();
  const visible=data.results.filter(r=>{const due=r.properties["Due Date"]?.date?.start; return due&&daysDiff(due)<=3;});
  if (!visible.length) {
    el.innerHTML=`<div class="empty">ไม่มี Tasks ใน 3 วันข้างหน้า 🎉</div>`;
    document.getElementById("task-count").textContent="0"; return;
  }
  let html="";
  for (const r of visible) {
    const p=r.properties;
    const name=p.Name?.title?.map(t=>t.plain_text).join("")||"";
    const dueDate=p["Due Date"]?.date?.start||null;
    const status=p.Status?.select?.name||"";
    const diff=daysDiff(dueDate);
    let dueLabel=thaiDate(dueDate),dueClass="";
    if (diff<0) { dueLabel=`เลยกำหนด ${Math.abs(diff)} วัน`; dueClass="overdue"; }
    else if (diff===0) { dueLabel="Due วันนี้"; dueClass="soon"; }

    if (isContentTask(p)) {
      html+=`
      <div class="task-row content-task-row" data-id="${r.id}">
        <div class="task-info">
          <div class="task-name">${name}</div>
          <div class="task-meta ${dueClass}">${dueLabel}</div>
        </div>
        ${renderContentStages(r.id, status)}
      </div>`;
    } else {
      const sc=status==="IN PROGRESS"?"in-progress":"todo";
      const sl=status==="IN PROGRESS"?"In Progress":(status||"To Do");
      html+=`
      <div class="task-row" data-id="${r.id}">
        <div class="task-info">
          <div class="task-name">${name}</div>
          <div class="task-meta ${dueClass}">${dueLabel}</div>
        </div>
        <span class="status-chip ${sc}">${sl}</span>
        <button class="done-btn" onclick="markTaskDone('${r.id}',this)">Done</button>
      </div>`;
    }
  }
  el.innerHTML=html;
  document.getElementById("task-count").textContent=visible.length;

  el.querySelectorAll(".stage-check").forEach(node => {
    node.addEventListener("click", () => {
      const taskId = node.closest(".content-stages").dataset.id;
      updateTaskStage(taskId, node.dataset.stage);
    });
  });
}

async function updateTaskStage(taskId, stageKey) {
  const props = { Status: { select: { name: stageKey } } };
  if (stageKey === "PUBLISH") props.Done = { checkbox: true };
  const res = await notionPatch(`/pages/${taskId}`, { properties: props });
  if (res) {
    showToast(stageKey === "PUBLISH" ? "🎬 Published! Task เสร็จแล้ว" : `📌 ${stageKey}`);
    await loadTasks();
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

async function markTaskDone(pageId, btn) {
  btn.disabled=true; btn.textContent="...";
  const res=await notionPatch(`/pages/${pageId}`,{properties:{Done:{checkbox:true}}});
  if (res) { showToast("✅ Task เสร็จแล้ว"); await loadTasks(); loadFocus(); }
  else { showToast("บันทึกไม่สำเร็จ","error"); btn.disabled=false; btn.textContent="Done"; }
}

// ===== FOCUS NOW =====
function loadFocus() {
  const el=document.getElementById("focus-list");
  const items=[];
  for (const r of taskData) {
    const p=r.properties;
    const name=p.Name?.title?.map(t=>t.plain_text).join("")||"";
    const due=p["Due Date"]?.date?.start||null;
    const diff=daysDiff(due);
    if (diff===null||diff>3) continue;
    items.push({name,diff,meta:diff<0?`Task — เลยกำหนด ${Math.abs(diff)} วัน`:diff===0?"Task — Due วันนี้":`Task — Due อีก ${diff} วัน (${thaiDate(due)})`});
  }
  for (const r of routineData) {
    const p=r.properties;
    const name=p.Name?.title?.map(t=>t.plain_text).join("")||"";
    const nd=p["Next Due"]?.formula?.date?.start||null;
    const diff=daysDiff(nd);
    if (diff===null||diff>3) continue;
    items.push({name,diff,meta:diff<0?`Routine — เลย ${Math.abs(diff)} วัน`:diff===0?"Routine — ครบวันนี้":`Routine — อีก ${diff} วัน`});
  }
  items.sort((a,b)=>a.diff-b.diff);
  if (!items.length) {
    el.innerHTML=`<div class="empty">ไม่มีงานเร่งด่วน 🎉</div>`;
    document.getElementById("focus-count").textContent="0"; return;
  }
  let html="";
  for (const item of items) {
    const cls=item.diff<0?"overdue":item.diff===0?"today":"soon";
    const badge=item.diff<0?"เลยกำหนด":item.diff===0?"วันนี้":`${item.diff}d`;
    html+=`
      <div class="focus-card ${cls}">
        <div class="focus-dot"></div>
        <div class="focus-info">
          <div class="focus-name">${item.name}</div>
          <div class="focus-meta">${item.meta}</div>
        </div>
        <span class="focus-badge">${badge}</span>
      </div>`;
  }
  el.innerHTML=html;
  document.getElementById("focus-count").textContent=items.length;
}

// ===== HEADER DATE =====
function setHeaderDate() {
  const d=new Date();
  const days=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  document.getElementById("header-date").textContent=`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}

// ===== THEME =====
function initTheme() {
  const saved=localStorage.getItem("oat_theme")||"dark";
  document.documentElement.dataset.theme=saved; updateThemeIcon(saved);
}
function updateThemeIcon(t) {
  document.getElementById("icon-sun").style.display  = t==="dark"  ? "block" : "none";
  document.getElementById("icon-moon").style.display = t==="light" ? "block" : "none";
}
document.getElementById("theme-btn").addEventListener("click", () => {
  const cur=document.documentElement.dataset.theme;
  const next=cur==="dark"?"light":"dark";
  document.documentElement.dataset.theme=next;
  localStorage.setItem("oat_theme",next); updateThemeIcon(next);
});

// ===== SETUP =====
document.getElementById("setup-btn").addEventListener("click", () => {
  const b=document.getElementById("setup-banner");
  b.style.display=b.style.display==="none"?"block":"none";
  document.getElementById("api-url-input").value=apiBase;
});
document.getElementById("setup-save").addEventListener("click", () => {
  const val=document.getElementById("api-url-input").value.trim().replace(/\/$/,"");
  if (!val) return;
  apiBase=val; localStorage.setItem("oat_api_base",val);
  document.getElementById("setup-banner").style.display="none";
  showToast("✅ บันทึก API URL แล้ว"); loadAll();
});

// ===== REFRESH =====
document.getElementById("refresh-btn").addEventListener("click", loadAll);

// ===== INIT =====
function loadAll() {
  if (!apiBase) {
    document.getElementById("setup-banner").style.display="block";
    ["focus-list","habit-list","vit-list","routine-list","task-list"].forEach(id=>{
      document.getElementById(id).innerHTML=`<div class="empty">ยังไม่ได้ตั้งค่า API URL</div>`;
    }); return;
  }
  loadGameState();
  loadHabits();
  loadHabitSummary();
  loadVitamins();
  loadVitaminStreak();
  loadRoutines();
  loadTasks();
}

initTheme();
setHeaderDate();
loadAll();

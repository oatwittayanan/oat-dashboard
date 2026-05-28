// OAT Dashboard — app.js v2 (Gamification)

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

// ===== HABIT CONSTANTS =====
const HABIT_CHECKS = ["8 hr. Sleep","Water 2 lt.","Weight Training","Reading","Content","Cook","No Coffee"];
const HABIT_NUMS   = ["Run km","Cardio min"];

const HABIT_META = {
  "8 hr. Sleep":     { icon:"😴", label:"8 hr. Sleep",    hpRecover:20 },
  "Water 2 lt.":     { icon:"💧", label:"Water 2 lt.",    hpRecover:10 },
  "Weight Training": { icon:"🏋️", label:"Weight Training", stat:"STR", xp:15 },
  "Reading":         { icon:"📖", label:"Reading",          stat:"INT", xp:10 },
  "Content":         { icon:"📹", label:"Content",          stat:"CHA", xp:15 },
  "Cook":            { icon:"🍳", label:"ทำอาหารเอง",       stat:"ORD", xp:10, hpBonus:5 },
  "No Coffee":       { icon:"☕", label:"ไม่ซื้อกาแฟ",      stat:"ORD", xp:10, saving:50 },
  "Run km":          { icon:"🏃", label:"วิ่ง",             stat:"STR", xpPer:10, per:5, marathon:true },
  "Cardio min":      { icon:"🚴", label:"Cardio",           stat:"STR", xpPer:5,  per:15 },
};

// ===== GAME CONSTANTS =====
const HP_DRAIN_PER_DAY  = 15;
const HP_MAX            = 100;
const XP_PER_LEVEL      = 1000;
const PERFECT_DAY_BONUS = 50;
const SAVING_PER_CUP    = 50;

const MARATHON_TIERS = [
  { tier:1, name:"Starter",    km:5,  badge:"🌱", bonus:0   },
  { tier:2, name:"Jogger",     km:10, badge:"👟", bonus:50  },
  { tier:3, name:"Runner",     km:15, badge:"🏃", bonus:100 },
  { tier:4, name:"Pacer",      km:20, badge:"⚡", bonus:150 },
  { tier:5, name:"Racer",      km:30, badge:"🔥", bonus:200 },
  { tier:6, name:"Marathoner", km:40, badge:"🏅", bonus:300 },
  { tier:7, name:"Champion",   km:50, badge:"🥇", bonus:500 },
];

const LEVEL_TITLES = [
  { min:1,  title:"มือใหม่"        },
  { min:3,  title:"กำลังสตาร์ท"   },
  { min:5,  title:"มีวินัย"        },
  { min:8,  title:"Consistent"     },
  { min:10, title:"The Investor"   },
  { min:15, title:"Marathon Trainee" },
  { min:20, title:"Content Creator" },
  { min:30, title:"ผู้เชี่ยวชาญ"  },
  { min:50, title:"ตำนาน"          },
];

// ===== STATE =====
let apiBase         = localStorage.getItem("oat_api_base") || DEFAULT_API_BASE;
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

function getWeekStart(ds) {
  const d   = new Date(ds + "T00:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

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
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ""; }, 2500);
}

function statKey(stat) {
  return { STR:"xpStr", INT:"xpInt", CHA:"xpCha", ORD:"xpOrd" }[stat] || null;
}

function getLevelTitle(level) {
  let title = LEVEL_TITLES[0].title;
  for (const t of LEVEL_TITLES) { if (level >= t.min) title = t.title; }
  return title;
}

function getHPState(hp) {
  if (hp > 80) return { emoji:"💚", label:"Vitalized", xpMult:1.1 };
  if (hp > 50) return { emoji:"💛", label:"Normal",    xpMult:1.0 };
  if (hp > 20) return { emoji:"🟠", label:"Tired",     xpMult:0.75 };
  if (hp > 0)  return { emoji:"🔴", label:"Exhausted", xpMult:0.5  };
  return              { emoji:"💀", label:"Broken",    xpMult:0.25 };
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

// ===== GAMIFICATION ENGINE =====

async function loadGameState() {
  const data = await notionPost(`/databases/${DB.gameState}/query`, { page_size:1 });
  if (!data || !data.results) return;

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.gameState },
      properties: {
        Name:             { title:[{ text:{ content:"OAT" } }] },
        HP:               { number:100 },
        "XP STR":         { number:0 },
        "XP INT":         { number:0 },
        "XP CHA":         { number:0 },
        "XP ORD":         { number:0 },
        "Total XP":       { number:0 },
        Level:            { number:1 },
        Streak:           { number:0 },
        "Marathon Tier":  { number:1 },
        "Marathon Total": { number:0 },
        "Weekly km":      { number:0 },
        "Week Start":     { date:{ start: getWeekStart(todayStr) } },
        "Saving Total":   { number:0 },
        "Start Date":     { date:{ start: todayStr } },
      },
    });
  }
  if (!page) return;

  gameStatePageId = page.id;
  parseGameState(page.properties);
  await applyDailyDrain();
  await checkMarathonWeek();
  renderCharacter();
  renderMarathon();
  renderSaving();
}

function parseGameState(props) {
  gameState = {
    hp:            props.HP?.number            ?? 100,
    xpStr:         props["XP STR"]?.number     ?? 0,
    xpInt:         props["XP INT"]?.number     ?? 0,
    xpCha:         props["XP CHA"]?.number     ?? 0,
    xpOrd:         props["XP ORD"]?.number     ?? 0,
    totalXp:       props["Total XP"]?.number   ?? 0,
    level:         props.Level?.number         ?? 1,
    streak:        props.Streak?.number        ?? 0,
    lastActive:    props["Last Active"]?.date?.start ?? null,
    marathonTier:  props["Marathon Tier"]?.number  ?? 1,
    marathonTotal: props["Marathon Total"]?.number ?? 0,
    weeklyKm:      props["Weekly km"]?.number  ?? 0,
    weekStart:     props["Week Start"]?.date?.start ?? getWeekStart(todayStr),
    savingTotal:   props["Saving Total"]?.number ?? 0,
    _streakUpdated: false,
  };
}

async function saveGameState(updates = {}) {
  if (!gameStatePageId || !gameState) return;
  Object.assign(gameState, updates);
  gameState.hp    = Math.round(Math.min(HP_MAX, Math.max(0, gameState.hp)));
  gameState.level = Math.floor(gameState.totalXp / XP_PER_LEVEL) + 1;

  const props = {
    HP:               { number: gameState.hp },
    "XP STR":         { number: Math.max(0, gameState.xpStr) },
    "XP INT":         { number: Math.max(0, gameState.xpInt) },
    "XP CHA":         { number: Math.max(0, gameState.xpCha) },
    "XP ORD":         { number: Math.max(0, gameState.xpOrd) },
    "Total XP":       { number: Math.max(0, gameState.totalXp) },
    Level:            { number: gameState.level },
    Streak:           { number: Math.max(0, gameState.streak) },
    "Marathon Tier":  { number: gameState.marathonTier },
    "Marathon Total": { number: Math.max(0, gameState.marathonTotal) },
    "Weekly km":      { number: Math.max(0, gameState.weeklyKm) },
    "Saving Total":   { number: Math.max(0, gameState.savingTotal) },
  };
  if (gameState.lastActive) props["Last Active"] = { date:{ start: gameState.lastActive } };
  if (gameState.weekStart)  props["Week Start"]  = { date:{ start: gameState.weekStart } };

  await notionPatch(`/pages/${gameStatePageId}`, { properties: props });
  renderCharacter();
  renderMarathon();
  renderSaving();
}

async function applyDailyDrain() {
  if (!gameState) return;
  const drainKey = `oat_drain_${todayStr}`;
  if (localStorage.getItem(drainKey)) return;
  localStorage.setItem(drainKey, "1");

  if (gameState.lastActive && gameState.lastActive < todayStr) {
    const last     = new Date(gameState.lastActive + "T00:00:00");
    const diffDays = Math.max(0, Math.floor((today - last) / 86400000) - 1);
    if (diffDays > 0) {
      gameState.hp = Math.max(0, gameState.hp - HP_DRAIN_PER_DAY * diffDays);
      await notionPatch(`/pages/${gameStatePageId}`, {
        properties: { HP:{ number: gameState.hp } },
      });
    }
  }
}

async function checkMarathonWeek() {
  if (!gameState) return;
  const curWeekStart = getWeekStart(todayStr);
  if (gameState.weekStart === curWeekStart) return;

  const prevTier = MARATHON_TIERS[Math.min(gameState.marathonTier - 1, 6)];
  const advTier  = MARATHON_TIERS[Math.min(gameState.marathonTier, 6)];
  const wkm      = gameState.weeklyKm || 0;

  let newTier = gameState.marathonTier;
  if (advTier && wkm >= advTier.km) newTier = Math.min(7, gameState.marathonTier + 1);
  else if (wkm < prevTier.km)       newTier = Math.max(1, gameState.marathonTier - 1);

  const bonusXP    = MARATHON_TIERS[newTier - 1].bonus;
  const tierChanged = newTier !== gameState.marathonTier;

  gameState.marathonTier = newTier;
  gameState.weeklyKm     = 0;
  gameState.weekStart    = curWeekStart;
  if (bonusXP > 0) { gameState.totalXp += bonusXP; gameState.xpStr += bonusXP; }

  await saveGameState({});
  if (tierChanged) {
    const t = MARATHON_TIERS[newTier - 1];
    showToast(`${t.badge} Marathon: ${t.name}!${bonusXP > 0 ? ` +${bonusXP} XP` : ""}`);
  }
}

function addHabitXP(key, checked) {
  if (!gameState) return 0;
  const meta = HABIT_META[key];
  if (!meta || !meta.stat || !meta.xp) return 0;

  const sk         = statKey(meta.stat);
  const storageKey = `oat_hxp_${todayStr}_${key}`;

  if (checked) {
    const applied = Math.round(meta.xp * getHPState(gameState.hp).xpMult);
    localStorage.setItem(storageKey, applied);
    if (sk) gameState[sk] = (gameState[sk] || 0) + applied;
    gameState.totalXp = (gameState.totalXp || 0) + applied;
    return applied;
  } else {
    const prev = parseInt(localStorage.getItem(storageKey) || meta.xp);
    localStorage.removeItem(storageKey);
    if (sk) gameState[sk] = Math.max(0, (gameState[sk] || 0) - prev);
    gameState.totalXp     = Math.max(0, (gameState.totalXp || 0) - prev);
    return -prev;
  }
}

function checkPerfectDay(props) {
  if (!gameState) return 0;
  const core    = ["8 hr. Sleep","Water 2 lt.","Reading","Content","Cook","No Coffee"];
  const coreDone    = core.every(h => props[h]?.checkbox === true);
  const hasExercise = props["Weight Training"]?.checkbox === true ||
                      (props["Run km"]?.number || 0) > 0 ||
                      (props["Cardio min"]?.number || 0) > 0;
  const pdKey   = `oat_pd_${todayStr}`;
  const wasDone = localStorage.getItem(pdKey);

  if (coreDone && hasExercise && !wasDone) {
    localStorage.setItem(pdKey, "1");
    gameState.totalXp += PERFECT_DAY_BONUS;
    gameState.xpStr   += 13; gameState.xpInt  += 13;
    gameState.xpCha   += 12; gameState.xpOrd  += 12;
    showToast(`🌟 Perfect Day! +${PERFECT_DAY_BONUS} XP`);
    return PERFECT_DAY_BONUS;
  }
  if ((!coreDone || !hasExercise) && wasDone) {
    localStorage.removeItem(pdKey);
    gameState.totalXp = Math.max(0, gameState.totalXp - PERFECT_DAY_BONUS);
    gameState.xpStr   = Math.max(0, gameState.xpStr - 13);
    gameState.xpInt   = Math.max(0, gameState.xpInt - 13);
    gameState.xpCha   = Math.max(0, gameState.xpCha - 12);
    gameState.xpOrd   = Math.max(0, gameState.xpOrd - 12);
    return -PERFECT_DAY_BONUS;
  }
  return 0;
}

function checkStreakUpdate() {
  if (!gameState || gameState._streakUpdated) return {};
  if (gameState.lastActive === todayStr) return {};
  gameState._streakUpdated = true;
  const updates = { lastActive: todayStr };
  if (!gameState.lastActive) {
    updates.streak = 1;
  } else {
    const diffDays = Math.round((today - new Date(gameState.lastActive + "T00:00:00")) / 86400000);
    updates.streak = diffDays === 1 ? (gameState.streak || 0) + 1 : 1;
  }
  return updates;
}

function checkVitaminHPBonus(props) {
  const schedule   = isWeekend ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
  const allDone    = schedule.every(v => props[v.key]?.checkbox === true);
  const vitKey     = `oat_vhp_${todayStr}`;
  const wasApplied = localStorage.getItem(vitKey);
  if (allDone && !wasApplied) { localStorage.setItem(vitKey, "1"); return 10; }
  if (!allDone && wasApplied) { localStorage.removeItem(vitKey);   return -10; }
  return 0;
}

// ===== RENDER CHARACTER =====
function renderCharacter() {
  if (!gameState) return;
  const level   = Math.floor(gameState.totalXp / XP_PER_LEVEL) + 1;
  const xpInLv  = gameState.totalXp % XP_PER_LEVEL;
  const xpPct   = (xpInLv / XP_PER_LEVEL) * 100;
  const hp      = Math.round(gameState.hp);
  const hpState = getHPState(hp);
  const hpPct   = (hp / HP_MAX) * 100;
  const hpColor = hp > 80 ? "var(--green)" : hp > 50 ? "var(--amber)" : hp > 20 ? "var(--orange)" : "var(--red)";

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("char-level",    `Lv.${level}`);
  set("char-title",    getLevelTitle(level));
  set("xp-label",      `${xpInLv.toLocaleString()} / ${XP_PER_LEVEL.toLocaleString()} XP`);
  set("hp-value-label",`${hp}/100`);
  set("hp-state-label",`${hpState.emoji} ${hpState.label}`);
  set("stat-str",      gameState.xpStr);
  set("stat-int",      gameState.xpInt);
  set("stat-cha",      gameState.xpCha);
  set("stat-ord",      gameState.xpOrd);
  set("char-streak",   gameState.streak > 0 ? `🔥 Streak ${gameState.streak} วัน` : "Streak 0 วัน — เริ่มเลย!");

  const xpBar = document.getElementById("xp-bar");
  if (xpBar) xpBar.style.width = `${xpPct.toFixed(1)}%`;

  const hpBar = document.getElementById("hp-bar");
  if (hpBar) { hpBar.style.width = `${Math.max(0, hpPct)}%`; hpBar.style.background = hpColor; }
}

function renderMarathon() {
  if (!gameState) return;
  const tier     = MARATHON_TIERS[Math.min(gameState.marathonTier - 1, 6)];
  const nextTier = MARATHON_TIERS[Math.min(gameState.marathonTier, 6)];
  const wkm      = gameState.weeklyKm || 0;
  const pct      = Math.min(100, (wkm / tier.km) * 100);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("marathon-tier-badge",  `${tier.badge} ${tier.name}`);
  set("marathon-week-km",     wkm.toFixed(1));
  set("marathon-week-target", tier.km);
  set("marathon-total-km",    `สะสม ${(gameState.marathonTotal || 0).toFixed(1)} km`);
  set("marathon-next-tier",   nextTier && nextTier.tier > tier.tier ? `⬆️ Advance: ${nextTier.km} km/week` : "🏆 Max Tier!");

  const bar = document.getElementById("marathon-week-bar");
  if (bar) { bar.style.width = `${pct}%`; bar.style.background = pct >= 100 ? "var(--green)" : "var(--blue)"; }
}

function renderSaving() {
  if (!gameState) return;
  const total = gameState.savingTotal || 0;
  const cups  = Math.round(total / SAVING_PER_CUP);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("saving-total", `฿${total.toLocaleString()}`);
  set("saving-cups",  `${cups} แก้ว × ฿${SAVING_PER_CUP}`);
}

// ===== HABITS =====
async function loadHabits() {
  const el   = document.getElementById("habit-list");
  const data = await notionPost(`/databases/${DB.habitTracker}/query`, {
    filter: { property:"Date", date:{ equals: todayStr } },
    page_size: 1,
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
}

function countHabitsDone(props) {
  let done = 0;
  for (const k of HABIT_CHECKS) if (props[k]?.checkbox) done++;
  for (const k of HABIT_NUMS)   if ((props[k]?.number || 0) > 0) done++;
  return done;
}

function renderHabits(props) {
  const el  = document.getElementById("habit-list");
  let html  = "";
  const total = HABIT_CHECKS.length + HABIT_NUMS.length;

  for (const key of HABIT_CHECKS) {
    const meta    = HABIT_META[key];
    const checked = props[key]?.checkbox ?? false;
    let chips = "";
    if (meta.xp)        chips += `<span class="xp-chip">${meta.stat} +${meta.xp}</span>`;
    if (meta.hpRecover) chips += `<span class="xp-chip hp-chip">HP +${meta.hpRecover}</span>`;
    if (meta.hpBonus)   chips += `<span class="xp-chip hp-chip">HP +${meta.hpBonus}</span>`;
    if (meta.saving)    chips += `<span class="xp-chip save-chip">฿+${meta.saving}</span>`;
    html += `
      <div class="check-row${checked?" checked":""}" data-type="habit" data-key="${key}" data-checked="${checked}">
        <div class="check-box">${checkIcon()}</div>
        <div class="check-label">${meta.icon} ${meta.label}</div>
        ${chips}
      </div>`;
  }

  for (const key of HABIT_NUMS) {
    const meta = HABIT_META[key];
    const val  = props[key]?.number ?? 0;
    const unit = key === "Run km" ? "km" : "min";
    const step = key === "Run km" ? "0.1" : "5";
    html += `
      <div class="num-row${val > 0 ? " done" : ""}">
        <div class="num-label">${meta.icon} ${meta.label}</div>
        <div class="num-input-wrap">
          <input class="num-input" type="number" inputmode="decimal"
            data-key="${key}" data-prev="${val}"
            value="${val || ""}" placeholder="0" min="0" step="${step}" />
          <span class="num-unit">${unit}</span>
        </div>
        <span class="xp-chip">${meta.stat} +${meta.xpPer}/${meta.per}${unit}</span>
      </div>`;
  }

  el.innerHTML = html;
  document.getElementById("habit-count").textContent = `${countHabitsDone(props)}/${total}`;

  el.querySelectorAll(".check-row[data-type=habit]").forEach(row => {
    row.addEventListener("click", () => toggleHabit(row));
  });
  el.querySelectorAll(".num-input").forEach(input => {
    input.addEventListener("change", () => updateHabitNumber(input));
    input.addEventListener("blur",   () => updateHabitNumber(input));
    input.addEventListener("click",  e  => e.stopPropagation());
  });
}

async function toggleHabit(row) {
  if (!todayHabitPageId) return;
  const key    = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal;
  row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayHabitPageId}`, {
    properties: { [key]: { checkbox: newVal } },
  });
  if (!res) {
    row.dataset.checked = !newVal;
    row.classList.toggle("checked", !newVal);
    showToast("บันทึกไม่สำเร็จ", "error");
    return;
  }

  const meta    = HABIT_META[key];
  const updates = { ...checkStreakUpdate() };
  const xpDelta = addHabitXP(key, newVal);

  let hpDelta = 0;
  if (meta.hpRecover) hpDelta += newVal ?  meta.hpRecover : -meta.hpRecover;
  if (meta.hpBonus)   hpDelta += newVal ?  meta.hpBonus   : -meta.hpBonus;
  if (hpDelta !== 0) {
    gameState.hp = Math.min(HP_MAX, Math.max(0, (gameState.hp || 0) + hpDelta));
    updates.hp   = gameState.hp;
  }
  if (meta.saving) {
    gameState.savingTotal = Math.max(0, (gameState.savingTotal || 0) + (newVal ? meta.saving : -meta.saving));
    updates.savingTotal   = gameState.savingTotal;
  }

  updates.totalXp = gameState.totalXp;
  const sk = statKey(meta.stat);
  if (sk) updates[sk] = gameState[sk];

  let toast = newVal
    ? `${meta.icon} ${meta.label}${Math.abs(xpDelta) > 0 ? ` +${Math.abs(xpDelta)} ${meta.stat}` : ""}${hpDelta > 0 ? ` +${hpDelta}HP` : ""}${meta.saving ? ` 💰+฿${meta.saving}` : ""}`
    : `↩ ${meta.label}`;
  showToast(toast);

  await saveGameState(updates);

  const pdDelta = checkPerfectDay(res.properties);
  if (pdDelta !== 0) await saveGameState({});

  renderHabits(res.properties);
  loadFocus();
}

async function updateHabitNumber(input) {
  if (!todayHabitPageId || !gameState) return;
  const key    = input.dataset.key;
  const newVal = parseFloat(input.value) || 0;
  const oldVal = parseFloat(input.dataset.prev) || 0;
  if (newVal === oldVal) return;
  input.dataset.prev = newVal;

  const res = await notionPatch(`/pages/${todayHabitPageId}`, {
    properties: { [key]: { number: newVal > 0 ? newVal : null } },
  });
  if (!res) { showToast("บันทึกไม่สำเร็จ", "error"); return; }

  const meta    = HABIT_META[key];
  const sk      = statKey(meta.stat);
  const oldXP   = Math.floor(oldVal / meta.per) * meta.xpPer;
  const newXP   = Math.floor(newVal / meta.per) * meta.xpPer;
  const xpDelta = newXP - oldXP;
  const updates = { ...checkStreakUpdate() };

  if (xpDelta !== 0 && sk) {
    gameState[sk]     = Math.max(0, (gameState[sk] || 0) + xpDelta);
    gameState.totalXp = Math.max(0, (gameState.totalXp || 0) + xpDelta);
    updates[sk]       = gameState[sk];
    updates.totalXp   = gameState.totalXp;
  }
  if (meta.marathon) {
    const kmDelta = newVal - oldVal;
    gameState.marathonTotal = Math.max(0, (gameState.marathonTotal || 0) + kmDelta);
    gameState.weeklyKm      = Math.max(0, (gameState.weeklyKm || 0) + kmDelta);
    updates.marathonTotal   = gameState.marathonTotal;
    updates.weeklyKm        = gameState.weeklyKm;
  }

  await saveGameState(updates);
  const pdDelta = checkPerfectDay(res.properties);
  if (pdDelta !== 0) await saveGameState({});

  const row = input.closest(".num-row");
  if (row) row.classList.toggle("done", newVal > 0);
  if (xpDelta > 0) showToast(`${meta.icon} +${xpDelta} STR`);

  document.getElementById("habit-count").textContent =
    `${countHabitsDone(res.properties)}/${HABIT_CHECKS.length + HABIT_NUMS.length}`;
  loadFocus();
}

// ===== HABIT SUMMARY 7 วัน =====
async function loadHabitSummary() {
  const el = document.getElementById("habit-summary");
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const startStr = sevenAgo.toISOString().slice(0, 10);

  const data = await notionPost(`/databases/${DB.habitTracker}/query`, {
    filter: { and:[
      { property:"Date", date:{ on_or_after:  startStr } },
      { property:"Date", date:{ on_or_before: todayStr } },
    ]},
    sorts: [{ property:"Date", direction:"ascending" }],
    page_size: 7,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  const dayMap = {};
  for (const p of data.results) {
    const d = p.properties?.Date?.date?.start;
    if (d) dayMap[d] = p.properties;
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const allHabits = [
    ...HABIT_CHECKS.map(k => ({ key:k, label:HABIT_META[k]?.label || k, num:false })),
    ...HABIT_NUMS.map(k   => ({ key:k, label:HABIT_META[k]?.label || k, num:true  })),
  ];

  let html = "";
  for (const { key, label, num } of allHabits) {
    let count = 0;
    let dots  = "";
    days.forEach(day => {
      const props   = dayMap[day];
      const checked = num ? (props?.[key]?.number || 0) > 0 : props?.[key]?.checkbox || false;
      if (checked) count++;
      dots += `<span class="dot ${checked?"done":"miss"}${day===todayStr?" today-dot":""}" title="${day}"></span>`;
    });
    const pct   = count / 7;
    const emoji = pct >= 1 ? "🔥" : pct >= 0.71 ? "🟢" : pct >= 0.43 ? "🟡" : count > 0 ? "🔴" : "⚪";
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
    sorts: [{ property:"Date", direction:"descending" }],
    page_size: 60,
  });
  if (!data || !data.results) return;

  const vitMap = {};
  for (const p of data.results) {
    const dateVal = p.properties?.Date?.title?.map(t => t.plain_text).join("") || "";
    if (!dateVal) continue;
    const d        = new Date(dateVal);
    const isWE     = d.getDay() === 0 || d.getDay() === 6;
    const schedule = isWE ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
    vitMap[dateVal] = schedule.every(v => p.properties?.[v.key]?.checkbox === true);
  }

  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const ds = cur.toISOString().slice(0, 10);
    if (vitMap[ds] === true) { streak++; cur.setDate(cur.getDate() - 1); } else break;
  }

  const el = document.getElementById("vit-streak");
  if (!el) return;
  let emoji, msg;
  if (streak === 0)     { emoji = "😐"; msg = "เริ่มวันนี้เลย"; }
  else if (streak < 4)  { emoji = "🙂"; msg = "กำลังไปได้ดี"; }
  else if (streak < 7)  { emoji = "😊"; msg = "ทำต่อไป!"; }
  else if (streak < 14) { emoji = "💪"; msg = "สัปดาห์แรกผ่านแล้ว"; }
  else if (streak < 30) { emoji = "😄"; msg = "วินัยดีมาก"; }
  else                  { emoji = "🏆"; msg = "ยอดเยี่ยม!"; }

  const barPct   = Math.min(streak / 30 * 100, 100);
  const barColor = streak < 4 ? "var(--red)" : streak < 7 ? "var(--amber)" : "var(--green)";
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
    filter: { property:"Date", title:{ equals: todayStr } },
    page_size: 1,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  let page = data.results[0];
  if (!page) {
    page = await notionPost("/pages", {
      parent: { database_id: DB.vitaminLog },
      properties: { Date:{ title:[{ text:{ content: todayStr } }] } },
    });
  }
  if (!page) { el.innerHTML = `<div class="empty">สร้าง entry ไม่ได้</div>`; return; }

  todayVitPageId = page.id;
  renderVitamins(page.properties);
}

function renderVitamins(props) {
  const el       = document.getElementById("vit-list");
  const schedule = isWeekend ? VITAMIN_SCHEDULE.weekend : VITAMIN_SCHEDULE.weekday;
  let done = 0, html = "";

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
  const key    = row.dataset.key;
  const newVal = row.dataset.checked !== "true";
  row.dataset.checked = newVal;
  row.classList.toggle("checked", newVal);

  const res = await notionPatch(`/pages/${todayVitPageId}`, {
    properties: { [key]:{ checkbox: newVal } },
  });
  if (res) {
    showToast(newVal ? `💊 ${key}` : `↩ ${key}`);
    renderVitamins(res.properties);
    const hpDelta = checkVitaminHPBonus(res.properties);
    if (hpDelta !== 0 && gameState && gameStatePageId) {
      gameState.hp = Math.min(HP_MAX, Math.max(0, gameState.hp + hpDelta));
      await saveGameState({ hp: gameState.hp });
      if (hpDelta > 0) showToast(`💊 วิตามินครบ! +${hpDelta} HP`);
    }
  } else {
    showToast("บันทึกไม่สำเร็จ", "error");
  }
}

// ===== ROUTINES =====
async function loadRoutines() {
  const el   = document.getElementById("routine-list");
  const data = await notionPost(`/databases/${DB.routines}/query`, {
    sorts: [{ property:"Next Due", direction:"ascending" }],
    page_size: 50,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  routineData = data.results;
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  renderRoutines(routineData.filter(r => {
    const nd = r.properties["Next Due"]?.formula?.date?.start || null;
    return nd && nd <= endOfMonth;
  }));
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
    const p       = r.properties;
    const name    = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const cat     = p.Category?.select?.name || "อื่นๆ";
    const freq    = p.Frequency?.select?.name || "";
    const nextDue = p["Next Due"]?.formula?.date?.start || null;
    const diff    = daysDiff(nextDue);
    let nextLabel = "ยังไม่ได้ตั้งวัน", nextClass = "";
    if (nextDue) {
      if (diff < 0)       { nextLabel = `เลยกำหนด ${Math.abs(diff)} วัน`; nextClass = "overdue"; }
      else if (diff === 0){ nextLabel = "ครบวันนี้"; nextClass = "soon"; }
      else if (diff <= 7) { nextLabel = `อีก ${diff} วัน (${thaiDate(nextDue)})`; nextClass = "soon"; }
      else                { nextLabel = thaiDate(nextDue); }
    }
    html += `
      <div class="routine-row" data-id="${r.id}">
        <div class="routine-info">
          <div class="routine-name"><span class="cat-chip cat-${cat}">${cat}</span>${name}</div>
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
  const d = new Date(fromDate + "T00:00:00");
  if (freq === "weekly")  d.setDate(d.getDate() + 7);
  else if (freq === "monthly")  d.setMonth(d.getMonth() + 1);
  else if (freq === "3months")  d.setMonth(d.getMonth() + 3);
  else if (freq === "6months")  d.setMonth(d.getMonth() + 6);
  else if (freq === "yearly")   d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

async function markRoutineDone(pageId, btn) {
  btn.disabled = true; btn.textContent = "...";
  const routine     = routineData.find(r => r.id === pageId);
  const freq        = routine?.properties?.Frequency?.select?.name || "";
  const nextDueDate = freq ? calcNextDue(freq, todayStr) : null;
  const props       = { "Last Done": { date:{ start: todayStr } } };
  if (nextDueDate) props["Next Due Date"] = { date:{ start: nextDueDate } };
  const res = await notionPatch(`/pages/${pageId}`, { properties: props });
  if (res) { showToast("✅ บันทึกแล้ว"); await loadRoutines(); }
  else { showToast("บันทึกไม่สำเร็จ", "error"); btn.disabled = false; btn.textContent = "Done"; }
}

// ===== TASKS =====
async function loadTasks() {
  const el   = document.getElementById("task-list");
  const data = await notionPost(`/databases/${DB.tasks}/query`, {
    filter: { property:"Done", checkbox:{ equals: false } },
    sorts:  [{ property:"Due Date", direction:"ascending" }],
    page_size: 20,
  });
  if (!data || !data.results) { el.innerHTML = `<div class="empty">โหลดไม่ได้</div>`; return; }

  taskData = data.results;
  loadFocus();

  const visible = data.results.filter(r => {
    const due = r.properties["Due Date"]?.date?.start;
    return due && daysDiff(due) <= 3;
  });

  if (!visible.length) {
    el.innerHTML = `<div class="empty">ไม่มี Tasks ใน 3 วันข้างหน้า 🎉</div>`;
    document.getElementById("task-count").textContent = "0";
    return;
  }

  let html = "";
  for (const r of visible) {
    const p       = r.properties;
    const name    = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const dueDate = p["Due Date"]?.date?.start || null;
    const status  = p.Status?.select?.name || "";
    const diff    = daysDiff(dueDate);
    let dueLabel  = thaiDate(dueDate), dueClass = "";
    if (diff < 0)       { dueLabel = `เลยกำหนด ${Math.abs(diff)} วัน`; dueClass = "overdue"; }
    else if (diff === 0){ dueLabel = "Due วันนี้"; dueClass = "soon"; }
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
  document.getElementById("task-count").textContent = visible.length;
}

async function markTaskDone(pageId, btn) {
  btn.disabled = true; btn.textContent = "...";
  const res = await notionPatch(`/pages/${pageId}`, { properties:{ Done:{ checkbox: true } } });
  if (res) { showToast("✅ Task เสร็จแล้ว"); await loadTasks(); loadFocus(); }
  else { showToast("บันทึกไม่สำเร็จ", "error"); btn.disabled = false; btn.textContent = "Done"; }
}

// ===== FOCUS NOW =====
function loadFocus() {
  const el    = document.getElementById("focus-list");
  const items = [];

  for (const r of taskData) {
    const p       = r.properties;
    const name    = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const dueDate = p["Due Date"]?.date?.start || null;
    const diff    = daysDiff(dueDate);
    if (diff === null || diff > 3) continue;
    items.push({ name, diff, meta: diff < 0 ? `Task — เลยกำหนด ${Math.abs(diff)} วัน` :
      diff === 0 ? "Task — Due วันนี้" : `Task — Due อีก ${diff} วัน (${thaiDate(dueDate)})` });
  }

  for (const r of routineData) {
    const p       = r.properties;
    const name    = p.Name?.title?.map(t=>t.plain_text).join("") || "";
    const nextDue = p["Next Due"]?.formula?.date?.start || null;
    const diff    = daysDiff(nextDue);
    if (diff === null || diff > 3) continue;
    items.push({ name, diff, meta: diff < 0 ? `Routine — เลย ${Math.abs(diff)} วัน` :
      diff === 0 ? "Routine — ครบวันนี้" : `Routine — อีก ${diff} วัน` });
  }

  items.sort((a, b) => a.diff - b.diff);

  if (!items.length) {
    el.innerHTML = `<div class="empty">ไม่มีงานเร่งด่วน 🎉</div>`;
    document.getElementById("focus-count").textContent = "0";
    return;
  }

  let html = "";
  for (const item of items) {
    const cls   = item.diff < 0 ? "overdue" : item.diff === 0 ? "today" : "soon";
    const badge = item.diff < 0 ? "เลยกำหนด" : item.diff === 0 ? "วันนี้" : `${item.diff}d`;
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
  const d      = new Date();
  const days   = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
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
  document.getElementById("icon-sun").style.display  = t === "dark"  ? "block" : "none";
  document.getElementById("icon-moon").style.display = t === "light" ? "block" : "none";
}
document.getElementById("theme-btn").addEventListener("click", () => {
  const cur  = document.documentElement.dataset.theme;
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

// OAT Dashboard — Circuit Timer

// ===== THEME (ใช้ localStorage key เดียวกับ dashboard หลัก) =====
function initTheme() {
  const saved = localStorage.getItem("oat_theme") || "dark";
  document.documentElement.dataset.theme = saved; updateThemeIcon(saved);
}
function updateThemeIcon(t) {
  document.getElementById("icon-sun").style.display  = t === "dark"  ? "block" : "none";
  document.getElementById("icon-moon").style.display = t === "light" ? "block" : "none";
}
document.getElementById("theme-btn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme;
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("oat_theme", next); updateThemeIcon(next);
});

function setHeaderDate() {
  const d = new Date();
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  document.getElementById("header-date").textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
}

// ===== SETTINGS PERSISTENCE =====
const SETTINGS_KEY = "oat_timer_settings";
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (saved) return saved;
  } catch (e) {}
  return { work: 30, rest: 15, sets: 8 };
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}

const workInput = document.getElementById("work-sec");
const restInput = document.getElementById("rest-sec");
const setsInput = document.getElementById("set-count");
{
  const s = loadSettings();
  workInput.value = s.work;
  restInput.value = s.rest;
  setsInput.value = s.sets;
}

// ===== AUDIO CUES (Web Audio API — ไม่ต้องใช้ไฟล์เสียงภายนอก) =====
let audioCtx = null;
function beep(freq, durationMs, delayMs = 0) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + delayMs / 1000;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + durationMs / 1000);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + durationMs / 1000 + 0.02);
  } catch (e) {}
}
function tickBeep()   { beep(880, 90); }
function goBeep()     { beep(1320, 220); vibrate(150); }
function restBeep()   { beep(440, 220); vibrate([100, 60, 100]); }
function finishBeep() { beep(660, 140, 0); beep(880, 140, 160); beep(1100, 260, 320); vibrate([150, 80, 150, 80, 300]); }
function vibrate(pattern) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }

// ===== WAKE LOCK (กันจอดับระหว่างออกกำลังกาย, best-effort) =====
let wakeLock = null;
async function requestWakeLock() {
  try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
}
function releaseWakeLock() {
  try { wakeLock && wakeLock.release(); } catch (e) {}
  wakeLock = null;
}

// ===== TIMER STATE MACHINE =====
const RING_R = 100;
const RING_CIRC = 2 * Math.PI * RING_R;
document.getElementById("timer-ring-fill").style.strokeDasharray = `${RING_CIRC}`;

let state = null; // { workSec, restSec, totalSets, currentSet, phase, phaseDurMs, phaseEndTs, sessionStartTs, pauseAccumMs, pausedAt, tickedThisPhase }
let rafId = null;

function fmtMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function startTimer() {
  const work = Math.max(1, parseInt(workInput.value, 10) || 30);
  const rest = Math.max(0, parseInt(restInput.value, 10) || 0);
  const sets = Math.max(1, parseInt(setsInput.value, 10) || 1);
  saveSettings({ work, rest, sets });

  const now = Date.now();
  state = {
    workSec: work, restSec: rest, totalSets: sets,
    currentSet: 1, phase: "work",
    phaseDurMs: work * 1000, phaseEndTs: now + work * 1000,
    sessionStartTs: now, pauseAccumMs: 0, pausedAt: null,
    lastTickSecond: null,
  };

  document.getElementById("timer-setup").parentElement.hidden = true;
  document.getElementById("timer-run-section").hidden = false;
  document.getElementById("timer-run").classList.remove("rest", "done");
  document.getElementById("pause-btn").textContent = "⏸ หยุดชั่วคราว";
  requestWakeLock();
  loop();
}

function pauseResume() {
  if (!state || state.phase === "done") return;
  const btn = document.getElementById("pause-btn");
  if (state.pausedAt) {
    // resume
    const pausedDur = Date.now() - state.pausedAt;
    state.pauseAccumMs += pausedDur;
    state.phaseEndTs += pausedDur;
    state.pausedAt = null;
    btn.textContent = "⏸ หยุดชั่วคราว";
    requestWakeLock();
  } else {
    state.pausedAt = Date.now();
    btn.textContent = "▶ ทำต่อ";
    releaseWakeLock();
  }
}

function resetTimer() {
  state = null;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  releaseWakeLock();
  document.getElementById("timer-setup").parentElement.hidden = false;
  document.getElementById("timer-run-section").hidden = true;
}

// ต่อ phaseEndTs ใหม่จาก "จุดที่ phase ก่อนหน้าควรจบจริงๆ" (ไม่ใช่จาก 'now') —
// สำคัญเวลา catch-up หลาย phase รวดเดียว (เช่น tab ถูก throttle ตอนพับจอ) ไม่งั้นแต่ละ step
// จะรีเซ็ตนาฬิกาใหม่จาก now ทุกครั้ง ทำให้ catch ทันแค่ 1 phase ต่อ 1 รอบ loop เท่านั้น
function advancePhase() {
  const prevEnd = state.phaseEndTs;
  if (state.phase === "work") {
    if (state.currentSet >= state.totalSets) {
      state.phase = "done";
      finishBeep();
      releaseWakeLock();
      return;
    }
    if (state.restSec <= 0) {
      // ไม่มีพัก — ข้ามไป work ของเซทถัดไปทันที
      state.currentSet += 1;
      state.phase = "work";
      state.phaseDurMs = state.workSec * 1000;
      state.phaseEndTs = prevEnd + state.workSec * 1000;
      goBeep();
      return;
    }
    state.phase = "rest";
    state.phaseDurMs = state.restSec * 1000;
    state.phaseEndTs = prevEnd + state.restSec * 1000;
    restBeep();
  } else if (state.phase === "rest") {
    state.currentSet += 1;
    state.phase = "work";
    state.phaseDurMs = state.workSec * 1000;
    state.phaseEndTs = prevEnd + state.workSec * 1000;
    goBeep();
  }
}

function loop() {
  if (!state) return;
  const now = Date.now();

  if (!state.pausedAt && state.phase !== "done") {
    // catch up ทุก phase ที่ข้ามไปในทีเดียว (เผื่อ tab ถูก throttle ตอนพับจอ/สลับแอป)
    let guard = 0;
    while (state.phase !== "done" && state.phaseEndTs - now <= 0 && guard < 1000) {
      advancePhase();
      guard++;
    }
    if (state.phase !== "done") {
      const remainingSec = Math.ceil((state.phaseEndTs - now) / 1000);
      if (remainingSec <= 3 && remainingSec !== state.lastTickSecond) {
        state.lastTickSecond = remainingSec;
        tickBeep();
      }
    }
  }

  render(now);
  rafId = requestAnimationFrame(loop);
}

function render(now) {
  const runEl = document.getElementById("timer-run");
  const phaseEl = document.getElementById("timer-phase");
  const countdownEl = document.getElementById("timer-countdown");
  const ringFill = document.getElementById("timer-ring-fill");
  const setLabelEl = document.getElementById("timer-set-label");
  const totalEl = document.getElementById("timer-total");

  runEl.classList.toggle("rest", state.phase === "rest");
  runEl.classList.toggle("done", state.phase === "done");

  if (state.phase === "done") {
    phaseEl.textContent = "🎉 เสร็จแล้ว!";
    countdownEl.textContent = "✓";
    ringFill.style.strokeDashoffset = "0";
  } else {
    phaseEl.textContent = state.phase === "work" ? "⚡ ออกกำลังกาย" : "😮‍💨 พัก";
    const remainingMs = state.pausedAt
      ? state.phaseEndTs - state.pausedAt
      : state.phaseEndTs - now;
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
    countdownEl.textContent = remainingSec;
    const pct = Math.max(0, Math.min(1, remainingMs / state.phaseDurMs));
    ringFill.style.strokeDashoffset = `${RING_CIRC * (1 - pct)}`;
  }

  setLabelEl.textContent = `${Math.min(state.currentSet, state.totalSets)} / ${state.totalSets}`;

  const pauseNow = state.pausedAt || now;
  const totalElapsedMs = Math.max(0, pauseNow - state.sessionStartTs - state.pauseAccumMs);
  totalEl.textContent = fmtMMSS(Math.floor(totalElapsedMs / 1000));
}

document.getElementById("start-btn").addEventListener("click", startTimer);
document.getElementById("pause-btn").addEventListener("click", pauseResume);
document.getElementById("reset-btn").addEventListener("click", resetTimer);

initTheme();
setHeaderDate();

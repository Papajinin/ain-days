// AIN Days 공통 v1: 날짜 도우미, 저장소, 상태, 숫자 계산(연속·%), 화면 모드·테마 색, 아래에서 올라오는 창

const STORE_KEY = 'ainDays';
const appEl = document.getElementById('app');
const WEEK_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
// AIN Cost 유형 색과 같은 순서 (brown 이름표 = 노랑)
const COLOR_KEYS = ['blue', 'green', 'red', 'brown', 'purple', 'orange', 'teal', 'pink'];

// ---------- 날짜 ('YYYY-MM-DD' 문자열) ----------
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayStr() {
  return ymd(new Date());
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// 한 주의 시작(설정: 0 일요일, 1 월요일)부터 그 요일까지 며칠째인지
function weekLead(d) {
  return (d.getDay() - state.settings.weekStart + 7) % 7;
}
function weekStartOf(d) {
  return addDays(d, -weekLead(d));
}
function weekLabelsHtml() {
  return [...Array(7)].map((_, i) => (i + state.settings.weekStart) % 7)
    .map(n => `<span${n === 0 ? ' class="sun"' : ''}>${WEEK_NAMES[n]}</span>`).join('');
}

// ---------- 상태 ----------
// 습관: { id, name, color, start('YYYY-MM-DD'), archived, days: { 'YYYY-MM-DD': true } }
// 순서는 배열 순서 그대로
let state = {
  habits: [],
  // theme: light | dark | auto (기기마다), accent: blue | green | red, weekStart: 0 | 1 (계정마다)
  settings: { theme: 'auto', accent: 'blue', weekStart: 0 }
};

// 저장하지 않는 화면 상태
const ui = {
  today: todayStr(),
  sel: todayStr(),     // 오늘 화면에서 고른 날짜
  view: 'home',        // home | detail | report | archive
  habitId: null,       // 상세에서 보는 습관
  calMonth: null,      // 상세 달력의 달 (Date, 그달 1일)
  chartYear: null,     // 상세 월별 그래프의 해
  rep: { tab: 'week', off: 0 },
  pop: null            // 방금 체크한 곳 (한 번만 움직임)
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    state = {
      habits: saved.habits || [],
      settings: { ...state.settings, ...(saved.settings || {}) }
    };
    return true;
  } catch (e) {
    return false;
  }
}

// 이 기기에만 저장 (클라우드에서 받은 내용을 저장할 때)
function saveLocal() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// 내가 바꾼 내용 저장: 기기 + 클라우드 (sync.js)
function saveState() {
  saveLocal();
  if (typeof cloudSave === 'function') cloudSave();
}

// 화면 모드('자동'이면 아이폰 설정을 따름)와 테마 색
function applyTheme() {
  const { theme: mode, accent } = state.settings;
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
  if (accent === 'green' || accent === 'red') root.setAttribute('data-accent', accent);
  else root.removeAttribute('data-accent');
}

// 아래에서 올라오는 창 열기·닫기 (습관, 설정)
function showOverlay(el) {
  el.hidden = false;
  document.body.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('show'));
}
function hideOverlay(el) {
  el.classList.remove('show');
  document.body.classList.remove('locked');
  setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 300);
}

function newId() {
  return 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function findHabit(id) {
  return state.habits.find(h => h.id === id);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- 체크와 숫자 ----------
function isOn(h, k) {
  return !!h.days[k];
}
function toggleDay(h, k) {
  if (h.days[k]) delete h.days[k];
  else h.days[k] = true;
  return !!h.days[k];
}

// 기록을 센 첫날: 만든 날, 또는 그보다 앞서 체크한 날이 있으면 그날
function habitStart(h) {
  let s = h.start;
  for (const k in h.days) if (k < s) s = k;
  return parseYmd(s);
}

// 연속: 오늘 체크했으면 오늘부터, 아니면 어제부터 거꾸로 셈 (오늘이 끝나기 전엔 0으로 떨어뜨리지 않음)
function currentStreak(h) {
  const today = parseYmd(ui.today);
  let d = isOn(h, ui.today) ? today : addDays(today, -1);
  let n = 0;
  while (isOn(h, ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak(h) {
  const keys = Object.keys(h.days).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => {
    run = prev && ymd(addDays(parseYmd(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  });
  return best;
}
function totalCount(h) {
  return Object.keys(h.days).length;
}

// 기간 달성률(%) — 모든 화면 같은 기준: 체크한 날 ÷ 지금까지 지난 날
//  - 기록 시작 전 날과 미래는 빼고, 오늘은 체크했을 때만 셈. 셀 날이 없으면 null
function rate(h, from, to) {
  const start = habitStart(h), today = parseYmd(ui.today);
  if (from < start) from = start;
  if (to > today) to = today;
  let days = 0, hit = 0;
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const k = ymd(d), on = isOn(h, k);
    if (k === ui.today && !on) continue;
    days++;
    if (on) hit++;
  }
  return days ? Math.round(hit / days * 100) : null;
}
function pctText(p) {
  return p === null ? '-' : p + '%';
}

// ---------- 아이콘 ----------
const ICONS = {
  report: '<svg viewBox="0 0 24 24"><path d="M5 20V12M12 20V5M19 20v-9"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  box: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>'
};

function dotHtml(h) {
  return `<i class="h-dot" style="background:var(--c-${h.color})"></i>`;
}

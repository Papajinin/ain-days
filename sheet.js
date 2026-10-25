// AIN Days 습관 추가·편집 창 v5 (이름, 색, 보관, 삭제) + 선택 창(삭제·로그아웃 확인)

const habitOverlay = document.getElementById('habitOverlay');
const fName = document.getElementById('fName');
const fColors = document.getElementById('fColors');
const habitSave = document.getElementById('habitSave');
const fEditOnly = document.getElementById('fEditOnly');
const fArchive = document.getElementById('fArchive');
const fArchiveNote = document.getElementById('fArchiveNote');

let form = null; // { id(편집일 때), color }

function openHabitSheet(id) {
  const h = id ? findHabit(id) : null;
  if (h) {
    form = { id, color: h.color };
    fName.value = h.name;
    const s = habitStart(h);
    document.getElementById('fStart').textContent = `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일`;
    fArchive.textContent = h.archived ? '보관 해제' : '보관하기';
    fArchiveNote.textContent = h.archived ? '보관 해제하면 오늘 목록에 다시 나와요.' : '보관하면 오늘 목록과 리포트에서 사라지고, 기록은 남아요. 보관함에서 다시 꺼낼 수 있어요.';
  } else {
    // 새 습관: 아직 안 쓴 색을 먼저 골라 둠
    const used = state.habits.map(x => x.color);
    form = { id: null, color: COLOR_KEYS.find(k => !used.includes(k)) || 'blue' };
    fName.value = '';
  }
  document.getElementById('habitTitle').textContent = h ? '습관 편집' : '새 습관';
  habitSave.textContent = h ? '저장' : '추가';
  fEditOnly.hidden = !h;
  renderColors();
  updateSaveBtn();
  showOverlay(habitOverlay);
  // 아이폰은 누르는 순간에 커서를 넣어야 키보드를 열어 줌 (조금 뒤에 넣으면 무시됨)
  if (!h) { fName.focus({ preventScroll: true }); settleCaret(fName); }
}

// 아이폰 Safari: 올라오는 중인 칸에 커서를 넣으면 깜빡이는 커서가 처음 자리(창 뒤)에 남을 때가 있어서,
// 창이 다 올라온 뒤 커서 위치를 한 번 더 잡아 줌 (키보드는 누르는 순간 넣어야 열리므로 그때 한 번, 지금 한 번)
// 처음 열 때 아이폰이 키보드를 띄우며 화면 전체를 밀어 버리면, 키보드가 다 올라온 뒤 원래 보던 위치로 되돌림
let caretHold = null; // { el, y }
function settleCaret(el) {
  caretHold = { el, y: window.scrollY };
  setTimeout(() => {
    if (document.activeElement !== el) return;
    const n = el.value.length;
    try { el.setSelectionRange(n, n); } catch (e) {}
    holdScroll();
  }, 320);
  setTimeout(() => { if (caretHold && caretHold.el === el) caretHold = null; }, 1000);
}
function holdScroll() {
  if (!caretHold || document.activeElement !== caretHold.el) return;
  if (window.scrollY !== caretHold.y) window.scrollTo(window.scrollX, caretHold.y);
}

function renderColors() {
  fColors.innerHTML = COLOR_KEYS.map(k =>
    `<button type="button" class="color-dot${k === form.color ? ' on' : ''}" data-color="${k}" aria-label="${k}" aria-pressed="${k === form.color}"><i style="background:var(--c-${k})"></i></button>`
  ).join('');
}
function updateSaveBtn() {
  habitSave.disabled = !fName.value.trim();
}

function closeHabitSheet() {
  fName.blur();
  hideOverlay(habitOverlay);
}

function saveHabit() {
  const name = fName.value.trim();
  if (!name) return;
  if (form.id) {
    const h = findHabit(form.id);
    h.name = name;
    h.color = form.color;
  } else {
    state.habits.push({ id: newId(), name, color: form.color, start: ui.today, archived: false, days: {} });
  }
  saveState();
  closeHabitSheet();
  render();
}

function toggleArchive() {
  const h = findHabit(form.id);
  h.archived = !h.archived;
  saveState();
  closeHabitSheet();
  // 보관하면 목록으로, 꺼내면 상세 그대로
  if (h.archived) ui.view = 'home';
  render();
}

function askDelete() {
  const h = findHabit(form.id);
  showActions(`'${h.name}' 습관과 기록 ${totalCount(h)}번이 모두 지워져요.`, [
    { label: '습관 삭제', danger: true, fn: () => {
      state.habits = state.habits.filter(x => x.id !== h.id);
      saveState();
      closeHabitSheet();
      ui.view = 'home';
      render();
    } }
  ]);
}

fName.addEventListener('input', updateSaveBtn);
fName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveHabit(); } });
fColors.addEventListener('click', e => {
  const b = e.target.closest('.color-dot');
  if (!b) return;
  form.color = b.dataset.color;
  renderColors();
});
habitSave.addEventListener('click', saveHabit);
document.getElementById('habitCancel').addEventListener('click', closeHabitSheet);
fArchive.addEventListener('click', toggleArchive);
document.getElementById('fDelete').addEventListener('click', askDelete);
habitOverlay.addEventListener('click', e => { if (e.target === habitOverlay) closeHabitSheet(); });

// 아이폰 키보드가 올라오면 입력 창도 키보드 위로 올림 (AIN Todo·Cost와 같음)
if (window.visualViewport) {
  const vv = window.visualViewport;
  const fit = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', kb + 'px');
    holdScroll();
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
}

// ---------- 선택 창 (AIN Cost와 같음) ----------
const actionOverlay = document.getElementById('actionOverlay');
const actionMsg = document.getElementById('actionMsg');
const actionBtns = document.getElementById('actionBtns');
let actionList = [];

function showActions(msg, list) {
  actionList = list;
  actionMsg.textContent = msg;
  actionBtns.innerHTML = list.map((a, i) =>
    `<button type="button" class="action-btn${a.danger ? ' danger' : ''}" data-i="${i}">${a.label}</button>`
  ).join('');
  document.activeElement && document.activeElement.blur();
  actionOverlay.hidden = false;
  requestAnimationFrame(() => actionOverlay.classList.add('show'));
}
function hideActions() {
  actionOverlay.classList.remove('show');
  setTimeout(() => { if (!actionOverlay.classList.contains('show')) actionOverlay.hidden = true; }, 380);
}
actionBtns.addEventListener('click', e => {
  const b = e.target.closest('.action-btn');
  if (!b) return;
  const a = actionList[Number(b.dataset.i)];
  hideActions();
  a.fn();
});
document.getElementById('actionCancel').addEventListener('click', hideActions);
actionOverlay.addEventListener('click', e => { if (e.target === actionOverlay) hideActions(); });

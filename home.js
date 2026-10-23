// AIN Days 오늘 화면 v1: 이번 주 날짜 줄, 습관 목록(체크·연속), 꾹 눌러 끌어서 순서 바꾸기

function homeHtml() {
  const today = parseYmd(ui.today);
  const start = weekStartOf(today);
  let week = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i), k = ymd(d);
    const cls = ['wd', k === ui.today ? 'today' : '', k === ui.sel ? 'sel' : ''].join(' ');
    week += `<button type="button" class="${cls}" data-day="${k}" aria-pressed="${k === ui.sel}"${d > today ? ' disabled' : ''}>` +
      `<span class="lab${d.getDay() === 0 ? ' sun' : ''}">${WEEK_NAMES[d.getDay()]}</span><span class="n">${d.getDate()}</span></button>`;
  }

  const sel = parseYmd(ui.sel);
  const shown = state.habits.filter(h => !h.archived);
  const archived = state.habits.length - shown.length;
  const count = shown.filter(h => isOn(h, ui.sel)).length;
  const rows = shown.map(h => {
    const on = isOn(h, ui.sel);
    const pop = on && ui.pop === h.id + '@' + ui.sel;
    return `<div class="habit${on ? ' done' : ''}" data-c="${h.color}" data-id="${h.id}" style="--hc:var(--c-${h.color})">
      <button type="button" class="h-open" data-open="${h.id}">
        ${dotHtml(h)}<span class="h-name">${escapeHtml(h.name)}</span><span class="h-meta">${currentStreak(h)}일째</span>
      </button>
      <button type="button" class="check-btn" data-check="${h.id}" aria-pressed="${on}" aria-label="${escapeHtml(h.name)} 체크"><span class="check${pop ? ' pop' : ''}">${ICONS.check}</span></button>
    </div>`;
  }).join('');

  return `
    <header class="top">
      <h1 class="wordmark"><b>AIN</b> Days</h1>
      <div class="top-right">
        <button class="icon-btn" type="button" data-go="report" aria-label="리포트"><span class="icon-circle">${ICONS.report}</span></button>
        <button class="icon-btn" type="button" data-go="settings" aria-label="설정"><span class="icon-circle">${ICONS.settings}</span></button>
      </div>
    </header>
    <div class="week">${week}</div>
    <div class="day-head"><h2>${sel.getMonth() + 1}월 ${sel.getDate()}일 ${WEEK_NAMES[sel.getDay()]}요일</h2>${shown.length ? `<span>${count}/${shown.length}</span>` : ''}</div>
    ${shown.length ? '' : '<p class="empty">아래 "습관 추가"로 첫 습관을 만들어 보세요.</p>'}
    <div class="list" data-list>${rows}<button type="button" class="add-row" data-add>${ICONS.plus}습관 추가</button></div>
    ${archived ? `<div class="list more"><button type="button" class="arch-row" data-go="archive"><span class="ic">${ICONS.box}</span>보관함<span class="h-meta">${archived}</span>${ICONS.next}</button></div>` : ''}`;
}

function checkFromHome(id) {
  const h = findHabit(id);
  if (!h) return;
  if (toggleDay(h, ui.sel)) ui.pop = id + '@' + ui.sel;
  saveState();
  render();
}

// ---------- 꾹 눌러(0.45초) 끌어서 순서 바꾸기 ----------
// 누르기 전에 손가락이 움직이면 스크롤로 봄
let drag = null;
let skipClick = false;

appEl.addEventListener('pointerdown', e => {
  const open = e.target.closest('[data-list] .h-open');
  if (!open || ui.view !== 'home') return;
  const row = open.closest('.habit');
  drag = { row, list: row.parentNode, y: e.clientY, on: false };
  drag.timer = setTimeout(() => {
    if (!drag) return;
    drag.on = true;
    row.classList.add('dragging');
    if (navigator.vibrate) navigator.vibrate(10);
  }, 450);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.abs(e.clientY - drag.y) > 8) { clearTimeout(drag.timer); drag = null; }
    return;
  }
  const others = [...drag.list.querySelectorAll('.habit')].filter(r => r !== drag.row);
  const target = others.find(r => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
  const place = target || drag.list.querySelector('.add-row');
  if (drag.row.nextElementSibling !== place) drag.list.insertBefore(drag.row, place);
});
// 끄는 동안 화면이 스크롤되지 않게
document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

function endDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  const was = drag;
  drag = null;
  if (!was.on) return;
  const order = [...was.list.querySelectorAll('.habit')].map(r => findHabit(r.dataset.id));
  const rest = state.habits.filter(h => !order.includes(h)); // 보관한 습관은 뒤에 그대로
  state.habits = [...order, ...rest];
  skipClick = true;
  setTimeout(() => { skipClick = false; }, 400);
  saveState();
  render();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

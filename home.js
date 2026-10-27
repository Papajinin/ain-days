// AIN Days 오늘 화면 v5: 주 날짜 줄(옆으로 쓸어 지난주), 습관 목록(체크·연속, 옆으로 쓸어 하루씩), 꾹 눌러 끌어서 순서 바꾸기

function homeHtml() {
  const today = parseYmd(ui.today);
  const sel = parseYmd(ui.sel);
  const start = weekStartOf(sel); // 고른 날이 있는 주
  const otherWeek = ymd(start) !== ymd(weekStartOf(today));
  let week = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i), k = ymd(d);
    const cls = ['wd', k === ui.today ? 'today' : '', k === ui.sel ? 'sel' : ''].join(' ');
    week += `<button type="button" class="${cls}" data-day="${k}" aria-pressed="${k === ui.sel}"${d > today ? ' disabled' : ''}>` +
      `<span class="lab${d.getDay() === 0 ? ' sun' : ''}">${WEEK_NAMES[d.getDay()]}</span><span class="n">${d.getDate()}</span></button>`;
  }

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
    <div class="week"><div class="week-row">${week}</div></div>
    <div class="day-pane">
      <div class="day-head"><h2>${sel.getMonth() + 1}월 ${sel.getDate()}일 ${WEEK_NAMES[sel.getDay()]}요일</h2>${otherWeek ? '<button type="button" class="today-btn" data-today>오늘</button>' : ''}${shown.length ? `<span>${count}/${shown.length}</span>` : ''}</div>
      ${shown.length ? '' : '<p class="empty">아래 "습관 추가"로 첫 습관을 만들어 보세요.</p>'}
      <div class="list" data-list>${rows}<button type="button" class="add-row" data-add>${ICONS.plus}습관 추가</button></div>
      ${archived ? `<div class="list more"><button type="button" class="arch-row" data-go="archive"><span class="ic">${ICONS.box}</span>보관함<span class="h-meta">${archived}</span>${ICONS.next}</button></div>` : ''}
    </div>`;
}

function checkFromHome(id) {
  const h = findHabit(id);
  if (!h) return;
  if (toggleDay(h, ui.sel)) ui.pop = id + '@' + ui.sel;
  saveState();
  render();
}

// ---------- 꾹 눌러(0.45초) 끌어서 순서 바꾸기 ----------
// 누르기 전에 손가락이 움직이면 스크롤(또는 옆으로 쓸기)로 봄
// 잡은 줄은 손가락을 따라 움직이고, 다른 줄은 미끄러지듯 비켜 줌 (손을 뗄 때까지 순서는 그대로 두고 위치만 옮겨 보임)
let drag = null;
let skipClick = false;

appEl.addEventListener('pointerdown', e => {
  const open = e.target.closest('[data-list] .h-open');
  if (!open || ui.view !== 'home') return;
  const row = open.closest('.habit');
  drag = { row, list: row.parentNode, x: e.clientX, y: e.clientY, on: false };
  drag.timer = setTimeout(() => {
    if (!drag) return;
    drag.on = true;
    drag.rows = [...drag.list.querySelectorAll('.habit')];
    drag.from = drag.to = drag.rows.indexOf(row);
    drag.tops = drag.rows.map(r => r.offsetTop);
    drag.hs = drag.rows.map(r => r.offsetHeight);
    drag.list.classList.add('sorting');
    row.classList.add('dragging');
    if (navigator.vibrate) navigator.vibrate(10);
  }, 450);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.abs(e.clientY - drag.y) > 8 || Math.abs(e.clientX - drag.x) > 8) { clearTimeout(drag.timer); drag = null; }
    return;
  }
  const { rows, from, tops, hs } = drag;
  const last = rows.length - 1;
  // 목록 맨 위·맨 아래 밖으로는 못 나가게 (끝에 닿으면 끝 줄과 자리를 바꿀 수 있게 조금 여유를 둠)
  const dy = Math.max(tops[0] - tops[from] - 4, Math.min(tops[last] + hs[last] - hs[from] - tops[from] + 4, e.clientY - drag.y));
  drag.row.style.transform = `translateY(${dy}px)`;
  // 잡은 줄의 가운데가 다른 줄의 가운데를 넘으면 그 줄이 비켜 줌
  const mid = tops[from] + hs[from] / 2 + dy;
  let to = from;
  rows.forEach((r, k) => {
    if (k === from) return;
    const m = tops[k] + hs[k] / 2;
    let shift = 0;
    if (k < from && mid <= m) { shift = hs[from]; to--; }
    if (k > from && mid >= m) { shift = -hs[from]; to++; }
    r.style.transform = shift ? `translateY(${shift}px)` : '';
  });
  drag.to = to;
});
// 끄는 동안 화면이 스크롤되지 않게
document.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

function endDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  const was = drag;
  drag = null;
  if (!was.on) return;
  skipClick = true;
  setTimeout(() => { skipClick = false; }, 400);
  // 잡은 줄을 새 자리로 부드럽게 내려놓은 뒤 순서를 저장하고 다시 그림
  const { rows, from, to, tops, hs, row } = was;
  const y = to > from ? tops[to] + hs[to] - hs[from] - tops[from] : tops[to] - tops[from];
  row.classList.add('settle');
  row.style.transform = `translateY(${y}px)`;
  setTimeout(() => {
    const order = rows.map(r => findHabit(r.dataset.id));
    order.splice(to, 0, order.splice(from, 1)[0]);
    const rest = state.habits.filter(h => !order.includes(h)); // 보관한 습관은 뒤에 그대로
    state.habits = [...order, ...rest];
    saveState();
    render();
  }, 350); // 내려앉는 움직임(--t)이 끝난 뒤
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- 날짜 넘기기: 옆으로 쓸기 (AIN Todo 캘린더와 같은 방식) ----------
// 날짜 줄을 쓸면 한 주씩, 습관 목록을 쓸면 하루씩. 쓰는 동안 손가락을 따라 움직이고, 덜 밀면 제자리로
// 이번 주(오늘)보다 앞으로는 못 감
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let sliding = false;
let paneX = 0; // 손가락을 따라 옮긴 거리

function setPane(el, x, ms, ease) {
  el.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
  el.style.transform = x ? `translateX(${x}px)` : '';
  paneX = x;
}
// part: '.week-row'(날짜 줄) 또는 '.day-pane'(습관 목록) — 이 부분이 밀려나고 새 날이 반대쪽에서 들어옴
function changeDay(k, part) {
  if (k > ui.today) k = ui.today;
  if (sliding || k === ui.sel) return;
  let el = appEl.querySelector(part);
  if (reduceMotion || !el) { ui.sel = k; return render(); }
  sliding = true;
  const dir = k < ui.sel ? -1 : 1;
  const w = el.clientWidth;
  const outMs = Math.round(80 + 140 * (1 - Math.min(Math.abs(paneX) / w, 1)));
  setPane(el, -dir * w, outMs, 'ease-in');
  setTimeout(() => {
    ui.sel = k;
    render();
    el = appEl.querySelector(part);
    setPane(el, dir * w, 0);
    el.offsetHeight; // 새 날을 반대쪽에 먼저 놓기
    setPane(el, 0, 240, 'ease-out');
    setTimeout(() => {
      el.style.transition = '';
      sliding = false;
    }, 250);
  }, outMs);
}
// 오늘 버튼: 다른 주를 보고 있을 때 이번 주로
function goToday() {
  changeDay(ui.today, '.week-row');
}
function snapBack(part) {
  const el = appEl.querySelector(part);
  if (!el) return;
  setPane(el, 0, 200, 'ease-out');
  setTimeout(() => { el.style.transition = ''; }, 210);
}
// 쓸었을 때 갈 날: 날짜 줄은 7일, 목록은 1일 (다음 주의 그날이 미래면 오늘로)
function swipeTarget(part, step) {
  return ymd(addDays(parseYmd(ui.sel), part === '.week-row' ? step * 7 : step));
}
// 다음 쪽으로 더 갈 수 있는지: 날짜 줄은 이번 주가 아닐 때, 목록은 오늘이 아닐 때
function canGoNext(part) {
  if (part === '.day-pane') return ui.sel < ui.today;
  return ymd(addDays(weekStartOf(parseYmd(ui.sel)), 7)) <= ui.today;
}

let swipe = null;
let swipedAt = 0;

appEl.addEventListener('touchstart', e => {
  swipe = null;
  if (sliding || ui.view !== 'home' || e.touches.length !== 1) return;
  if (document.body.classList.contains('locked')) return;
  const part = e.target.closest('.week') ? '.week-row' : e.target.closest('.day-pane') ? '.day-pane' : null;
  if (!part) return;
  const p = e.touches[0];
  swipe = { part, x: p.clientX, y: p.clientY, time: Date.now(), axis: null };
}, { passive: true });

appEl.addEventListener('touchmove', e => {
  if (!swipe) return;
  if (drag && drag.on) { swipe = null; return; } // 순서 바꾸는 중
  const p = e.touches[0];
  const dx = p.clientX - swipe.x, dy = p.clientY - swipe.y;
  if (!swipe.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
    swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    swipedAt = Date.now();
  }
  if (swipe.axis === 'x' && !reduceMotion) {
    const el = appEl.querySelector(swipe.part);
    // 더 갈 수 없는 쪽(오늘 다음)으로는 조금만 끌려옴
    if (el) setPane(el, dx < 0 && !canGoNext(swipe.part) ? dx / 4 : dx, 0);
  }
}, { passive: true });

appEl.addEventListener('touchend', e => {
  if (!swipe) return;
  const p = e.changedTouches[0];
  const dx = p.clientX - swipe.x;
  const fast = Math.abs(dx) / Math.max(Date.now() - swipe.time, 1) > 0.4; // 휙 넘긴 경우
  const { axis, part } = swipe;
  swipe = null;
  if (axis) swipedAt = Date.now();
  if (axis !== 'x') return;
  const el = appEl.querySelector(part);
  const far = el && Math.abs(dx) > el.clientWidth * 0.25;
  const step = dx < 0 ? 1 : -1;
  if ((far || (fast && Math.abs(dx) > 30)) && (step < 0 || canGoNext(part))) changeDay(swipeTarget(part, step), part);
  else if (!reduceMotion) snapBack(part);
}, { passive: true });

appEl.addEventListener('touchcancel', () => {
  if (swipe && swipe.axis === 'x') snapBack(swipe.part);
  swipe = null;
}, { passive: true });

// 쓸고 난 손가락이 버튼 위에서 떨어져도 눌린 것으로 치지 않음
appEl.addEventListener('click', e => {
  if (Date.now() - swipedAt < 400) { e.stopPropagation(); e.preventDefault(); }
}, true);

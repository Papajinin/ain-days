// AIN Days 시작 v2: 화면 고르기·그리기, 누르기 처리, 날짜 바뀜, 시작 화면, 클라우드 시작

function render() {
  if (ui.view === 'detail') appEl.innerHTML = detailHtml();
  else if (ui.view === 'report') appEl.innerHTML = reportHtml();
  else if (ui.view === 'archive') appEl.innerHTML = archiveHtml();
  else appEl.innerHTML = homeHtml();
  ui.pop = null; // 체크 애니메이션은 방금 누른 한 번만
}

function go(view) {
  ui.view = view;
  if (view === 'report') ui.rep.off = 0;
  render();
  window.scrollTo(0, 0);
}

// 보관함: 보관한 습관 목록, 누르면 상세
function archiveHtml() {
  const rows = state.habits.filter(h => h.archived).map(h =>
    `<button type="button" class="arch-row" data-open="${h.id}">${dotHtml(h)}${escapeHtml(h.name)}<span class="h-meta">전체 ${totalCount(h)}번</span>${ICONS.next}</button>`
  ).join('');
  return `
    <header class="top sub">
      <button class="icon-btn" type="button" data-back aria-label="뒤로"><span class="icon-circle">${ICONS.back}</span></button>
      <h1><span>보관함</span></h1>
      <span></span>
    </header>
    <p class="note">보관한 습관은 오늘 목록과 리포트에 안 보이고, 기록은 그대로 남아요.</p>
    ${rows ? `<div class="list">${rows}</div>` : '<p class="note">보관한 습관이 없어요.</p>'}`;
}

function goBack() {
  const h = ui.view === 'detail' && findHabit(ui.habitId);
  go(h && h.archived ? 'archive' : 'home');
}

appEl.addEventListener('click', e => {
  if (skipClick) { skipClick = false; return; }
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.check) return checkFromHome(d.check);
  if (d.open) return openDetail(d.open);
  if (d.day) { ui.sel = d.day; return render(); }
  if (d.add !== undefined) return openHabitSheet(null);
  if (d.go === 'settings') return openSettings();
  if (d.go) return go(d.go);
  if (d.back !== undefined) return goBack();
  if (d.edit !== undefined) return openHabitSheet(ui.habitId);
  if (d.cal) return moveCal(d.cal);
  if (d.cd) return checkFromCal(d.cd);
  if (d.yr) { ui.chartYear += Number(d.yr); return render(); }
  if (d.tab) { ui.rep = { tab: d.tab, off: 0 }; return render(); }
  if (d.rp) { ui.rep.off = d.rp === 'now' ? 0 : ui.rep.off + Number(d.rp); return render(); }
});

// 앱을 켜 둔 채 날짜가 바뀌면 '오늘'을 새로 계산
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = todayStr();
  if (now === ui.today) return;
  if (ui.sel === ui.today) ui.sel = now;
  ui.today = now;
  render();
});

// 시작 화면: 첫 화면을 다 그린 뒤에 움직이기 시작 → 약 1.8초 움직이고 잠깐 두었다가 사라짐
// 클라우드 연결은 움직임이 거의 끝난 뒤에 시작해서 끊기지 않게 (AIN Cost와 같은 방법)
let splashStarted = false;
function startSplash() {
  if (splashStarted) return;
  splashStarted = true;
  const splash = document.getElementById('splash');
  splash.classList.add('go');
  setTimeout(initCloud, 1700);
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 400);
    lockStart(); // 잠금이 켜져 있으면 Face ID·지문 확인 창을 저절로 띄움
  }, 2000);
}

loadState(); // 기기에 저장된 내용으로 먼저 보여 주고, 클라우드에서 최신 내용을 받으면 다시 그림
applyTheme();
render();
requestAnimationFrame(() => requestAnimationFrame(startSplash)); // 첫 화면이 그려진 다음 장면부터
setTimeout(startSplash, 1000); // 화면 그리기 신호가 오지 않는 경우(백그라운드에서 열림 등) 대비

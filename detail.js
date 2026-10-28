// AIN Days 습관 상세 v2 (일요일·공휴일 빨간 숫자): 달력(지난달 넘기기, 날짜 눌러 체크), 연속, 달성률, 월별 달성률(1~12월), 전체 횟수

function openDetail(id) {
  const today = parseYmd(ui.today);
  ui.view = 'detail';
  ui.habitId = id;
  ui.calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  ui.chartYear = today.getFullYear();
  render();
  window.scrollTo(0, 0);
}

function detailHtml() {
  const h = findHabit(ui.habitId);
  if (!h) { ui.view = 'home'; return homeHtml(); }
  const today = parseYmd(ui.today), start = habitStart(h);

  // 달력
  const m = ui.calMonth;
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < weekLead(m); i++) cells += '<span></span>';
  for (let n = 1; n <= last; n++) {
    const d = new Date(m.getFullYear(), m.getMonth(), n), k = ymd(d), on = isOn(h, k);
    const cls = ['cd', on ? 'done' : '', isRedDay(k) ? 'red' : '', k === ui.today ? 'today' : '', on && ui.pop === h.id + '@' + k ? 'pop' : ''].join(' ');
    cells += `<button type="button" class="${cls}" data-cd="${k}" aria-pressed="${on}"${d > today ? ' disabled' : ''}><span class="n">${n}</span></button>`;
  }
  const isThis = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
  const isFirst = m <= new Date(start.getFullYear(), start.getMonth(), 1);

  const weekP = rate(h, weekStartOf(today), today);
  const monthP = rate(h, new Date(today.getFullYear(), today.getMonth(), 1), today);
  const yearP = rate(h, new Date(today.getFullYear(), 0, 1), today);

  return `
    <header class="top sub">
      <button class="icon-btn" type="button" data-back aria-label="뒤로"><span class="icon-circle">${ICONS.back}</span></button>
      <h1><i class="h-dot" style="background:var(--c-${h.color});margin:0"></i><span>${escapeHtml(h.name)}</span></h1>
      <button class="text-btn" type="button" data-edit>편집</button>
    </header>
    <div class="cal" style="--hc:var(--c-${h.color})">
      <div class="cal-head">
        <div class="cal-nav">
          <button class="nav-btn" type="button" data-cal="-1" aria-label="이전 달"${isFirst ? ' disabled' : ''}>${ICONS.back}</button>
          <h2 class="month">${m.getFullYear()}년 ${m.getMonth() + 1}월</h2>
          <button class="nav-btn" type="button" data-cal="1" aria-label="다음 달"${isThis ? ' disabled' : ''}>${ICONS.next}</button>
        </div>
        ${isThis ? '' : '<button class="today-btn" type="button" data-cal="now">오늘</button>'}
      </div>
      <div class="cal-labels">${weekLabelsHtml()}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <h2 class="sec-title">연속</h2>
    <div class="stats">
      <div class="stat"><span>현재</span><b>${currentStreak(h)}<small>일째</small></b></div>
      <div class="stat"><span>최고</span><b>${bestStreak(h)}<small>일</small></b></div>
    </div>
    <h2 class="sec-title">달성률</h2>
    <div class="stats">
      <div class="stat"><span>이번 주</span><b>${weekP ?? '-'}<small>%</small></b></div>
      <div class="stat"><span>이번 달</span><b>${monthP ?? '-'}<small>%</small></b></div>
      <div class="stat"><span>올해</span><b>${yearP ?? '-'}<small>%</small></b></div>
    </div>
    <h2 class="sec-title">월별 달성률</h2>
    ${yearChartHtml(h, ui.chartYear)}
    <h2 class="sec-title">전체</h2>
    <div class="total"><b>${totalCount(h)}번</b><span>${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일부터</span></div>`;
}

// 1~12월 막대: 높이 = 그달 달성률. 이번 달은 아직 진행 중이라 연하게
function yearChartHtml(h, yr) {
  const today = parseYmd(ui.today), start = habitStart(h);
  const vals = [...Array(12)].map((_, m) => rate(h, new Date(yr, m, 1), new Date(yr, m + 1, 0)));
  const have = vals.map((v, m) => ({ v, m })).filter(x => x.v !== null);
  let sum = '기록 없음';
  if (have.length) {
    const avg = Math.round(have.reduce((a, x) => a + x.v, 0) / have.length);
    const hi = have.reduce((a, x) => (x.v > a.v ? x : a));
    const lo = have.reduce((a, x) => (x.v < a.v ? x : a));
    sum = `월평균 ${avg}% · 최고 ${hi.m + 1}월 ${hi.v}% · 최저 ${lo.m + 1}월 ${lo.v}%`;
  }
  const isNow = m => yr === today.getFullYear() && m === today.getMonth();
  const bars = vals.map((v, m) => (v === null ? '<span></span>' :
    `<span class="yc-bar${isNow(m) ? ' now' : ''}" style="height:${v}%" title="${m + 1}월 ${v}%"></span>`)).join('');
  const lines = [0, 50, 100].map(p => `<i class="yc-line" style="bottom:${p}%"><span>${p}%</span></i>`).join('');
  return `
    <div class="yc" style="--hc:var(--c-${h.color})">
      <div class="cal-head">
        <div class="cal-nav">
          <button class="nav-btn" type="button" data-yr="-1" aria-label="이전 해"${yr <= start.getFullYear() ? ' disabled' : ''}>${ICONS.back}</button>
          <h3 class="month">${yr}년</h3>
          <button class="nav-btn" type="button" data-yr="1" aria-label="다음 해"${yr >= today.getFullYear() ? ' disabled' : ''}>${ICONS.next}</button>
        </div>
      </div>
      <div class="yc-sum">${sum}</div>
      <div class="yc-plot">${lines}${bars}</div>
      <div class="yc-labels">${vals.map((_, m) => `<span>${m + 1}</span>`).join('')}</div>
    </div>`;
}

function moveCal(v) {
  const today = parseYmd(ui.today), m = ui.calMonth;
  ui.calMonth = v === 'now' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(m.getFullYear(), m.getMonth() + Number(v), 1);
  render();
}

function checkFromCal(k) {
  const h = findHabit(ui.habitId);
  if (!h) return;
  if (toggleDay(h, k)) ui.pop = h.id + '@' + k;
  saveState();
  render();
}

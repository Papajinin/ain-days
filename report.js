// AIN Days 리포트 v1: 주간(습관 × 요일) · 월간(작은 달력) · 연간(1년 작은 칸). 보관한 습관은 숨김, 잠금 없이 끝까지 넘김

function reportHtml() {
  const r = ui.rep, today = parseYmd(ui.today);
  const list = state.habits.filter(h => !h.archived);
  let from, to, title, body;

  if (r.tab === 'week') {
    from = addDays(weekStartOf(today), r.off * 7);
    to = addDays(from, 6);
    title = `${from.getMonth() + 1}월 ${from.getDate()}일 – ${to.getMonth() !== from.getMonth() ? (to.getMonth() + 1) + '월 ' : ''}${to.getDate()}일`;
    body = `<div class="wk">
      <div class="wk-row head"><span></span>${weekLabelsHtml()}<span></span></div>
      ${list.map(h => `<div class="wk-row" style="--hc:var(--c-${h.color})">
        <span class="wk-name">${dotHtml(h)}<span>${escapeHtml(h.name)}</span></span>
        ${[...Array(7)].map((_, i) => `<i class="${cellCls(h, addDays(from, i))}"></i>`).join('')}
        <span class="pct">${pctText(rate(h, from, to))}</span>
      </div>`).join('')}
    </div>`;
  } else if (r.tab === 'month') {
    from = new Date(today.getFullYear(), today.getMonth() + r.off, 1);
    to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    title = `${from.getFullYear()}년 ${from.getMonth() + 1}월`;
    body = `<div class="mg">${list.map(h => {
      let cells = '';
      for (let i = 0; i < weekLead(from); i++) cells += '<i class="cell out"></i>';
      for (let n = 1; n <= to.getDate(); n++) cells += `<i class="${cellCls(h, new Date(from.getFullYear(), from.getMonth(), n))}"></i>`;
      return `<div class="mc" style="--hc:var(--c-${h.color})">
        <div class="mc-head">${dotHtml(h)}<span>${escapeHtml(h.name)}</span><span class="pct">${pctText(rate(h, from, to))}</span></div>
        <div class="mc-grid">${cells}</div>
      </div>`;
    }).join('')}</div>`;
  } else {
    const yr = today.getFullYear() + r.off;
    from = new Date(yr, 0, 1);
    to = new Date(yr, 11, 31);
    title = `${yr}년`;
    // 한 줄 = 한 주 (세로 7칸), 가로로 한 해
    const gStart = weekStartOf(from);
    const weeks = Math.floor((to - gStart) / 86400000 / 7) + 1;
    const cols = `grid-template-columns:repeat(${weeks},1fr)`;
    const months = [...Array(12)].map((_, m) => {
      const w = Math.floor((new Date(yr, m, 1) - gStart) / 86400000 / 7) + 1;
      return `<span style="grid-row:1;grid-column:${w} / span 4">${m % 3 === 0 ? (m + 1) + '월' : ''}</span>`;
    }).join('');
    body = `<div class="yl">${list.map(h => {
      let cells = '';
      for (let i = 0; i < weeks * 7; i++) {
        const d = addDays(gStart, i);
        cells += d.getFullYear() !== yr ? '<i class="cell out"></i>' : `<i class="${cellCls(h, d)}"></i>`;
      }
      const n = Object.keys(h.days).filter(k => k.startsWith(yr + '-')).length;
      return `<div class="yi" style="--hc:var(--c-${h.color})">
        <div class="mc-head">${dotHtml(h)}<span>${escapeHtml(h.name)}</span><span class="pct">${n}번 · ${pctText(rate(h, from, to))}</span></div>
        <div class="yg" style="${cols}">${cells}</div>
        <div class="ym" style="${cols}">${months}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // 가장 먼저 기록을 시작한 습관의 첫날까지 넘겨 볼 수 있음
  const firstStart = list.reduce((a, h) => { const s = habitStart(h); return !a || s < a ? s : a; }, null);
  const prevOk = firstStart && from > firstStart;
  return `
    <header class="top sub">
      <button class="icon-btn" type="button" data-back aria-label="뒤로"><span class="icon-circle">${ICONS.back}</span></button>
      <h1><span>리포트</span></h1>
      <span></span>
    </header>
    <div class="seg wide tabs" role="group" aria-label="기간">${[['week', '주간'], ['month', '월간'], ['year', '연간']].map(([k, l]) =>
      `<button type="button" data-tab="${k}" class="${r.tab === k ? 'on' : ''}" aria-pressed="${r.tab === k}">${l}</button>`).join('')}</div>
    <div class="rp-head">
      <div class="cal-nav">
        <button class="nav-btn" type="button" data-rp="-1" aria-label="이전"${prevOk ? '' : ' disabled'}>${ICONS.back}</button>
        <h2 class="month">${title}</h2>
        <button class="nav-btn" type="button" data-rp="1" aria-label="다음"${r.off < 0 ? '' : ' disabled'}>${ICONS.next}</button>
      </div>
      ${r.off ? '<button class="today-btn" type="button" data-rp="now">오늘</button>' : ''}
    </div>
    ${list.length ? body : '<p class="empty">습관을 추가하면 여기에 기록이 모여요.</p>'}`;
}

function cellCls(h, d) {
  if (d > parseYmd(ui.today) || d < habitStart(h)) return 'cell fut';
  return isOn(h, ymd(d)) ? 'cell on' : 'cell';
}

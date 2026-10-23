// AIN Days 설정 v1: 화면 모드, 테마 색, 한 주의 시작, 계정 (AIN Cost와 같은 구성에서 필요한 것만)

const settingsOverlay = document.getElementById('settingsOverlay');
const sTheme = document.getElementById('sTheme');
const sAccent = document.getElementById('sAccent');
const sWeek = document.getElementById('sWeek');

function markSeg(seg, v) {
  seg.querySelectorAll('button').forEach(b => {
    const on = b.dataset.v === String(v);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
}

function renderSettings() {
  markSeg(sTheme, state.settings.theme);
  markSeg(sAccent, state.settings.accent);
  markSeg(sWeek, state.settings.weekStart);
  const signedIn = typeof cloud !== 'undefined' && cloud.user;
  document.getElementById('sAccount').hidden = !signedIn;
  document.getElementById('localNote').hidden = !!signedIn || cloudConfigured();
  if (signedIn) document.getElementById('accountEmail').textContent = cloud.user.email || '';
}

function openSettings() {
  renderSettings();
  showOverlay(settingsOverlay);
}

function onSeg(seg, key, cast) {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.settings[key] = cast ? cast(b.dataset.v) : b.dataset.v;
    applyTheme();
    saveState();
    renderSettings();
    render();
  });
}
onSeg(sTheme, 'theme');
onSeg(sAccent, 'accent');
onSeg(sWeek, 'weekStart', Number);

document.getElementById('settingsClose').addEventListener('click', () => hideOverlay(settingsOverlay));
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) hideOverlay(settingsOverlay); });
document.getElementById('logoutBtn').addEventListener('click', () => confirmSignOut());

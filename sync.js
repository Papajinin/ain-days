// AIN Days 클라우드 v1: 구글 로그인 + 실시간 동기화 (Firebase Auth + Firestore) — AIN Cost와 같은 방식
//  - 클라우드 위치: users/{uid} 문서(설정) + users/{uid}/habits/{습관 id} 문서 하나씩 (이름, 색, 시작한 날, 보관, 순서, 체크한 날)
//  - 습관을 하나씩 따로 저장해서, 폰과 PC에서 서로 다른 습관을 체크해도 덮어쓰지 않음
//  - 다른 기기에서 바꾸면 onSnapshot으로 바로 받아서 화면을 다시 그림
//  - 인터넷이 끊겨도 Firestore가 기기에 저장해 뒀다가 연결되면 올림
//  - 누가 쓸 수 있는지는 Firebase 관리 화면의 Firestore "규칙"에서 정함 (firestore.rules 참고)
//  - 아래 설정값이 비어 있으면 로그인 없이 이 기기에만 저장 (클라우드 연결 전 확인용)

// Firebase 관리 화면 → 프로젝트 설정 → 내 앱(웹)에서 복사해 넣는 값
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

const UID_KEY = 'ainDays.uid';          // 이 기기에 마지막으로 로그인한 사람
const LOCAL_ONLY_SETTINGS = ['theme'];  // 기기마다 따로 두는 설정 (AIN Todo·Cost와 같게)

const loginEl = document.getElementById('login');
const loginError = document.getElementById('loginError');

const cloud = {
  auth: null,
  db: null,
  user: null,
  ready: false,            // 첫 내려받기가 끝났는지 (끝나기 전에는 올리지 않음)
  gotUser: false,
  gotHabits: false,
  unsubs: [],
  shadowHabits: new Map(), // 클라우드에 있는 습관 (id → 글자) — 바뀐 것만 올리려고
  shadowUser: ''
};

function cloudConfigured() {
  return !!FIREBASE_CONFIG.apiKey;
}

// 키 순서와 상관없이 같은 내용인지 비교하려고 키를 정렬해서 글자로 만듦
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function userPayload() {
  const settings = { ...state.settings };
  LOCAL_ONLY_SETTINGS.forEach(k => delete settings[k]);
  return { settings };
}
// 클라우드에 올리는 습관 한 개 (순서는 목록 위치)
function habitPayload(h, i) {
  const { id: _, ...data } = h;
  return { ...data, order: i };
}

// ---------- 로그인 화면 ----------
function showLogin(msg) {
  loginError.textContent = msg || '';
  loginError.hidden = !msg;
  loginEl.hidden = false;
}
function hideLogin() {
  loginEl.hidden = true;
}
function showLoginError(err) {
  console.warn(err);
  showLogin('로그인하지 못했어요. 잠시 뒤 다시 해 주세요.' + (err && err.code ? ` (${err.code})` : ''));
}

// ---------- 시작 ----------
function initCloud() {
  if (!cloudConfigured()) return; // 클라우드 연결 전: 이 기기에만 저장
  if (!window.firebase) {
    // 인터넷이 없어 Firebase를 못 불러온 경우: 전에 로그인했으면 기기에 저장된 내용으로 계속
    if (!localStorage.getItem(UID_KEY)) showLogin('인터넷 연결을 확인해 주세요.');
    return;
  }
  firebase.initializeApp(FIREBASE_CONFIG);
  cloud.auth = firebase.auth();
  cloud.db = firebase.firestore();
  cloud.db.settings({ ignoreUndefinedProperties: true });
  cloud.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  cloud.auth.getRedirectResult().catch(showLoginError);
  cloud.auth.onAuthStateChanged(user => {
    if (user) startSync(user);
    else {
      stopSync();
      showLogin();
    }
  });
  // 전에 로그인한 적이 없으면 확인을 기다리지 않고 바로 로그인 화면
  if (!localStorage.getItem(UID_KEY)) showLogin();
}

function signIn() {
  if (!cloud.auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  cloud.auth.signInWithPopup(provider).catch(err => {
    // 팝업이 막힌 환경(홈 화면 앱 등)이면 페이지 이동 방식으로 다시
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      return cloud.auth.signInWithRedirect(provider).catch(showLoginError);
    }
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') showLoginError(err);
  });
}

// ---------- 동기화 ----------
function userRef() {
  return cloud.db.collection('users').doc(cloud.user.uid);
}

function startSync(user) {
  stopSync();
  cloud.user = user;

  // 이 기기에 다른 사람이 쓰던 내용이 있으면 비움
  // (처음 로그인할 때 이 기기에만 저장해 둔 습관은 그대로 두었다가 클라우드로 올림)
  const prev = localStorage.getItem(UID_KEY);
  if (prev && prev !== user.uid) resetLocalState();
  cloud.firstLink = !prev; // 이 기기에서 처음 로그인
  try { localStorage.setItem(UID_KEY, user.uid); } catch (e) {}

  const ref = userRef();
  // 허용된 계정인지 확인하면서, 처음 쓰는 사람이면 설정 문서를 만들어 둠
  ref.get().then(snap => {
    if (!snap.exists) {
      return ref.set({ ...userPayload(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  }).then(subscribe, err => {
    if (err.code === 'permission-denied') return denyAccount();
    subscribe(); // 인터넷이 없을 때 등: 기기에 저장된 내용으로 계속
  });
}

function subscribe() {
  if (!cloud.user) return;
  hideLogin();
  const ref = userRef();
  // 이 기기에서 처음 로그인할 때만: 로그인 전에 이 기기에만 저장해 둔 습관을 클라우드로 올림
  // (그 뒤에는 클라우드가 기준. 다른 기기에서 지운 습관이 되살아나지 않게)
  cloud.pendingLocal = cloud.firstLink ? state.habits.slice() : null;
  cloud.unsubs.push(ref.onSnapshot(onUserSnap, onCloudError));
  cloud.unsubs.push(ref.collection('habits').onSnapshot(onHabitsSnap, onCloudError));
}

function onUserSnap(snap) {
  if (snap.exists) {
    const d = snap.data();
    const local = {};
    LOCAL_ONLY_SETTINGS.forEach(k => { local[k] = state.settings[k]; });
    state.settings = { ...state.settings, ...(d.settings || {}), ...local };
    cloud.shadowUser = stableStringify(userPayload());
    applyTheme(); // 다른 기기에서 테마 색을 바꿨으면 바로 반영
  }
  cloud.gotUser = true;
  afterSnapshot();
}

function onHabitsSnap(snap) {
  const habits = [];
  cloud.shadowHabits = new Map();
  snap.forEach(doc => {
    const d = doc.data();
    habits.push({ ...d, id: doc.id, days: d.days || {} });
    cloud.shadowHabits.set(doc.id, stableStringify(d));
  });
  habits.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  habits.forEach(h => { delete h.order; });
  // 처음 연결할 때: 이 기기에만 있던 습관을 뒤에 붙여서 올림
  let merged = false;
  if (cloud.pendingLocal) {
    cloud.pendingLocal.forEach(h => { if (!habits.some(x => x.id === h.id)) { habits.push(h); merged = true; } });
    cloud.pendingLocal = null;
  }
  state.habits = habits;
  cloud.gotHabits = true;
  afterSnapshot(merged);
}

function afterSnapshot(merged) {
  if (cloud.gotUser && cloud.gotHabits) cloud.ready = true;
  saveLocal();
  if (merged) cloudSave();
  refreshViews();
}

// 다른 기기에서 바뀐 내용을 화면에 반영 (끄는 중이거나 입력 중인 곳은 건드리지 않음)
function refreshViews() {
  if (typeof drag !== 'undefined' && drag && drag.on) return;
  render();
  if (!settingsOverlay.hidden) renderSettings();
}

// saveState()가 부름: 바뀐 습관만 골라서 올림
function cloudSave() {
  if (!cloud.user || !cloud.ready) return;
  const ref = userRef();
  const ops = [];
  const ids = new Set();

  state.habits.forEach((h, i) => {
    ids.add(h.id);
    const data = habitPayload(h, i);
    const json = stableStringify(data);
    if (cloud.shadowHabits.get(h.id) === json) return;
    ops.push(b => b.set(ref.collection('habits').doc(h.id), data));
    cloud.shadowHabits.set(h.id, json);
  });
  cloud.shadowHabits.forEach((_, id) => {
    if (ids.has(id)) return;
    ops.push(b => b.delete(ref.collection('habits').doc(id)));
    cloud.shadowHabits.delete(id);
  });
  const u = stableStringify(userPayload());
  if (u !== cloud.shadowUser) {
    ops.push(b => b.set(ref, userPayload(), { merge: true }));
    cloud.shadowUser = u;
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = cloud.db.batch();
    ops.slice(i, i + 400).forEach(f => f(batch));
    batch.commit().catch(onCloudError);
  }
}

function onCloudError(err) {
  console.warn(err);
  if (err && err.code === 'permission-denied') denyAccount();
}

function stopSync() {
  cloud.unsubs.forEach(u => u());
  cloud.unsubs = [];
  cloud.user = null;
  cloud.ready = cloud.gotUser = cloud.gotHabits = false;
  cloud.shadowHabits = new Map();
  cloud.shadowUser = '';
}

// 허용 목록에 없는 계정
function denyAccount() {
  stopSync();
  try { localStorage.removeItem(UID_KEY); } catch (e) {}
  resetLocalState();
  cloud.auth.signOut();
  showLogin('이 계정은 사용할 수 없어요. 가족 계정으로 로그인해 주세요.');
}

// 기기에 저장된 습관을 비움 (화면 모드는 남김)
function resetLocalState() {
  state.habits = [];
  state.settings = { theme: state.settings.theme, accent: 'blue', weekStart: 0 };
  saveLocal();
  applyTheme();
  render();
}

function confirmSignOut() {
  showActions('로그아웃하면 이 기기에서 기록이 보이지 않아요. 다시 로그인하면 그대로 돌아와요.', [
    { label: '로그아웃', danger: true, fn: () => {
      stopSync();
      try { localStorage.removeItem(UID_KEY); } catch (e) {}
      resetLocalState();
      hideOverlay(settingsOverlay);
      cloud.auth.signOut();
    } }
  ]);
}

document.getElementById('loginBtn').addEventListener('click', signIn);

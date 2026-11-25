import { parseRoute, routeTotals, serviceRequired, findSteps, formatMiles, MAX_ROUTE_BYTES } from './route.mjs';
import { normalizePosition, moveGuidance, mailboxLabel, sequenceLabel, mailboxReminder } from './mailboxes.mjs';
import { normalizeFix, usableFix, assistEligible, newAssist, updateAssist, formatDistance, freshFix } from './gps.mjs';
import { demoRoute } from './demo.mjs';
import { createRouteMap, distanceFromStep } from './map.mjs';

const $ = id => document.getElementById(id);
const ACTION = {
  north: 'Head north from', depart: 'Leave from', straight: 'Continue on', left: 'Turn left onto', right: 'Turn right onto',
  'bear-left': 'Bear left onto', 'bear-right': 'Bear right onto', roundabout: 'Second exit onto',
  return: 'Turn into', finish: 'Route complete',
};
const STORE = {
  route: 'route-scout.route.v1', personalProgress: 'route-scout.progress.personal.v1',
  demoProgress: 'route-scout.progress.demo.v1', settings: 'route-scout.settings.v1',
};
const currentViews = ['guide', 'steps', 'settings'];
const speech = window.speechSynthesis;
const hasVoice = Boolean(speech && window.SpeechSynthesisUtterance);
const hasWake = Boolean(navigator.wakeLock?.request);
const localMode = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let demo, route, index = 0, mailboxIndex = 0, view = 'guide';
let assist = newAssist();
let stopsOnly = false, toastTimeout, confirmAction, importVersion = 0;
let tracking = false, watch = null, gpsRun = 0, fix = null, gpsError = '', wake = null, wakePending = false;
let routeToken = null, localProblem = '';
const savedSettings = getJSON(STORE.settings);
const settings = { voice: savedSettings?.voice === true && hasVoice, auto: savedSettings?.auto === true, awake: hasWake && savedSettings?.awake !== false };

const map = createRouteMap({
  viewport: $('map-viewport'), canvas: $('map-svg'), empty: $('map-empty'), controls: $('map-controls'),
  plus: $('zoom-in'), minus: $('zoom-out'), fit: $('map-fit'), center: $('map-center'),
});

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function getJSON(key) {
  try { return JSON.parse(storageGet(key)); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

function storageDelete(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}

function make(tag, className = '', contents = '') {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = contents;
  return e;
}

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function displayAction(step) {
  if (step.action === 'straight' && step.title === 'Current road') return '';
  if (step.action === 'north' && /^Head north on /i.test(step.source)) return 'Head north on';
  if (step.action === 'left' && /^Turn Left into/i.test(step.source)) return 'Turn left into';
  if (step.action === 'right' && /^Turn Right and Service/i.test(step.source)) return 'Turn right and service';
  return ACTION[step.action];
}

function displayTitle(step) {
  return step.action === 'straight' && step.title === 'Current road' ? 'Continue straight' : step.title;
}

function stepPhrase(step) {
  return [displayAction(step), displayTitle(step)].filter(Boolean).join(' ');
}

function step() { return route.steps[index]; }
function nextStep() { return route.steps[index + 1]; }
function demoActive() { return route.id === demo.id; }
function progressKey(token = routeToken) {
  return demoActive() ? STORE.demoProgress : token && `${STORE.personalProgress}.${token}`;
}

function storedRoute() {
  const raw = storageGet(STORE.route);
  if (!raw) return null;
  const data = JSON.parse(raw);
  // Plain route JSON was used by the first local preview.
  const token = typeof data?.token === 'string' ? data.token : 'legacy';
  return { route: parseRoute(data?.route ?? data), token };
}

function storedToken() {
  try {
    const raw = storageGet(STORE.route);
    if (!raw) return null;
    const token = JSON.parse(raw)?.token;
    return typeof token === 'string' ? token : 'legacy';
  } catch { return null; }
}

function restoreProgress() {
  const key = progressKey();
  const saved = key ? getJSON(key) : null;
  return saved?.routeId === route.id && saved.effective === route.effective
    ? normalizePosition(route, saved) : { index: 0, mailboxIndex: 0 };
}

function saveProgress() {
  const key = progressKey();
  if (key && (demoActive() || routeToken === storedToken())) {
    if (!storageSet(key, { routeId: route.id, effective: route.effective, index, mailboxIndex })) {
      toast('This browser couldn’t save your position.');
    }
  }
}

function toast(message) {
  const node = $('toast');
  clearTimeout(toastTimeout);
  node.textContent = message;
  node.hidden = false;
  toastTimeout = setTimeout(() => { node.hidden = true; }, 5700);
}

function setRoute(next, { persist = false, restore = false, token = null } = {}) {
  speech?.cancel();
  if (persist) {
    const oldToken = storedToken();
    const newToken = crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    if (storageSet(STORE.route, { route: next, token: newToken })) {
      token = newToken;
      if (oldToken) storageDelete(`${STORE.personalProgress}.${oldToken}`);
    }
  }
  route = next;
  routeToken = token;
  const position = restore ? restoreProgress() : { index: 0, mailboxIndex: 0 };
  index = position.index;
  mailboxIndex = position.mailboxIndex;
  assist = newAssist();
  stopsOnly = false;
  $('stops-only').setAttribute('aria-pressed', 'false');
  $('step-search').value = '';
  if (!restore) saveProgress();
  map.setMap(route.map);
  renderRoute();
  renderStep();
  renderList();
  renderSettings();
}

function renderRoute() {
  $('route-name').textContent = route.name;
  $('route-area').textContent = route.area;
  $('route-kicker').textContent = demoActive() ? 'Postal route guide' : route.id;
  $('demo-badge').hidden = !demoActive();
  $('demo-notice').hidden = !demoActive();
  const totals = routeTotals(route);
  const stats = [['Mileage', formatMiles(totals.miles)], ['Steps', totals.steps], ['Stops', totals.stops]];
  $('route-stats').replaceChildren(...stats.map(([label, value]) => {
    const stat = make('div', 'stat');
    stat.append(make('strong', '', value), make('span', '', label));
    return stat;
  }));
  $('map-subtitle').textContent = demoActive() ? 'Fictional overview' : route.map ? 'From the route packet' : 'No map included';
  $('map-credit').hidden = !route.map?.attribution;
}

function chip(label, symbol, highlight = false) {
  const item = make('span', highlight ? 'turn-chip service' : 'turn-chip');
  if (symbol) item.append(icon(symbol));
  item.append(document.createTextNode(label));
  return item;
}

function renderStep() {
  const active = step();
  const next = nextStep();
  const done = !active;
  $('progress-label').textContent = done ? 'End of route' : 'Route progress';
  $('progress-count').textContent = done ? `${route.steps.length} / ${route.steps.length}` : `Step ${index + 1} / ${route.steps.length}`;
  $('progress-meter').max = route.steps.length;
  $('progress-meter').value = index;
  $('turn-kicker').textContent = done ? 'Line of travel complete' : 'Current instruction';
  $('turn-action').textContent = done ? '' : displayAction(active);
  $('turn-title').textContent = done ? 'Route complete' : displayTitle(active);
  $('maneuver-icon').replaceChildren(icon(done ? 'finish' : active.action));
  $('read-step').disabled = !hasVoice || done;
  const notes = $('turn-details');
  notes.hidden = !active?.details.length;
  notes.replaceChildren();
  if (!notes.hidden) {
    const list = make('ol');
    list.append(...active.details.map(note => make('li', '', note)));
    notes.append(list);
  }
  const mailbox = active?.mailboxes[mailboxIndex];
  const mailboxCount = active?.mailboxes.length ?? 0;
  $('mailbox-guidance').hidden = !mailbox;
  $('mailbox-position').textContent = mailbox ? `Mailbox ${mailboxIndex + 1} of ${mailboxCount}` : '';
  $('mailbox-name').textContent = mailbox ? mailboxLabel(mailbox, mailboxIndex) : '';
  $('mailbox-name').hidden = !mailbox || mailbox.label === `Mailbox ${mailboxIndex + 1}`;
  $('mailbox-sequence').textContent = mailbox ? sequenceLabel(mailbox) : '';
  const meta = $('turn-meta');
  meta.replaceChildren();
  if (done) {
    meta.append(chip('You’ve reached the last instruction.', 'finish'));
  } else {
    if (active.miles > 0) meta.append(chip(formatMiles(active.miles), 'guide'));
    if (serviceRequired(active)) {
      const label = active.stops > 0 ? `${active.stops} service ${active.stops === 1 ? 'stop' : 'stops'}` : 'Service mailbox';
      meta.append(chip(label, 'mail', true));
      if (active.regular) meta.append(chip(`${active.regular} regular`));
      if (active.centralized) meta.append(chip(`${active.centralized} centralized`));
    } else {
      meta.append(chip(active.id === 1 ? 'Route start' : 'Drive only'));
    }
  }
  $('previous').disabled = index === 0 && mailboxIndex === 0;
  const nextMailbox = active?.mailboxes[mailboxIndex + 1];
  $('next-label').textContent = done ? 'Restart route'
    : mailbox ? nextMailbox ? 'Mailbox done · Next mailbox' : next ? 'Mailbox done · Next step' : 'Mailbox done · Finish'
      : next ? serviceRequired(active) ? 'Service done · Next' : 'Next step'
        : serviceRequired(active) ? 'Service done · Finish' : 'Finish route';
  const upcoming = $('up-next');
  upcoming.hidden = done;
  if (!done) {
    const leading = make('span', 'soft-icon');
    leading.append(icon(nextMailbox ? 'mail' : next?.action ?? 'finish'));
    const label = make('span', 'up-text');
    label.append(make('span', 'up-label', nextMailbox ? `Up next · Mailbox ${mailboxIndex + 2} of ${mailboxCount}` : next ? `Up next · Step ${next.id}` : 'After this step'),
      make('strong', '', nextMailbox ? mailboxLabel(nextMailbox, mailboxIndex + 1) : next ? stepPhrase(next) : 'End of line of travel'));
    upcoming.replaceChildren(leading, label, icon('chevron'));
    upcoming.setAttribute('aria-label', nextMailbox ? `Next mailbox: ${mailboxLabel(nextMailbox, mailboxIndex + 1)}. View route steps`
      : next ? `Up next: ${stepPhrase(next)}. View route steps` : 'View all route steps');
  }
  renderGPS();
}

function renderList() {
  const steps = findSteps(route, $('step-search').value, stopsOnly);
  $('list-count').textContent = `${steps.length} of ${route.steps.length} steps`;
  $('step-list').replaceChildren(...steps.map(s => {
    const li = make('li');
    const btn = make('button', 'step-row');
    btn.type = 'button';
    btn.dataset.index = String(s.id - 1);
    if (s.id === index + 1) btn.setAttribute('aria-current', 'step');
    const turnIcon = make('span', 'soft-icon');
    turnIcon.append(icon(s.action));
    const words = make('span');
    words.append(make('span', 'step-name', displayTitle(s)), make('span', 'step-description', s.source));
    const meta = make('span', 'step-distance', s.miles > 0 ? formatMiles(s.miles) : '');
    if (serviceRequired(s)) meta.append(make('span', 'step-service', s.stops ? `${s.stops} ${s.stops === 1 ? 'stop' : 'stops'}` : 'Service'));
    btn.append(make('span', 'step-number', String(s.id).padStart(2, '0')), turnIcon, words, meta);
    li.append(btn);
    return li;
  }));
}

function renderSettings() {
  const saved = storedToken();
  const openSaved = !demoActive() && saved && saved !== routeToken;
  $('file-summary').textContent = demoActive()
    ? `Choose the prepared .route.json file from Files.${saved ? ' Your imported route is still saved here.' : ''}`
    : `${route.id} · ${route.steps.length} steps${route.effective ? ` · Effective ${route.effective}` : ''} · ${routeToken && routeToken === saved ? 'Saved here' : 'Open for this session'}`;
  $('remove-route').hidden = !saved || (!demoActive() && routeToken !== saved);
  $('use-demo').textContent = (demoActive() && saved) || openSaved ? 'Open saved route' : 'Try demo';
  $('use-demo').disabled = (demoActive() && !saved) || (!demoActive() && !routeToken && !openSaved);
  $('voice').checked = settings.voice;
  $('voice').disabled = !hasVoice;
  $('awake').checked = settings.awake;
  $('awake').disabled = !hasWake;
  $('auto').checked = settings.auto;
}

function setView(next, syncHash = true) {
  view = currentViews.includes(next) ? next : 'guide';
  currentViews.forEach(name => { $(name).hidden = name !== view; });
  for (const btn of document.querySelectorAll('[data-view]')) {
    if (btn.dataset.view === view) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  if (view === 'steps') renderList();
  if (view === 'settings') renderSettings();
  if (syncHash && location.hash !== `#${view}`) {
    history.replaceState(null, '', `#${view}`);
    window.scrollTo(0, 0);
  }
}

function go(event, target) {
  const priorIndex = index;
  const moved = moveGuidance(route, { index, mailboxIndex }, event, target);
  if (moved.index === index && moved.mailboxIndex === mailboxIndex && event !== 'reset') return;
  index = moved.index;
  mailboxIndex = moved.mailboxIndex;
  assist = newAssist();
  saveProgress();
  renderStep();
  if (view === 'steps') renderList();
  speech?.cancel();
  if (settings.voice && step()) announce(index !== priorIndex || event === 'jump' || event === 'reset');
}

function announce(includeTurn = true) {
  if (!hasVoice || !step()) return;
  const voices = speech.getVoices().filter(voice => voice.localService);
  const voice = voices.find(voice => /^en-US$/i.test(voice.lang)) ??
    voices.find(voice => /^en(?:-|$)/i.test(voice.lang));
  if (!voice) { toast('There’s no on-device English voice available in this browser.'); return; }
  const s = step();
  const mailbox = s.mailboxes[mailboxIndex];
  const text = [includeTurn !== false ? stepPhrase(s) : '', ...(includeTurn !== false ? s.details : []),
    mailbox ? mailboxReminder(mailbox, mailboxIndex, s.mailboxes.length)
      : serviceRequired(s) && s.stops ? `${s.stops} service ${s.stops === 1 ? 'stop' : 'stops'} on this step` : '',
  ].filter(Boolean).join('. ').replace(/\.\./g, '.')
    .replace(/\bNW\b/g, 'Northwest').replace(/\bNE\b/g, 'Northeast')
    .replace(/\bSW\b/g, 'Southwest').replace(/\bSE\b/g, 'Southeast')
    .replace(/\b(Dr|Rd|St|Ct|Pkwy|Cir|Ln|CBU)\b/g, a => ({
      Dr: 'Drive', Rd: 'Road', St: 'Street', Ct: 'Court', Pkwy: 'Parkway', Cir: 'Circle', Ln: 'Lane', CBU: 'C B U',
    })[a]);
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = .95;
  speech.speak(utterance);
}

function confirm(title, explanation, label, callback) {
  const dialog = $('confirm-dialog');
  if (dialog.open) return;
  confirmAction = callback;
  $('dialog-title').textContent = title;
  $('dialog-copy').textContent = explanation;
  $('dialog-confirm').textContent = label;
  dialog.returnValue = 'cancel';
  dialog.showModal();
}

function restart() {
  confirm('Start a new run?', 'Your saved position will go back to the first step.', 'Restart', () => {
    go('reset');
    setView('guide');
  });
}

async function importFile(file) {
  if (!file) return;
  const request = ++importVersion;
  if (file.size > MAX_ROUTE_BYTES) {
    toast('This route file is too large.');
    return;
  }
  try {
    const next = parseRoute(await file.text());
    if (request !== importVersion) return;
    if (next.id === demo.id) throw new Error('Choose a prepared personal route file.');
    if (next.map) {
      const image = new Image();
      image.src = next.map.image;
      try {
        await image.decode();
        if (image.naturalWidth !== next.map.width || image.naturalHeight !== next.map.height) throw new Error();
      } catch { throw new Error('The route map image couldn’t be opened.'); }
    }
    if (request !== importVersion) return;
    setRoute(next, { persist: true });
    setView('guide');
    toast(routeToken ? 'Route imported and saved on this device.' : 'Route imported. Storage is unavailable, so keep the file handy.');
  } catch (error) {
    if (request === importVersion) toast(`Couldn’t import the route. ${error instanceof Error ? error.message : 'Try choosing it again.'}`);
  }
}

function textIfChanged(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function renderGPS() {
  if (!route) return;
  const active = step();
  const next = nextStep();
  const hasFix = tracking && !document.hidden && !gpsError && usableFix(fix);
  const markers = map.setMarkers(active, fix, hasFix && !demoActive());
  let label = 'GPS off';
  let status = 'Enable GPS to show your position.';
  let kind = '';
  if (tracking && document.hidden) {
    label = 'GPS paused'; status = 'Return to Route Scout to resume location.';
  } else if (gpsError) {
    label = 'GPS unavailable'; status = gpsError; kind = 'warning';
  } else if (tracking) {
    if (hasFix) {
      label = 'GPS on'; kind = 'on';
      const accuracy = `Phone accuracy about ${formatDistance(fix.accuracy)}.`;
      if (demoActive()) status = 'GPS is available. Import your route to see your location.';
      else if (!route.map?.bounds) status = `Location available. This map has no GPS alignment. ${accuracy}`;
      else if (!markers.location) status = `You’re outside the area on this map. ${accuracy}`;
      else status = `Location is approximate. ${accuracy}`;
    } else if (fix) {
      label = 'GPS weak'; kind = 'warning';
      status = 'Waiting for a fresh, more accurate position.';
    } else {
      label = 'Finding GPS'; status = 'Waiting for a location fix…';
    }
  }
  $('map-live').dataset.kind = kind;
  textIfChanged($('map-live-label'), label);
  textIfChanged($('gps-status'), status);
  $('gps-toggle').dataset.kind = tracking ? 'on' : '';
  $('gps-toggle').setAttribute('aria-pressed', String(tracking));
  textIfChanged($('gps-button-label'), tracking ? 'GPS on' : 'Enable GPS');
  const distance = markers.location && active && !active.manual && !active.service ? distanceFromStep(fix, active) : null;
  const distanceLabel = $('distance-to-turn');
  distanceLabel.hidden = distance === null || distance > 1600;
  if (!distanceLabel.hidden) {
    textIfChanged(distanceLabel, distance <= 12 ? 'Near the current step pin' : `About ${formatDistance(distance)} to the step pin`);
  }

  const assistHint = $('assist-status');
  assistHint.hidden = !settings.auto || !active || demoActive();
  if (!assistHint.hidden) {
    const text = serviceRequired(active) ? 'Delivery step: advance when you’ve serviced the boxes.'
      : !assistEligible(active, next) ? 'This step uses manual advance.'
      : !hasFix ? 'GPS advance is waiting for location.'
      : assist.entered ? 'GPS advance is watching for the next turn.' : 'GPS advance is waiting for the start of this step.';
    textIfChanged(assistHint, text);
  }
}

function stopWatch() {
  gpsRun += 1;
  if (watch != null) navigator.geolocation.clearWatch(watch);
  watch = null;
}

function stopGPS(clearError = true) {
  tracking = false;
  stopWatch();
  fix = null;
  assist = newAssist();
  if (clearError) gpsError = '';
  renderGPS();
  syncWake();
}

function onFix(position, run) {
  if (run !== gpsRun || !tracking || document.hidden) return;
  const candidate = normalizeFix(position);
  if (!freshFix(candidate, fix)) return;
  fix = candidate;
  gpsError = '';
  if (settings.auto && !demoActive()) {
    assist = updateAssist(assist, step(), nextStep(), fix);
    if (assist.advance) {
      go('next');
      // The two readings that completed this leg also confirm the start of the new leg.
      assist = updateAssist(assist, step(), nextStep(), fix);
    }
  }
  renderGPS();
}

function startWatch() {
  if (document.hidden || !tracking || watch != null) return;
  const run = ++gpsRun;
  watch = navigator.geolocation.watchPosition(position => onFix(position, run), error => {
    if (run !== gpsRun || !tracking) return;
    fix = null;
    assist = newAssist();
    if (error.code === 1) {
      gpsError = 'Location permission is off. Allow it in your browser settings, then try again.';
      stopGPS(false);
    } else {
      gpsError = 'A location fix isn’t available yet. You can continue with the step buttons.';
      renderGPS();
    }
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 16000 });
}

function toggleGPS() {
  if (tracking) { stopGPS(); return; }
  if (!window.isSecureContext || !navigator.geolocation) {
    gpsError = 'Open Route Scout over HTTPS to enable GPS.';
    renderGPS();
    toast(gpsError);
    return;
  }
  gpsError = '';
  tracking = true;
  try { startWatch(); } catch {
    gpsError = 'Couldn’t start GPS in this browser.';
    stopGPS(false);
  }
  renderGPS();
  syncWake();
}

async function syncWake() {
  const needed = () => hasWake && settings.awake && tracking && !document.hidden;
  if (!needed()) {
    if (wake && !wake.released) wake.release().catch(() => {});
    wake = null;
    return;
  }
  if ((wake && !wake.released) || wakePending) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (needed()) {
      wake = lock;
      lock.addEventListener('release', () => { if (wake === lock) wake = null; }, { once: true });
    } else {
      await lock.release();
    }
  } catch { /* Low-power mode and browser policy can decline a wake lock. */ }
  finally { wakePending = false; }
}

async function initializeDemo() {
  try {
    const res = await fetch('./demo-map.png');
    if (!res.ok) return parseRoute(demoRoute(null));
    const img = await res.blob();
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(img);
    });
    return parseRoute(demoRoute(data));
  } catch { return parseRoute(demoRoute(null)); }
}

async function boot() {
  demo = await initializeDemo();
  let load = null;
  let token = null;
  try {
    const stored = storedRoute();
    if (stored) ({ route: load, token } = stored);
  } catch { localProblem = 'The saved file couldn’t be opened. Import your route again.'; }
  if (!load && localMode && new URLSearchParams(location.search).get('local') === '1') {
    try {
      const result = await fetch('/__local-route.json', { cache: 'no-store' });
      if (result.ok) load = parseRoute(await result.text());
    } catch { /* The static preview can be used without a prepared file. */ }
  }
  if (localMode && new URLSearchParams(location.search).has('local')) {
    const url = new URL(location.href);
    url.searchParams.delete('local');
    history.replaceState(null, '', url);
  }
  setRoute(load ?? demo, { restore: true, token, persist: Boolean(load && !token) });
  setView(location.hash.slice(1), false);
  if (localProblem) toast(localProblem);
  register();
}

function register() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => setView(button.dataset.view));
  }
  document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); setView('guide'); });
  window.addEventListener('hashchange', () => setView(location.hash.slice(1), false));
  $('gps-toggle').addEventListener('click', toggleGPS);
  $('read-step').addEventListener('click', announce);
  $('previous').addEventListener('click', () => go('previous'));
  $('next').addEventListener('click', () => step() ? go('next') : restart());
  $('up-next').addEventListener('click', () => {
    $('step-search').value = ''; stopsOnly = false; $('stops-only').setAttribute('aria-pressed', 'false');
    setView('steps');
    // Jump only on explicit selection; highlight the current row for context.
    $('step-list').querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' });
  });
  for (const button of document.querySelectorAll('[data-go-guide]')) button.addEventListener('click', () => setView('guide'));
  $('step-search').addEventListener('input', renderList);
  $('stops-only').addEventListener('click', () => {
    stopsOnly = !stopsOnly;
    $('stops-only').setAttribute('aria-pressed', String(stopsOnly));
    renderList();
  });
  $('step-list').addEventListener('click', event => {
    const selected = event.target.closest('[data-index]');
    if (!selected) return;
    go('jump', Number(selected.dataset.index));
    setView('guide');
  });
  for (const button of document.querySelectorAll('[data-pick-file]')) button.addEventListener('click', () => $('route-file').click());
  $('route-file').addEventListener('change', e => {
    importFile(e.target.files[0]);
    e.target.value = '';
  });
  $('confirm-dialog').addEventListener('close', event => {
    const fn = confirmAction;
    confirmAction = null;
    if (event.target.returnValue === 'confirm') fn?.();
  });
  $('restart-route').addEventListener('click', restart);
  $('remove-route').addEventListener('click', () => {
    const token = storedToken();
    confirm('Remove this saved route?', 'The copy in Files stays available for another import.', 'Remove', () => {
      if (!token || storedToken() !== token) { toast('The saved route changed in another tab. Open it before removing.'); return; }
      ++importVersion;
      if (!storageDelete(STORE.route)) { toast('Your browser couldn’t remove the saved route.'); return; }
      storageDelete(`${STORE.personalProgress}.${token}`);
      setRoute(demo);
      toast('Saved route removed.');
    });
  });
  $('use-demo').addEventListener('click', () => {
    ++importVersion;
    if (demoActive() || routeToken !== storedToken()) {
      try {
        const saved = storedRoute();
        if (!saved) throw new Error();
        setRoute(saved.route, { restore: true, token: saved.token });
      }
      catch { toast('Couldn’t open the saved route. Import the file again.'); return; }
    } else {
      setRoute(demo, { restore: true });
    }
    setView('guide');
  });
  window.addEventListener('storage', e => {
    if (e.key !== STORE.route && e.key !== null) return;
    if (!demoActive() && routeToken && routeToken !== storedToken()) {
      toast('The saved route changed in another tab. This tab won’t change its saved progress.');
    }
    if (view === 'settings') renderSettings();
  });
  for (const key of ['voice', 'auto', 'awake']) {
    $(key).addEventListener('change', event => {
      settings[key] = event.target.checked;
      storageSet(STORE.settings, settings);
      if (key === 'voice') settings.voice ? announce() : speech?.cancel();
      if (key === 'auto') { assist = newAssist(); renderGPS(); }
      if (key === 'awake') syncWake();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (!tracking) return;
    if (document.hidden) {
      stopWatch();
      fix = null;
      assist = newAssist();
      speech?.cancel();
    } else {
      gpsError = '';
      try { startWatch(); } catch { gpsError = 'Couldn’t resume GPS.'; stopGPS(false); }
    }
    renderGPS();
    syncWake();
  });
  window.setInterval(() => { if (tracking && fix && !usableFix(fix)) renderGPS(); }, 5000);
  registerOffline();
}

async function registerOffline() {
  const status = $('offline-state');
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = 'Offline setup needs HTTPS and a browser with offline storage.';
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    status.textContent = 'App saved for offline use on this device.';
  } catch { status.textContent = 'Offline setup did not finish. Open the app again with a connection.'; }
}

boot().catch(() => {
  $('turn-title').textContent = 'Couldn’t open Route Scout';
  $('turn-kicker').textContent = 'Reload to try again';
});

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const requiredFiles = [
  'index.html','app.js','styles.css','system-apps.js','arcade-expansion.js','arcade-music.js',
  'game-controls.js','game-controls.css','nimo-overdrive.js','nimo-overdrive.css','cheat-score-guard.js','navigation-shell.js','game-animations.js',
  'window-state-sync.js','input-ownership-guard.js','game-loop-guard.js','navigation-shell.css','game-animations.css',
  'app-ecosystem.js','app-ecosystem.css'
];

const failures = [];
const read = file => readFileSync(resolve(root, file), 'utf8');
const expect = (condition, message) => { if (!condition) failures.push(message); };

for (const file of requiredFiles) expect(existsSync(resolve(root, file)), `Missing required file: ${file}`);

if (!failures.length) {
  const html = read('index.html');
  const app = read('app.js');
  const music = read('arcade-music.js');
  const navigation = read('navigation-shell.js');
  const animations = read('game-animations.js');
  const animationStyles = read('game-animations.css');
  const controls = read('game-controls.js');
  const controlStyles = read('game-controls.css');
  const ecosystem = read('app-ecosystem.js');
  const ecosystemStyles = read('app-ecosystem.css');
  const windowState = read('window-state-sync.js');
  const inputGuard = read('input-ownership-guard.js');
  const loopGuard = read('game-loop-guard.js');
  const overdrive = read('nimo-overdrive.js');
  const scoreGuard = read('cheat-score-guard.js');

  for (const asset of ['navigation-shell.css','game-animations.css','game-controls.css','nimo-overdrive.css','app-ecosystem.css','navigation-shell.js','game-animations.js','game-controls.js','app-ecosystem.js','window-state-sync.js','input-ownership-guard.js','game-loop-guard.js']) {
    expect(html.includes(asset), `index.html does not load ${asset}`);
  }
  for (const installer of ['installSystemApps','installArcadeExpansion','installAppEcosystem','installArcadeMusic','installGameControls','installNavigationShell','installGameAnimations','installWindowStateSync']) {
    expect(html.includes(`${installer}(window.ArcadeOS)`), `Missing installer call: ${installer}`);
  }
  expect(html.indexOf('input-ownership-guard.js') < html.indexOf('app.js'), 'Input ownership guard must load before app.js');
  expect(html.indexOf('game-loop-guard.js') < html.indexOf('app.js'), 'Game loop guard must load before app.js');
  for (const id of ['snake','breakout','pong','blockdrop','voidinvaders','vectordrift']) {
    expect(navigation.includes(`'${id}'`), `Navigation is missing game: ${id}`);
    expect(animations.includes(`${id}:`), `Animation theme is missing game: ${id}`);
    expect(overdrive.includes(`${id}:`), `Overdrive modifiers are missing game: ${id}`);
    expect(loopGuard.includes(`'${id}'`), `Loop guard is missing game: ${id}`);
    expect(controls.includes(`'${id}'`), `Game controls is missing game: ${id}`);
  }
  expect(app.includes('window.ArcadeOS='), 'Base runtime does not expose window.ArcadeOS');
  expect(music.includes('installNimoOverdrive(ArcadeOS)'), 'Music bootstrap does not install NIMO Overdrive');
  expect(music.includes('installCheatScoreGuard(ArcadeOS)'), 'Music bootstrap does not install cheat score guard');
  expect(scoreGuard.includes('sessionStorage'), 'Cheat score guard does not isolate modified scores');
  expect(scoreGuard.includes('shouldBlockScore'), 'Cheat score guard does not consult Overdrive state');
  expect(navigation.includes('ArcadeOS.navigation'), 'Navigation service is not exposed');
  expect(animations.includes('ArcadeOS.animations'), 'Animation service is not exposed');
  expect(animations.includes("document.addEventListener('visibilitychange', syncAllSessions)"), 'Animations do not suspend when the page is hidden');
  expect(animations.includes("session.win.classList.contains('is-min')"), 'Animations do not suspend minimized sessions');
  expect(animationStyles.includes('animation-play-state:paused'), 'Paused sessions do not suspend CSS animation work');
  expect(controls.includes('ArcadeOS.controls=api') || controls.includes('ArcadeOS.controls = api'), 'Game controls service is not exposed');
  expect(controls.includes('data-touch-key'), 'Touch key controls are not configured');
  expect(controls.includes('data-audio-hud'), 'Audio HUD is not configured');
  expect(controls.includes('Escape'), 'Escape key pause shortcut is missing');
  expect(controlStyles.includes('.game-control-layer'), 'Game control layer styles are missing');
  expect(controlStyles.includes('.touch-dpad'), 'Touch dpad styles are missing');
  expect(controlStyles.includes('.audio-hud'), 'Audio HUD styles are missing');
  expect(windowState.includes('ArcadeOS.windowState = api'), 'Window state service is not exposed');
  expect(windowState.includes("new CustomEvent('window:state'"), 'Window state changes are not broadcast');
  expect(windowState.includes("toggleAttribute('inert'"), 'Minimized windows are not removed from keyboard interaction');
  expect(windowState.includes('document.title ='), 'Focused application is not reflected in the document title');
  expect(inputGuard.includes('global.addEventListener = function guardedAdd'), 'Game input listeners are not ownership-guarded');
  expect(inputGuard.includes("type === 'keyup'"), 'Key releases are not preserved for inactive games');
  expect(inputGuard.includes('activeWindow() !== owner'), 'Inactive game windows can still receive keydown input');
  expect(inputGuard.includes('document.hidden'), 'Hidden tabs can still send game input');
  expect(inputGuard.includes('global.ArcadeOS.inputGuard = api'), 'Input guard service is not exposed');
  expect(loopGuard.includes('global.requestAnimationFrame = function guardedRequestAnimationFrame'), 'Animation-frame gameplay loops are not guarded');
  expect(loopGuard.includes('global.setTimeout = function guardedSetTimeout'), 'Timeout gameplay loops are not guarded');
  expect(loopGuard.includes("owner.classList.contains('is-min')"), 'Minimized games are not paused');
  expect(loopGuard.includes('document.hidden'), 'Hidden-tab gameplay loops are not paused');
  expect(loopGuard.includes('task.paused'), 'Paused timeout duration is not preserved');
  expect(loopGuard.includes('global.ArcadeOS.loopGuard = api'), 'Loop guard service is not exposed');
  expect(loopGuard.includes("global.addEventListener('pagehide'"), 'Loop guard does not clean up on page exit');
  expect(ecosystem.includes('validateManifest'), 'Manifest validator is missing');
  expect(ecosystem.includes('createPermissionManager'), 'Permission manager is missing');
  expect(ecosystem.includes('sandbox="allow-scripts"'), 'Sandboxed iframe isolation is missing');
  expect(!ecosystem.includes('allow-same-origin'), 'Sandboxed container must not grant allow-same-origin');
  expect(ecosystemStyles.includes('.app-library-shell'), 'App library styles are missing');
  expect(ecosystemStyles.includes('.sandboxed-app-frame'), 'Sandboxed app iframe styles are missing');
  expect(!html.includes('SELFYY'), 'Private SELFYY reference leaked into ArcadeOS');
}

if (failures.length) {
  console.error('\nArcadeOS contract verification failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`ArcadeOS contracts verified across ${requiredFiles.length} required files.`);

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const requiredFiles = [
  'index.html','app.js','styles.css','system-apps.js','arcade-expansion.js','arcade-music.js',
  'game-controls.js','nimo-overdrive.js','cheat-score-guard.js','navigation-shell.js','game-animations.js',
  'navigation-shell.css','game-animations.css'
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
  const overdrive = read('nimo-overdrive.js');
  const scoreGuard = read('cheat-score-guard.js');

  for (const asset of ['navigation-shell.css','game-animations.css','navigation-shell.js','game-animations.js']) {
    expect(html.includes(asset), `index.html does not load ${asset}`);
  }
  for (const installer of ['installSystemApps','installArcadeExpansion','installArcadeMusic','installNavigationShell','installGameAnimations']) {
    expect(html.includes(`${installer}(window.ArcadeOS)`), `Missing installer call: ${installer}`);
  }
  for (const id of ['snake','breakout','pong','blockdrop','voidinvaders','vectordrift']) {
    expect(navigation.includes(`'${id}'`), `Navigation is missing game: ${id}`);
    expect(animations.includes(`${id}:`), `Animation theme is missing game: ${id}`);
    expect(overdrive.includes(`${id}:`), `Overdrive modifiers are missing game: ${id}`);
  }
  expect(app.includes('window.ArcadeOS='), 'Base runtime does not expose window.ArcadeOS');
  expect(music.includes('installNimoOverdrive(ArcadeOS)'), 'Music bootstrap does not install NIMO Overdrive');
  expect(music.includes('installCheatScoreGuard(ArcadeOS)'), 'Music bootstrap does not install cheat score guard');
  expect(scoreGuard.includes("sessionStorage"), 'Cheat score guard does not isolate modified scores');
  expect(scoreGuard.includes('shouldBlockScore'), 'Cheat score guard does not consult Overdrive state');
  expect(navigation.includes('ArcadeOS.navigation'), 'Navigation service is not exposed');
  expect(animations.includes('ArcadeOS.animations'), 'Animation service is not exposed');
  expect(!html.includes('SELFYY'), 'Private SELFYY reference leaked into ArcadeOS');
}

if (failures.length) {
  console.error('\nArcadeOS contract verification failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`ArcadeOS contracts verified across ${requiredFiles.length} required files.`);

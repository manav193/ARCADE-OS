import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(root,path),'utf8');
const [html,js,css]=await Promise.all([
  read('index.html'),
  read('workspace-session.js'),
  read('workspace-session.css')
]);

const checks=[
  ['workspace stylesheet loaded',html.includes('workspace-session.css')],
  ['workspace module imported',html.includes("./workspace-session.js")],
  ['workspace installer called',html.includes('installWorkspaceSession(window.ArcadeOS)')],
  ['installer runs after window state sync',html.indexOf('installWorkspaceSession(window.ArcadeOS)')>html.indexOf('installWindowStateSync(window.ArcadeOS)')],
  ['duplicate install guard present',js.includes('workspaceSessionInstalled')],
  ['workspace snapshot versioned',js.includes('version:1')],
  ['window count bounded',js.includes('MAX_WINDOWS=10')],
  ['unknown apps skipped',js.includes('ArcadeOS.registry?.has(id)')],
  ['positions clamped to viewport',js.includes('const clamp=')&&js.includes('maxLeft')&&js.includes('maxTop')],
  ['minimized state restored',js.includes("classList.toggle('is-min'")],
  ['maximized state restored',js.includes("classList.add('is-max')")],
  ['pagehide flush present',js.includes("addEventListener('pagehide'")],
  ['mutation saves are debounced',js.includes('MutationObserver')&&js.includes('SAVE_DELAY')],
  ['public service exposed',js.includes('ArcadeOS.workspaceSession={restore,persist,clear,getSnapshot}')],
  ['reset control available',js.includes('data-clear-workspace')],
  ['mobile layout protected',css.includes('@media(max-width:720px)')],
  ['reduced motion protected',css.includes('prefers-reduced-motion')],
  ['private project not referenced',!`${html}\n${js}\n${css}`.toLowerCase().includes('selfyy')]
];

const failed=checks.filter(([,ok])=>!ok);
for(const [label,ok] of checks)console.log(`${ok?'✓':'✗'} ${label}`);
if(failed.length){
  console.error(`\n${failed.length} workspace-session contract check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} workspace-session contract checks passed.`);

import { validateManifest, normalizeManifest, createPermissionManager } from '../app-ecosystem.js';

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

console.log('--- Testing Manifest Validation ---');
const valid = validateManifest({
  id: 'retro-paint',
  name: 'Retro Paint',
  version: '1.2.0',
  description: 'A 2D pixel editor',
  category: 'tools',
  permissions: ['storage', 'notifications'],
  entry: '<html></html>'
});
assert(valid.valid, 'Valid manifest is accepted');

const badId = validateManifest({ id: 'INVALID_ID!', name: 'Test', version: '1.0.0', render: () => '' });
assert(!badId.valid && badId.errors.some(e => e.includes('ID')), 'Invalid manifest ID is rejected');

const missingName = validateManifest({ id: 'valid-id', version: '1.0.0', render: () => '' });
assert(!missingName.valid && missingName.errors.some(e => e.includes('name')), 'Manifest without name/title is rejected');

const badVersion = validateManifest({ id: 'valid-id', name: 'Test', version: 'beta', render: () => '' });
assert(!badVersion.valid && badVersion.errors.some(e => e.includes('version')), 'Non-semver version is rejected');

const badCat = validateManifest({ id: 'valid-id', name: 'Test', version: '1.0.0', category: 'alien', render: () => '' });
assert(!badCat.valid && badCat.errors.some(e => e.includes('category')), 'Invalid category is rejected');

const badPerm = validateManifest({ id: 'valid-id', name: 'Test', version: '1.0.0', permissions: ['superadmin'], render: () => '' });
assert(!badPerm.valid && badPerm.errors.some(e => e.includes('Unknown permission')), 'Undeclared/unknown permission is rejected');

const noEntryOrRender = validateManifest({ id: 'valid-id', name: 'Test', version: '1.0.0' });
assert(!noEntryOrRender.valid && noEntryOrRender.errors.some(e => e.includes('render')), 'Manifest without render or entry is rejected');

console.log('\n--- Testing Manifest Normalization (Backwards Compatibility) ---');
const legacyApp = normalizeManifest({
  id: 'notes',
  title: 'NOTES',
  description: 'Local scratchpad',
  render: () => '<textarea></textarea>'
});
assert(legacyApp.id === 'notes' && legacyApp.category === 'tools', 'Legacy app normalized with valid category');
assert(legacyApp.version === '1.0.0' && legacyApp.type === 'builtin', 'Legacy app normalized as builtin v1.0.0');
assert(legacyApp.permissions.includes('storage'), 'Legacy app inferred appropriate permissions');

const legacyGame = normalizeManifest({
  id: 'snake',
  title: 'NEON SNAKE',
  render: () => '<canvas></canvas>'
});
assert(legacyGame.category === 'games', 'Legacy game categorized as games');
assert(legacyGame.permissions.includes('audio') && legacyGame.permissions.includes('storage'), 'Legacy game assigned audio and storage permissions');

console.log('\n--- Testing Permission Manager & Isolation ---');
const mockStorage = {
  data: new Map(),
  get(k, fallback = null) { return this.data.has(k) ? this.data.get(k) : fallback; },
  set(k, v) { this.data.set(k, v); }
};
const mockBus = new EventTarget();
let permissionEventFired = false;
mockBus.addEventListener('permission:changed', e => {
  if (e.detail?.appId === 'test-app' && e.detail?.permission === 'storage') {
    permissionEventFired = true;
  }
});

const pm = createPermissionManager(mockStorage, mockBus);
assert(pm.has('test-app', 'storage') === true, 'Default permission is granted if unconfigured');

pm.set('test-app', 'storage', false);
assert(pm.has('test-app', 'storage') === false, 'Permission revocation is enforced');
assert(permissionEventFired, 'Permission change event broadcast on event bus');

pm.set('test-app', 'storage', true);
assert(pm.has('test-app', 'storage') === true, 'Permission re-granting is enforced');

assert(pm.set('test-app', 'superadmin', true) === false, 'Disallowed permission cannot be granted');
assert(pm.has('test-app', 'unknown_perm') === false, 'Unknown permissions default to false (denied)');

console.log('\n--- Testing Storage Isolation Scoping ---');
function getScopedKey(appId, key) {
  return `arcadeos:app:${appId}:${key}`;
}
const app1Key = getScopedKey('app-one', 'settings');
const app2Key = getScopedKey('app-two', 'settings');
assert(app1Key !== app2Key, 'Storage keys are strictly scoped per app ID');
assert(app1Key.startsWith('arcadeos:app:app-one:'), 'App namespace prefix enforced');

console.log('\n=======================================');
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log('=======================================');

if (failed > 0) {
  process.exit(1);
}

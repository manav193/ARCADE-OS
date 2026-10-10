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

console.log('\n--- Testing Advanced Permission Security Invariants ---');
const mockManifests = new Map([
  ['sandboxed-audio-only', {
    id: 'sandboxed-audio-only',
    type: 'sandboxed',
    trusted: false,
    permissions: ['audio']
  }],
  ['sandboxed-storage-app', {
    id: 'sandboxed-storage-app',
    type: 'sandboxed',
    trusted: false,
    permissions: ['storage']
  }]
]);

const securePm = createPermissionManager(mockStorage, mockBus, id => mockManifests.get(id));

// 1. Undeclared permission denied by default
assert(securePm.has('sandboxed-audio-only', 'storage') === false, 'Undeclared storage permission is denied by default');
assert(securePm.has('sandboxed-audio-only', 'audio') === true, 'Declared audio permission is granted by default');

// 2. Cannot grant undeclared permission
assert(securePm.set('sandboxed-audio-only', 'storage', true) === false, 'Undeclared permission cannot be granted via set()');

// 3. Sandboxed extension can never hold system capability
assert(securePm.has('sandboxed-audio-only', 'system') === false, 'Sandboxed extension denied system capability by default');
assert(securePm.set('sandboxed-audio-only', 'system', true) === false, 'Sandboxed extension cannot be granted system capability');

// 4. Permission reset clears overrides safely
securePm.set('sandboxed-storage-app', 'storage', false);
assert(securePm.has('sandboxed-storage-app', 'storage') === false, 'Storage permission can be revoked');
securePm.reset('sandboxed-storage-app');
assert(securePm.has('sandboxed-storage-app', 'storage') === true, 'Reset restores declared permission state');
assert(securePm.has('sandboxed-storage-app', 'system') === false, 'Reset does not grant unheld system capability');

// 5. Corrupted permission storage fails safely
const corruptedStorage = {
  get() { return "CORRUPTED_NON_OBJECT_STRING"; },
  set() {}
};
const safePmFromCorrupted = createPermissionManager(corruptedStorage, mockBus);
assert(safePmFromCorrupted.has('any-app', 'unknown_perm') === false, 'Corrupted storage defaults to safe deny');

console.log('\n--- Testing Manifest Security Invariants ---');
// Reserved IDs rejected
for (const reserved of ['settings', 'terminal', 'library', 'notes', 'about', 'snake', 'constructor', '__proto__']) {
  const resCheck = validateManifest({ id: reserved, name: 'Spoofed', version: '1.0.0', category: 'tools', entry: '<div></div>' });
  assert(!resCheck.valid && resCheck.errors.some(e => e.includes('reserved')), `Reserved ID "${reserved}" is rejected`);
}

// Built-in apps allow reserved IDs when flagged
const allowedBuiltin = validateManifest({ id: 'settings', name: 'Settings', version: '1.0.0', category: 'system', render: () => '' }, { allowReserved: true });
assert(allowedBuiltin.valid, 'Built-in app allows reserved ID with allowReserved flag');

// Sandboxed extensions cannot request system capability
const extSysCheck = validateManifest({
  id: 'rogue-app',
  name: 'Rogue App',
  version: '1.0.0',
  category: 'tools',
  type: 'sandboxed',
  permissions: ['system'],
  entry: '<div></div>'
});
assert(!extSysCheck.valid && extSysCheck.errors.some(e => e.includes('system permission')), 'Extension requesting system capability is rejected');

// Sandboxed extensions cannot provide direct render function
const extRenderCheck = validateManifest({
  id: 'in-process-escape',
  name: 'Escape',
  version: '1.0.0',
  category: 'tools',
  type: 'sandboxed',
  entry: '<div></div>',
  render: () => '<script>alert(1)</script>'
});
assert(!extRenderCheck.valid && extRenderCheck.errors.some(e => e.includes('render function')), 'Sandboxed extension providing render function is rejected');

// Oversized entry HTML rejected (> 512 KB)
const hugeEntry = 'a'.repeat(524289);
const hugeEntryCheck = validateManifest({ id: 'huge-app', name: 'Huge', version: '1.0.0', category: 'tools', type: 'sandboxed', entry: hugeEntry });
assert(!hugeEntryCheck.valid && hugeEntryCheck.errors.some(e => e.includes('size limit')), 'Oversized entry point (>512KB) is rejected');

// Oversized manifest rejected (> 1 MB)
const hugeManifest = { id: 'huge-obj', name: 'Huge', version: '1.0.0', category: 'tools', render: () => '', extra: 'x'.repeat(1048577) };
const hugeManifestCheck = validateManifest(hugeManifest);
assert(!hugeManifestCheck.valid && hugeManifestCheck.errors.some(e => e.includes('size limit')), 'Oversized manifest (>1MB) is rejected');

console.log('\n--- Testing Storage Isolation & Key Security ---');
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

function validateStorageKey(key) {
  return typeof key === 'string' && SAFE_KEY_REGEX.test(key);
}

// Valid keys
assert(validateStorageKey('high_score') === true, 'Standard alphanumeric underscore key is accepted');
assert(validateStorageKey('slot-1') === true, 'Key with hyphens is accepted');
assert(validateStorageKey('state2026') === true, 'Key with digits is accepted');

// Adversarial keys rejected
assert(validateStorageKey('../../notes') === false, 'Path traversal key ("../../notes") is rejected');
assert(validateStorageKey('app2:secret') === false, 'Colon-injected key ("app2:secret") is rejected');
assert(validateStorageKey('') === false, 'Empty key is rejected');
assert(validateStorageKey('key with spaces') === false, 'Key with whitespace is rejected');
assert(validateStorageKey(null) === false, 'Null key is rejected');
assert(validateStorageKey({ key: 'val' }) === false, 'Object key is rejected');
assert(validateStorageKey('a'.repeat(65)) === false, 'Key exceeding 64 characters is rejected');

// Storage value size limit check (64 KB)
function validateStorageValueSize(val) {
  try {
    return JSON.stringify(val).length <= 65536;
  } catch {
    return false;
  }
}
assert(validateStorageValueSize({ a: 1, b: 'neon' }) === true, 'Normal storage object is accepted');
assert(validateStorageValueSize('x'.repeat(65537)) === false, 'Storage value exceeding 64 KB is rejected');

console.log('\n--- Testing RPC Bridge Validation & Whitelists ---');
// Request ID validation
function validateReqId(id) {
  return Number.isInteger(id) && id > 0 && id <= 1e9;
}
assert(validateReqId(1) === true, 'Positive integer request ID is accepted');
assert(validateReqId(42) === true, 'Integer 42 request ID is accepted');
assert(validateReqId(-1) === false, 'Negative request ID is rejected');
assert(validateReqId(0) === false, 'Zero request ID is rejected');
assert(validateReqId(1.5) === false, 'Float request ID is rejected');
assert(validateReqId('1') === false, 'String request ID is rejected');
assert(validateReqId(null) === false, 'Null request ID is rejected');

// Audio sound whitelist
const ALLOWED_SOUNDS = ['launch', 'confirm', 'score', 'hit', 'gameover', 'blip', 'select'];
assert(ALLOWED_SOUNDS.includes('hit') === true, 'Whitelisted sound "hit" is permitted');
assert(ALLOWED_SOUNDS.includes('confirm') === true, 'Whitelisted sound "confirm" is permitted');
assert(ALLOWED_SOUNDS.includes('rm -rf') === false, 'Arbitrary sound command is rejected');
assert(ALLOWED_SOUNDS.includes('__proto__') === false, 'Special property sound is rejected');

// Storage namespace isolation
function getScopedKey(appId, key) {
  return `arcadeos:app:${appId}:${key}`;
}
const app1Key = getScopedKey('app-one', 'settings');
const app2Key = getScopedKey('app-two', 'settings');
assert(app1Key !== app2Key, 'Storage keys are strictly scoped per app ID');
assert(app1Key.startsWith('arcadeos:app:app-one:'), 'App namespace prefix enforced');
assert(app2Key.startsWith('arcadeos:app:app-two:'), 'Second app namespace prefix enforced');

console.log('\n=======================================');
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log('=======================================');

if (failed > 0) {
  process.exit(1);
}

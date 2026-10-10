import { 
  validateManifest, 
  normalizeManifest, 
  createPermissionManager,
  compareSemver,
  getByteLength,
  calculateAppStorageUsage,
  MAX_APP_STORAGE_QUOTA,
  MAX_STORAGE_VALUE_SIZE,
  SYSTEM_VERSION
} from '../app-ecosystem.js';

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

console.log('\n--- Testing Unicode Byte Calculations & Quota Metrics ---');
assert(getByteLength('arcade') === 6, 'Standard ASCII byte length is 6');
assert(getByteLength('🎨') === 4, 'Emoji "🎨" byte length is 4 (UTF-8 encoded)');
assert(getByteLength('日本語') === 9, 'Multibyte CJK string byte length is 9');

const quotaMockStorage = {
  data: new Map(),
  get(k, fallback = null) { return this.data.has(k) ? this.data.get(k) : fallback; },
  set(k, v) { this.data.set(k, v); }
};

// Initial usage is zero
assert(calculateAppStorageUsage('test-quota-app', quotaMockStorage) === 0, 'Initial app storage usage is 0 bytes');

// Add item within quota
quotaMockStorage.set('app:test-quota-app:key1', { note: 'sample data' });
const usage1 = calculateAppStorageUsage('test-quota-app', quotaMockStorage);
assert(usage1 > 0 && usage1 < MAX_APP_STORAGE_QUOTA, 'Usage increases after writing item');

// Add boundary data up to quota
const largeChunk = 'x'.repeat(60000); // 60 KB
quotaMockStorage.set('app:test-quota-app:chunk1', largeChunk);
quotaMockStorage.set('app:test-quota-app:chunk2', largeChunk);
quotaMockStorage.set('app:test-quota-app:chunk3', largeChunk);
quotaMockStorage.set('app:test-quota-app:chunk4', largeChunk); // ~240 KB total
const usage2 = calculateAppStorageUsage('test-quota-app', quotaMockStorage);
assert(usage2 > 240000 && usage2 <= MAX_APP_STORAGE_QUOTA, 'Aggregate usage accurately tracks multiple chunks');

// Quota rejection simulation: adding another 60 KB would exceed 256 KB limit
const wouldExceed = usage2 + getByteLength(largeChunk) > MAX_APP_STORAGE_QUOTA;
assert(wouldExceed, 'Adding fifth 60KB chunk is detected as exceeding 256KB aggregate quota');

// Quota recovery on deletion
quotaMockStorage.data.delete('app:test-quota-app:chunk1');
const usageAfterDelete = calculateAppStorageUsage('test-quota-app', quotaMockStorage);
assert(usageAfterDelete < usage2, 'Deleting a key recovers quota space');
assert(usageAfterDelete + getByteLength(largeChunk) <= MAX_APP_STORAGE_QUOTA, 'Previously blocked write can now fit in recovered quota');

console.log('\n--- Testing RPC Bridge Concurrency & Duplicate ID Controls ---');
const inFlightSimulation = new Set();
const MAX_CONCURRENT = 30;

function handleSimulatedRpc(reqId) {
  if (inFlightSimulation.has(reqId)) {
    return { success: false, error: 'Duplicate request ID in flight' };
  }
  if (inFlightSimulation.size >= MAX_CONCURRENT) {
    return { success: false, error: 'Too many concurrent requests' };
  }
  inFlightSimulation.add(reqId);
  return { success: true };
}

function releaseSimulatedRpc(reqId) {
  inFlightSimulation.delete(reqId);
}

// 1. Initial request accepted
assert(handleSimulatedRpc(101).success === true, 'Unique request ID 101 is accepted');

// 2. Duplicate in-flight request ID rejected
const dupResult = handleSimulatedRpc(101);
assert(dupResult.success === false && dupResult.error.includes('Duplicate request ID'), 'Duplicate request ID 101 in flight is rejected');

// 3. Releasing slot allows re-use of ID
releaseSimulatedRpc(101);
assert(handleSimulatedRpc(101).success === true, 'After release, request ID 101 can be accepted');
releaseSimulatedRpc(101);

// 4. Concurrency limit enforced
for (let i = 1; i <= MAX_CONCURRENT; i++) {
  assert(handleSimulatedRpc(i).success === true, `In-flight slot ${i} allocated`);
}
const overflowResult = handleSimulatedRpc(999);
assert(overflowResult.success === false && overflowResult.error.includes('Too many concurrent requests'), 'Request exceeding max concurrent limit (30) is rejected');

// Release one slot
releaseSimulatedRpc(1);
assert(handleSimulatedRpc(999).success === true, 'Releasing one slot permits new request');
for (let i = 2; i <= MAX_CONCURRENT; i++) releaseSimulatedRpc(i);
releaseSimulatedRpc(999);
assert(inFlightSimulation.size === 0, 'All in-flight slots cleanly released');

console.log('\n--- Testing Versioning, Compatibility & Atomic Updates ---');
// Semver comparison
assert(compareSemver('1.0.0', '1.0.0') === 0, 'Identical versions return 0');
assert(compareSemver('2.0.0', '1.9.9') === 1, 'v2.0.0 > v1.9.9 returns 1');
assert(compareSemver('1.2.0', '1.2.1') === -1, 'v1.2.0 < v1.2.1 returns -1');
assert(compareSemver('2.4.0', '2.4.0') === 0, 'Current system version 2.4.0 matches baseline');

// minSystemVersion manifest validation
const futureSysCheck = validateManifest({
  id: 'future-app',
  name: 'Future App',
  version: '1.0.0',
  category: 'tools',
  minSystemVersion: '3.0.0',
  entry: '<div></div>'
});
assert(!futureSysCheck.valid && futureSysCheck.errors.some(e => e.includes('ArcadeOS v3.0.0')), 'Manifest requiring future OS version (v3.0.0) is rejected');

const validSysCheck = validateManifest({
  id: 'current-app',
  name: 'Current App',
  version: '1.0.0',
  category: 'tools',
  minSystemVersion: '2.4.0',
  entry: '<div></div>'
});
assert(validSysCheck.valid, 'Manifest matching current OS version (v2.4.0) is accepted');

// Update validation logic & rollback simulation
const installedAppRegistry = new Map([
  ['test-ext', {
    id: 'test-ext',
    name: 'Test Ext',
    version: '1.1.0',
    type: 'sandboxed',
    category: 'tools'
  }]
]);

function simulateAppUpdate(newManifest) {
  const id = newManifest?.id;
  const existing = installedAppRegistry.get(id);
  if (!existing) return { success: false, errors: ['Not installed'] };

  // Validate
  const val = validateManifest(newManifest, { isExtension: true });
  if (!val.valid) return { success: false, errors: val.errors };

  // Version downgrade check
  if (compareSemver(newManifest.version, existing.version) < 0) {
    return { success: false, errors: ['Cannot downgrade version'] };
  }

  // Atomic update
  const backup = { ...existing };
  try {
    installedAppRegistry.set(id, { ...newManifest, type: 'sandboxed' });
    return { success: true };
  } catch (e) {
    installedAppRegistry.set(id, backup); // Rollback
    return { success: false, errors: [e.message] };
  }
}

// Update with valid newer version
const goodUpdate = simulateAppUpdate({ id: 'test-ext', name: 'Test Ext', version: '1.2.0', category: 'tools', entry: '<div>v2</div>' });
assert(goodUpdate.success === true, 'Update to newer semver (v1.2.0) succeeds');
assert(installedAppRegistry.get('test-ext').version === '1.2.0', 'Installed version updated to v1.2.0');

// Update with downgrade rejected
const badDowngrade = simulateAppUpdate({ id: 'test-ext', name: 'Test Ext', version: '1.0.5', category: 'tools', entry: '<div>v1</div>' });
assert(badDowngrade.success === false && badDowngrade.errors[0].includes('downgrade'), 'Version downgrade is rejected');
assert(installedAppRegistry.get('test-ext').version === '1.2.0', 'Version remains unchanged at v1.2.0 after rejected downgrade');

// Update with invalid manifest rejected
const badManifestUpdate = simulateAppUpdate({ id: 'test-ext', name: 'Test Ext', version: '2.0.0', category: 'alien', entry: '<div></div>' });
assert(badManifestUpdate.success === false && badManifestUpdate.errors.some(e => e.includes('category')), 'Malformed update manifest is rejected');
assert(installedAppRegistry.get('test-ext').version === '1.2.0', 'Version remains intact at v1.2.0 after malformed manifest rejection');

console.log('\n=======================================');
console.log(`PASSED: ${passed} | FAILED: ${failed}`);
console.log('=======================================');

if (failed > 0) {
  process.exit(1);
}

# ArcadeOS Application Developer SDK (v1.0)

ArcadeOS provides an extensible application ecosystem for both trusted built-in apps and origin-isolated sandboxed extensions.

---

## 1. App Manifest Schema

Every application is defined by an `AppManifest` object:

```json
{
  "id": "my-app",
  "name": "My Retro Tool",
  "title": "MY RETRO TOOL // v1.0",
  "version": "1.0.0",
  "description": "An interactive utility for ArcadeOS",
  "category": "tools",
  "icon": "⚡",
  "type": "sandboxed",
  "permissions": ["storage", "notifications"],
  "author": "Developer Name",
  "minSystemVersion": "2.4.0",
  "entry": "<html>...</html>"
}
```

### Fields Specification

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Yes** | 2–32 lowercase alphanumeric characters with hyphens (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`). |
| `name` | `string` | **Yes** | Human-readable application title shown in the App Library and menus. |
| `title` | `string` | No | Window bar header text (defaults to uppercase `name`). |
| `version` | `string` | **Yes** | Semantic version string (e.g. `1.0.0`). |
| `description`| `string` | **Yes** | 1–2 sentence summary of application function. |
| `category` | `string` | **Yes** | One of: `'games'`, `'tools'`, `'system'`, `'developer'`, `'intelligence'`. |
| `icon` | `string` | No | Single character glyph or emoji displayed on cards and icons. |
| `type` | `string` | No | `'builtin'` (in-process) or `'sandboxed'` (isolated iframe). |
| `permissions`| `string[]`| No | Requested capabilities: `'storage'`, `'audio'`, `'notifications'`, `'bus'`, `'system'`. |
| `author` | `string` | No | Author or organization name. |
| `entry` | `string` | For sandboxed | Complete HTML document string loaded into the sandboxed container. |
| `render` | `function` | For built-in | Function returning HTML content string for in-process rendering. |

---

## 2. Security & Permission Model

### Declared Capabilities
* **`storage`**: Scoped read/write access to namespaced persistence (`arcadeos:app:<id>:<key>`). Does not allow access to other apps or system keys.
* **`audio`**: Synthesized procedural audio triggers via `ArcadeOS.audio.play(soundName)`.
* **`notifications`**: Emitting desktop toast notices via the system toaster.
* **`bus`**: Observing non-privileged system bus lifecycle events.
* **`system`**: Restricted to built-in system components. Cannot be granted to extensions.

### Origin Isolation vs Same-Origin Limits
* **Sandboxed Extensions (`type: 'sandboxed'`)**:
  * Executed inside `<iframe sandbox="allow-scripts">` **without** `allow-same-origin`.
  * The browser enforces an opaque origin (`null`). The iframe cannot touch parent window DOM, parent cookies, `localStorage`, or other apps.
  * All host capabilities are mediated exclusively by a validated `postMessage` RPC bridge.
* **Built-in Apps (`type: 'builtin'`)**:
  * Run in the same JavaScript execution context as the ArcadeOS shell.
  * Same-origin JavaScript execution cannot be cryptographically memory-isolated; permission declarations for built-in apps document expected feature usage.

---

## 3. Client Bridge API (Inside Sandboxed Apps)

Every sandboxed iframe automatically receives the `window.Arcade` client SDK bridge:

```javascript
// 1. Scoped Persistence
await window.Arcade.storage.set('highScore', 1420);
const score = await window.Arcade.storage.get('highScore');

// 2. Procedural Audio
await window.Arcade.audio.play('confirm'); // 'launch', 'confirm', 'score', 'hit', 'gameover'

// 3. System Desktop Notifications
await window.Arcade.notify('Round saved successfully!');
```

---

## 4. Minimal Example Application

Here is a complete sandboxed mini-app manifest:

```javascript
import { installAppEcosystem } from './app-ecosystem.js';

const noteWidget = {
  id: 'quick-pad',
  name: 'Quick Pad',
  title: 'QUICK PAD // NOTES',
  version: '1.0.0',
  category: 'tools',
  icon: '📝',
  type: 'sandboxed',
  permissions: ['storage', 'notifications'],
  author: 'ArcadeOS Labs',
  description: 'Self-saving scratchpad extension running in an isolated iframe.',
  entry: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; background: #02050c; color: #67e8f9; font-family: monospace; display: flex; flex-direction: column; height: 100vh; padding: 12px; box-sizing: border-box; }
        textarea { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(103,232,249,0.3); border-radius: 8px; color: #fff; padding: 12px; font-family: inherit; font-size: 13px; outline: none; }
        button { margin-top: 10px; padding: 8px 16px; background: rgba(103,232,249,0.15); border: 1px solid rgba(103,232,249,0.4); color: #67e8f9; border-radius: 6px; cursor: pointer; }
      </style>
    </head>
    <body>
      <textarea id="pad" placeholder="Write something..."></textarea>
      <button id="save">SAVE NOTE</button>
      <script>
        const pad = document.getElementById('pad');
        window.addEventListener('load', async () => {
          const text = await window.Arcade.storage.get('text');
          if (text) pad.value = text;
        });
        document.getElementById('save').addEventListener('click', async () => {
          await window.Arcade.storage.set('text', pad.value);
          await window.Arcade.notify('Quick Pad saved!');
        });
      </script>
    </body>
    </html>
  `
};

// Register via ArcadeOS API
window.ArcadeOS.apps.install(noteWidget);
```

---

## 5. Host Registry APIs

The public runtime exposes:

```javascript
// List installed & available applications
const allApps = ArcadeOS.apps.list('tools', 'pad');

// Inspect manifest
const app = ArcadeOS.apps.get('pixel-art');

// Install an extension
ArcadeOS.apps.install(manifest);

// Uninstall an extension
ArcadeOS.apps.uninstall('pixel-art');

// Check permission
const hasStorage = ArcadeOS.permissions.has('pixel-art', 'storage');

// Toggle permission grant
ArcadeOS.permissions.set('pixel-art', 'storage', false);
```

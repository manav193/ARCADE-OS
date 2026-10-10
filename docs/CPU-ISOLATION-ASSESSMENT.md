# ArcadeOS Extension CPU Isolation & Thread Safety Assessment

## Executive Summary

ArcadeOS executes untrusted extensions inside `<iframe sandbox="allow-scripts">` without `allow-same-origin`. While this provides robust cryptographic origin isolation against DOM, credential, and local storage access, same-origin static web applications face fundamental browser architecture limitations regarding **CPU thread isolation**.

This document assesses the technical realities of same-thread browser execution, investigates potential mitigations, and documents deployment trade-offs.

---

## 1. The Same-Process Browser Reality

### How Browsers Allocate Renderer Processes
Modern browser engines (Chromium, Gecko, WebKit) implement **Site Isolation** (Out-of-Process Iframes, or OOPIF) at the **effective Top-Level Domain plus one (eTLD+1)** boundary.

* When a parent document at `arcadeos.io` embeds an iframe via `srcdoc` or `data:` URL with `sandbox="allow-scripts"`, the browser assigns the iframe an opaque `null` origin.
* **Security boundary**: The iframe cannot read `window.parent`, access cookies, read `localStorage`, or inspect host DOM nodes.
* **Process boundary**: Because the iframe shares the same navigation context and does not load from an independent HTTP cross-site domain, the browser engine typically runs the iframe **in the exact same renderer process and JavaScript event loop thread** as the host page.

### The Threat Model: Synchronous Main-Thread Starvation
If an extension contains a synchronous infinite loop:
```javascript
while (true) {
  // Synchronous CPU loop
}
```
Because the JavaScript engine executes single-threaded turns on that renderer thread, the infinite loop starves the main event loop. The desktop shell, game animations, and user inputs freeze until the browser's native "Page Unresponsive" watchdog intervenes.

---

## 2. Evaluation of Mitigation Architectures

| Mitigation Approach | Implementation Pattern | Main-Thread Protection | UI / DOM Rendering | Deployment Feasibility |
| :--- | :--- | :--- | :--- | :--- |
| **A. Opaque Null Sandbox (Current)** | `srcdoc` + `sandbox="allow-scripts"` | **No** (Shares renderer thread) | Full Canvas & DOM | **High** (Zero build, static) |
| **B. Multi-Tenant Subdomain (OOPIF)** | `https://<id>.ext.arcadeos.app` | **Yes** (Separate OS Process) | Full Canvas & DOM | **Medium** (Requires wildcard DNS & server) |
| **C. Web Worker Isolation** | `new Worker('extension.js')` | **Yes** (Separate OS Thread) | Restricted (`OffscreenCanvas` only) | **High** (Static, no DOM) |
| **D. AST Loop Guard Instrumentation** | Babel/Babel-loop-timeout transform | **Partial** (Bypassed by ReDoS) | Full Canvas & DOM | **Low** (Heavy client transpilation) |

---

## 3. Deep Dive into Mitigation Options

### Approach B: Cross-Site Multi-Tenant Subdomains (True Process Isolation)
To force the browser to spawn an independent OS process for each extension:
1. Serve extension entry points from a separate registrable domain or subdomain (e.g. `https://ext-<appId>.arcadeos-sandbox.com`).
2. Embed the iframe via `src="https://ext-<appId>.arcadeos-sandbox.com/index.html"` with `sandbox="allow-scripts"`.
3. Chromium's Site Isolation recognizes the cross-site domain and places the iframe into an independent OS process (`render-process-id` distinct from host).
4. **Behavior under misuse**: If the extension executes an infinite loop, only that specific iframe process spikes CPU. Chromium displays a sad-tab or frame-unresponsive dialog within that iframe container, while the parent ArcadeOS desktop, audio synthesizer, and games continue rendering smoothly at 60 FPS.
5. **Deployment Requirements**:
   - Requires wildcard DNS (`*.arcadeos-sandbox.com`).
   - Requires an independent server or cloud edge function (Cloudflare Workers / Vercel Edge) to serve tenant assets.
   - Cannot be achieved purely inside a single-origin GitHub Pages or static host.

### Approach C: Web Worker Containerization
1. For logic-heavy or algorithmic extensions (e.g. game bots, calculators, synth audio generators), execute code inside a `Worker`.
2. Workers execute on independent OS background threads. An infinite loop in a Worker leaves the host UI completely responsive.
3. The host can set a watchdog timer and execute `worker.terminate()` immediately if a request times out.
4. **Limitation**: Workers do not have access to standard DOM elements. Rendering requires `HTMLCanvasElement.transferControlToOffscreen()` and WebGL/Canvas2D contexts.

### Approach D: Code Instrumentation / AST Loop Rewriting
1. Parse extension JavaScript with an AST parser before injection.
2. Rewrite `for`, `while`, and `do-while` loops to insert iteration checks:
   ```javascript
   let __start = Date.now();
   while (condition) {
     if (Date.now() - __start > 2000) throw new Error('Execution timeout');
     // body
   }
   ```
3. **Limitation**: Adds parsing overhead, increases code size, and does not stop native engine hangs (such as Catastrophic Backtracking in Regular Expressions / ReDoS or recursive JSON stringification).

---

## 4. Current ArcadeOS Defenses & Pragmatic Guidance

For the current zero-framework standalone architecture, ArcadeOS enforces:
1. **Asynchronous RPC Bridge**: All communication with the host runs over `postMessage` with a 4-second timeout. If an extension stops responding, the host drops pending requests and does not block host services.
2. **Game Loop Suspension Guards**: Built-in games and system timers are guarded by `ArcadeOS.loopGuard` and `ArcadeOS.inputGuard` to ensure parent resources are cleanly throttled when windows are minimized or inactive.
3. **Aggregate Quotas & Concurrency Bounds**: Extensions are capped at 256 KB total storage and 30 concurrent in-flight RPC requests to prevent memory and IPC flooding.
4. **Transparent Communication**: The ArcadeOS App Library surfaces clear security badges distinguishing `Trusted Built-in` from `Sandboxed Container` applications.

---

## 5. Conclusion & Architectural Recommendation

Same-origin browser execution cannot guarantee hard CPU preemption against synchronous JavaScript loops without Out-of-Process Iframes (OOPIF).

When deploying ArcadeOS in a hosted commercial or multi-tenant production environment, the recommended enhancement is **Approach B (Multi-Tenant Subdomain Serving)**, keeping the existing postMessage bridge and permission model completely intact while delegating process isolation to the browser's native Site Isolation engine.

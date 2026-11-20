# Route Scout Implementation Plan

> **For agentic workers:** Use superpowers:test-driven-development and verify each task below.

**Goal:** Deliver a private, installable web app that follows a fixed postal route.
**Architecture:** A static app loads portable route data on the device. A small
location engine keeps GPS fixes and route progress separate.
**Tech Stack:** Browser ES modules, HTML/CSS/SVG, Node test runner, Python 3.
**Spec:** docs/superpowers/specs/2026-11-14-route-scout-design.md

## Global constraints

- No runtime CDN, routing API, analytics, or backend storage.
- Only the generic shell and a fictional example may be deployed.
- Keep GPS opt-in and foreground only. Never auto-complete a service step.
- Keep all packet directions and counts in original order.

## Review focus

- Files interrupted or invalid: preserve the active route and progress.
- Repeated streets or near intersections: GPS never jumps to another part.
- Service-only instructions with zero listed stops: still require confirmation.
- GPS stalled, coarse, or denied: show status and keep manual instructions usable.
- Offline reload: previously opened shell and imported file restore.

### 1. Portable data and progress

- [x] Write `tests/route.test.mjs` for invalid imports, service steps, and safe progress.
- [x] Run `node --test tests/route.test.mjs`; expect missing module.
- [x] Implement `dist/route.mjs`: `parseRoute`, `moveCursor`, `formatMiles`, `serviceRequired`, and derived route totals.
- [x] Build the local package using `tools/prepare-route.py`; compare all rows and totals to the packet. Keep the private output ignored.

### 2. Geolocation

- [x] Write `tests/gps.test.mjs` for map projection, accuracy, and sequential assist.
- [x] Run it against the missing `dist/gps.mjs` module.
- [x] Implement the projection and conservative activation in the GPS module.
- [x] Re-run the combined unit tests.

### 3. Route guide and delivery

- [x] Add accessible Guide, Steps, and Settings views; map, voice, import, resume,
  and opt-in foreground GPS. Add manifest, icons, and offline app shell.
- [x] Verify desktop and mobile navigation, route search/jump, and saved progress
  with a real local browser if available. Exercise GPS with controlled position
  data and verify offline restore.
- [x] Deploy the generic shell through private hosting if supported; share the
  route file separately, and document local preview and iPhone setup.

Local package, mobile browser checks, and offline replay are verified. The app is
published to the owner-only ChatGPT Site and copied to Plexology's web share.
Both deployments contain just the shell and fictional sample.

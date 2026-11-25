# Mailbox Sequence Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and speak the package sequence range for one mailbox at a time.

**Architecture:** Extend version 1 steps with optional ordered `mailboxes`. Keep nested progress and reminder formatting in a pure module, with DOM and speech integration in the existing web app. Preserve old routes and original instruction/count semantics.

**Tech Stack:** Buildless JavaScript modules, HTML/CSS, Node test runner, existing SpeechSynthesis, static hosting.

**Spec:** `docs/superpowers/specs/2026-11-25-mailbox-sequences-design.md`

## Global Constraints

- Optional version 1 mailbox objects, maximum 1,000 per step; labels maximum 140 UTF-16 code units.
- Inclusive sequence endpoints are integers 1–999,999, end at least start; null means unknown.
- Positive stop count must match mailbox entries; annotated steps must require service.
- Never infer actual delivery sequences or publish personal route data.
- Current mailbox only in speech; retain foreground-only GPS and service confirmation.

## Review Focus

- A multi-mailbox step must not advance the route after its first mailbox.
- Back/reload/restart must restore or reset the exact selected mailbox safely.
- Malformed, reversed, fractional, missing endpoints and mismatched stop counts must fail import.
- Unknown ranges and repeated ranges must not become fabricated package claims.
- Old files and old bookmarks must retain whole-step behavior; offline shell must include the new module.

## Task 1: Import, progress, and speech helpers

Files: `dist/route.mjs`, new `dist/mailboxes.mjs`, new `tests/mailboxes.test.mjs`.

- [x] Write and run failing tests for import validation, nested Next/Back, old progress, current-only spoken range, and legacy whole-step progress.
- [x] Normalize optional mailbox data and implement `normalizePosition(route, position)`, `moveGuidance(route, position, event, target)`, `mailboxLabel(mailbox, index)`, `sequenceLabel(mailbox)`, and `mailboxReminder(mailbox, index, count)`.
- [x] Run the complete Node test suite.

## Task 2: Visible guidance and browser behavior

Files: `dist/app.mjs`, `dist/index.html`, `dist/styles.css`, `dist/demo.mjs`, `dist/sw.js`, new browser mailbox check.

- [x] Add a browser regression that imports two different mailbox ranges, advances one mailbox, checks real speech output, reloads, goes back, and completes the step.
- [x] Render the selected mailbox and its package reminder; integrate nested bookmarks and navigation, Repeat and current-only speech.
- [x] Add fictional mailbox ranges to the demo; retain route totals; include the pure module in offline assets.
- [x] Run the browser check at phone and desktop widths and the existing browser regressions.

## Task 3: Route authoring and release

Files: format Markdown/HTML, JSON Schema, examples, README, upload bundles outside Git.

- [x] Document optional fields, full-count rule, unknown ranges, source data requirements, native pilot limitation, and the individual-mailbox interaction.
- [x] Validate examples through the actual importer and check schema/HTML links.
- [ ] Review the complete change, run final checks, update the offline stamp, commit and integrate the verified changes, and refresh hosted/private and upload artifacts within existing authorization.

## Verification record

- Baseline: 13 Node tests passed. Eight new import/progress/reminder tests failed before implementation; the complete 21-test suite now passes.
- Browser checks passed at phone and desktop widths for selected-range display/speech, mailbox Next/Back, Repeat, reload, offline resume, legacy files, and screen fit.
- Existing GPS/import/service/offline, demo/private bookmark, stale-tab, and invalid-map browser regressions passed.
- Independent review found an early future-range preview. A failing browser assertion reproduced it; the preview now hides the future range from visible and accessible text, and both browser sizes pass.
- Examples import and round-trip through the actual web parser. No personal mailbox ranges were invented or added to public assets.

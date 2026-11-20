# Route Scout iOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable first iPhone version of Route Scout with offline packet import and manual route guidance.

**Architecture:** Keep packet parsing, the route cursor, storage, and map projection in a local Swift package that can also serve future CarPlay controls. Give SwiftUI one active route and keep Core Location and speech at the app boundary.

**Tech Stack:** Swift 6, Swift Package Manager, XCTest, Xcode, SwiftUI, Core Location, AVFoundation, ImageIO.

**Spec:** `docs/superpowers/specs/2026-11-16-route-scout-ios-design.md`.

## Global Constraints

- Start with iOS 18 or later. Use Apple frameworks and the local package only.
- Import existing ordered version 1 files. Use fictional data in source, simulators, and tests.
- GPS runs in the foreground and does not move the step in this first build. Spoken directions are optional and foreground only.
- Save the packet and bookmark out of backups. No network service, account, or location history. Leave both web deployments alone.
- CarPlay, voice commands, lock screen guidance, and automatic advance are outside this build.

## Review Focus

- A corrupt or reordered import must leave the active packet and cursor alone (parser and pilot tests).
- A zero-count service instruction still needs **Service done**; stale or drive-only actions must not skip it (session tests).
- A repeated import keeps the bookmark; a failed write must not move it (pilot tests).
- An old, coarse, outside, or unavailable location must not masquerade as a current position (map tests and simulated location check).
- Reopening after the final step must restore **End of packet**, with a way back to the last instruction (pilot and iPhone UI tests).

### 1. Packet and map

**Files:** `ios/Package.swift`, `ios/Sources/RouteScoutCore/RoutePacket.swift`, `ios/Sources/RouteScoutCore/RouteGeometry.swift`, `ios/Tests/RouteScoutCoreTests/RoutePacketTests.swift`, `ios/Tests/RouteScoutCoreTests/RouteGeometryTests.swift`, and `ios/Sources/RouteScoutCore/Resources/Sample.route.json`.

**Interfaces:** `RoutePacket.parse(_ data: Data) throws -> RoutePacket`, `RoutePacket.read(from url: URL) throws -> RoutePacket`, `Route.search(_ query: String, serviceOnly: Bool) -> [RouteStep]`, `RouteStep.serviceRequired: Bool`, `MapBounds.project(_ point: RoutePoint) -> MapPosition?`, `LocationFix.isUsable(at now: Date) -> Bool`.

- [x] Write `testFictionalPacketPreservesOrderNotesAndMap`, `testIncompatiblePacketsAreRejected`, `testSearchMatchesNotesAndStepNumbers`, `testProjectsMapUsingMercatorAndRejectsOutsidePoints`, and `testAcceptsOnlyAccurateCurrentFixes`. Include a real fictional JPEG, ordered 1-based IDs, zero-count service, and a nil waypoint. Mutate version, ID, bounds, image bytes, flags, and size to test rejection.
- [x] Run `swift test --package-path ios`. Confirm tests fail against the unimplemented interfaces.
- [x] Implement the size cap of 2,500,000 bytes and `dist/route.mjs` field constraints, plus validation of the raster image. Project into normalized map coordinates using Web Mercator. Use the web limits of 90 m accuracy, 30 s old, and 5 s ahead of the clock. Keep map and location logic independent of the route cursor.
- [x] Run the package tests and confirm the parser and geometry tests pass.

### 2. Bookmark and import lifecycle

**Files:** `ios/Sources/RouteScoutCore/RouteSession.swift`, `ios/Sources/RouteScoutCore/RoutePilot.swift`, `ios/Tests/RouteScoutCoreTests/RoutePilotTests.swift`.

**Interfaces:** `RouteSession.apply(_ action: RouteAction) -> Bool`; actions `.nextDrive(stepID:)`, `.serviceDone(stepID:)`, `.previous`, `.jump(stepID:)`, and `.restart`. `RoutePilot(demo:store:)`, `restore() throws`, `needsReplacementConfirmation(_:) -> Bool`, `importPacket(_:replacing:) throws -> Bool`, `apply(_:) throws -> Bool`, `removeImportedRoute() throws`. Expose the active session and packet for reading.

- [x] Write tests that reject the wrong completion action and the wrong step ID, restore the same packet and cursor, preserve progress on a same-file import, stage replacement until approved, preserve in-memory progress on save failure, remove the packet, and reopen at **End of packet**. Jumping is a bookmark action; it records no deliveries.
- [x] Run the package tests and confirm the new tests fail against the unimplemented session.
- [x] Implement a single atomic state file using a binary property list with imported packet bytes and the cursor. Place it in an app support directory marked excluded from backups before the first write. Persist candidate state before changing the active session. Demo progress may be saved without copying its bundled packet.
- [x] Run the package tests and confirm the session and persistence cases pass.

### 3. iPhone screen and Xcode delivery

**Files:** `ios/RouteScout.xcodeproj`, `ios/RouteScoutApp/` (app, guide, line of travel, settings, map, and location/speech adapters), `ios/RouteScoutUITests/RouteScoutUITests.swift`, `ios/README.md`, root `README.md`, `.gitignore`.

**Interfaces:** the guide sends `RouteAction`s to `RoutePilot`; `ForegroundLocation` emits `LocationFix` for the map without sending a route action. `AVSpeechSynthesizer` reads the current instruction at user request or on an enabled foreground step change. The Files picker reads a security-scoped `.json` URL and stages replacement only after successful parse.

- [x] Write a UI test that follows the fictional route through a drive and a service step, searches for a step, and checks the restored end screen on relaunch. Set up the simulator build and check for a failing guide test before wiring the view.
- [x] Implement Guide, search and jump, map with approximate turn pins and live fix status, optional Repeat and speech, Files import, replacement/removal confirmation, and restart. Keep labels readable at large text sizes and separate GPS toggling from progress. Reuse the web app icon and bundle only the fictional packet.
- [x] Build the `RouteScout` scheme and run the UI tests in an installed iPhone simulator. Supply a simulated fix within the fictional map and check that the dot appears without moving the current step. Inspect the actual guide and map on the simulator.
- [x] Document how to open the project, run the demo, select a signing team, and install and import from Files on the carrier’s iPhone. Record anything that could only be tested on the phone. Keep changes local to the workspace.

Verified on Xcode 27.2: 18 Swift package tests, 2 iPhone 17 Pro simulator tests,
and an unsigned arm64 iPhone Release build passed. The simulator used only the
fictional packet. Importing the real packet, offline speech, and live field
GPS are checks for the signed build on the carrier’s iPhone.

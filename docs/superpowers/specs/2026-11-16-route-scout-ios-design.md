# Route Scout for iPhone and CarPlay

Start with an iPhone build for the carrier who tested Route Scout on the web. It should follow the same postal packet in the same order, work offline after import, and be easy to resume after a break. Keep the route and progress logic independent of the screen so a future CarPlay interface can use the same session.

## Approach

Use SwiftUI in a separate `ios/` Xcode project, with Swift for packet decoding and session state, Core Location for GPS, and `AVSpeechSynthesizer` for spoken directions. A web wrapper would reuse more of the existing screen, but still require a native map surface, navigation session and bridge to the web app for CarPlay. Reuse the packet format directly and leave the web app in service while the native build is tested. Start with iOS 18 or later; gate later CarPlay features by availability.

## First iPhone build

- **Import:** Open the existing version 1 `.route.json` with the iOS Files picker, validate against the web importer’s rules, and copy it to app storage. Preserve the full instructions, service counts, manual flags, map, and available waypoints. Include a fictional demo route so the app can be tested without a postal packet. Reject unsupported or damaged files without changing the active route.
- **Follow the packet:** Show the current instruction, the next one, mileage, service counts, and step number. Let the carrier search the line of travel, jump to a step, go back, and restart. Use **Next step** on drive steps and **Service done** on steps with delivery work, including service steps with a zero count. Advance to an **End of packet** screen after the last step. As in the web app, progress is a bookmark; the end screen does not certify that every stop was served.
- **Find your place:** Reuse the packet’s map and bounds. Show the GPS dot over the local image when a usable fix is inside the map (use the web app’s freshness and accuracy rules). Treat turn pins as approximate and suppress distance estimates for steps marked manual or missing pins. Manual flags do not change the step controls or speech. Request location when the carrier enables it. The route stays usable with location off, denied, stale, or outside the map. GPS runs in the foreground and does not move the step in this first build.
- **Hear directions:** Offer an optional spoken instruction on step changes and a way to repeat it. Use an installed system voice. This first build does not listen for commands or continue guidance after the app is put in the background.
- **Resume:** Save the active packet and current step, including the finished state, across app restarts. Importing the same file keeps its progress; confirm before replacing it with a different file. Keep the app’s packet and progress in device storage and out of cloud backups; there is no account, network route service, or location history. Start from the beginning on a new install; web progress is separate. Provide a way to remove the imported packet and its progress.

Build the route model, import validation, map coordinate math, and session actions separately from SwiftUI. Give the map, phone controls, and future voice or CarPlay controls the same session to read from and act on. Use fictional data in source, simulators, and tests; import the real packet on the carrier’s iPhone. Leave the existing hosted copies as they are.

## What to check before the first field test

Use `dist/route.mjs` as the import contract. Check a fictional version 1 packet with a georeferenced JPEG, a multi-part instruction, a zero-count service step, and a manual step with no waypoint. Test rejected imports, order, service steps, map projection, and progress after a restart. Run the Xcode scheme in an iPhone simulator using the demo and simulated location.

On the actual phone, [install through Xcode](https://developer.apple.com/documentation/xcode/building-and-running-an-app) and import the packet from Files. Check order and counts, full instructions, an unpinned step, and the map, then check location permission changes and whether speech and resume work in airplane mode. Use the first real import as a check before relying on it in the field. The field test should establish whether manual advance and the packet map are useful enough and what is worth changing next.

## After the phone pilot

Test active guidance with the phone locked and preview a GPS advance option for drive-only steps if those are useful in the field. Use the web app’s rules for verifying both turn pins and require a separate action for delivery work. Stop background location when guidance is paused or ended. Do not add rerouting that changes delivery order.

If the iPhone guidance is useful, [request Apple’s CarPlay navigation entitlement](https://developer.apple.com/carplay/). Build the car display with [`CPMapTemplate` and `CPNavigationSession`](https://developer.apple.com/documentation/CarPlay/integrating-carplay-with-your-navigation-app), tied to the same active step as the iPhone. Begin with spoken prompts and a few explicit, user-triggered commands such as **Repeat**, **Next drive step**, and **Pause**. Only act on clear commands. Leave completion of delivery steps to a separate deliberate action. [Apple’s voice control template](https://developer.apple.com/videos/play/wwdc2026/212/) can show when the app is listening; command recognition needs its own implementation. Try Siri shortcuts separately and test availability on a real phone and CarPlay system. CarPlay testing and release depend on Apple’s entitlement and review.

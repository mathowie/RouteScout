# Route Scout

[Use RouteScout](https://routescout.guide/) · [Route JSON format guide](docs/route-format-v1.md)

An iPhone and web app for following a fixed postal route. It shows the current
instruction, the next one, service counts, and a route map with a GPS dot.
You can search the full line of travel, jump to a specific step, and resume
after closing the app. The app shell and an imported route are available
offline after the first successful setup.

## Create your own route

Use the [Route Scout version 1 format guide](docs/route-format-v1.md), which
includes the required fields, a complete example, and a prompt for converting
directions with ChatGPT. The [example route](docs/examples/harbor-practice.route.json)
can be imported directly. A [JSON Schema](docs/route-format-v1.schema.json) is
included for tools that generate route files. Maps and coordinates are optional.

## Native iPhone app

Open [`ios/RouteScout.xcodeproj`](ios/RouteScout.xcodeproj) in Xcode and run the
**RouteScout** scheme. See the [iPhone setup and field test guide](ios/README.md)
for simulator testing, signing, and importing the same packet from Files. The
iPhone app and each web copy keep their own progress.

## Web app on an iPhone

1. Put the prepared `.route.json` from the local `private` directory into
   Files on your phone. AirDrop it, or use a private folder you already sync.
2. In Safari, open [RouteScout](https://routescout.guide/) on the phone you
   will use while delivering. There is a fictional sample route so you can
   try the controls before importing your own file.
3. For a Home Screen shortcut, use Safari's Share menu → **Add to Home
   Screen** → **Open as Web App** when offered. Open the icon and then
   choose **Import route**. Import from the same place you intend to use
   day to day, because Safari and the Home Screen app may store data separately.
4. Tap **Enable GPS**, grant location access, and leave the app visible.
   Use **Next step** after completing a drive instruction, and **Service done**
   only after finishing the delivery work on that card. You can enable spoken
   directions in Settings when an on-device English voice is installed.

GPS progress is experimental and off by default. It works only for eligible
drive-only legs, uses estimated turn pins, and never rearranges the packet.
Steps without reliable start pins remain manual. Check the map and
directions at the route before relying on GPS advance. The app pauses live
guidance whenever it goes into the background. The native iPhone pilot also
uses foreground GPS and manual advance.

## Local preview

Run `python3 -B tools/serve.py` from the project directory. Open its printed
loopback URL to use the local private package. Open the same address without
the query in a fresh browser to see the demo. The preview server serves only
this Mac; use the HTTPS app on a separate iPhone.

The browser sends no GPS readings and does not upload imported files. The
generic web shell and fictional map live in `dist`. The local `private`
directory is ignored by Git and excluded from hosting. Its route data is
portable version 1 JSON, with `[latitude, longitude]` waypoints denoting
the start of an instruction. The route image uses its own Web Mercator bounds.
Public road references are documented separately in the local calibration notes.

## Host the web app

1. Upload the contents of `dist/` to your website's document directory. This
   is a static site: no PHP, database, or server build step is required.
2. Upload the contents of `docs/` into a `docs/` directory beside the app's
   `index.html` to host the route-format documentation.
3. Serve the site over HTTPS for location access. Import your route on each
   device and site where you use the app; browser storage and progress are
   separate for each origin.

Personal route PDFs, generated route JSON, calibration notes, and local
download bundles belong in `private/`, which is excluded from Git and site
uploads. The examples included in this repository are fictional.

## Development

The web app has no dependencies or build step. Run `node --test tests/*.test.mjs`
with Node 20 or newer. With Playwright installed and the loopback server
running, use `node tests/browser-check.mjs` and its regression flags
`--demo-resume`, `--stale-tab`, and `--bad-map`. If using already installed
Chrome and Playwright, set `ROUTE_SCOUT_CHROME` to the executable and
`ROUTE_SCOUT_PLAYWRIGHT` to the package path. After changing assets in
`dist`, run `python3 -B tools/stamp-offline.py` to update the offline shell
revision. Existing open tabs keep their consistent cached version until closed.

To regenerate the private route from the original packet, use
`python3 -B tools/prepare-route.py PDF_PATH OUTPUT_PATH --presentation PRESENTATION_PATH --geo CALIBRATION_PATH`
with `pypdf` installed. Keep the output and calibration outside `dist`.
Pillow is only needed for regenerating the fictional preview and icons.

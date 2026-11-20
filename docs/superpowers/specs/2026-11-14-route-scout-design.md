# Route Scout: location-aware postal web app

Build a personal foreground navigator that follows the paper route in its listed
order, including service notes and turnarounds. The phone shows the current
instruction, next instruction, progress, and GPS position. It never reroutes
or treats a map pin as proof that mail was delivered.

## Approaches

- Use the route packet directly in a static, installable web app. The map and
  location can run offline after setup; GPS and imported routes stay in the
  browser. This meets the web-first request and keeps the route portable.
- Hand the next address to a commercial driving app. This introduces another app
  and a route optimizer that may bypass line-of-travel details.
- Write a native iPhone app. Consider this later for locked-screen guidance and
  greater control of Core Location. The same route package can be reused.

## Design

The PDF is a data source. Only the dated summary, map, and 58 ordered line-of-travel
rows are extracted. Keep the packet, map, private addresses, and route package
out of any hosted artifact and version control. Users can import the prepared
file through the browser's file picker. The hosted shell has a fictional demo.

The route package contains a map and optional desk-estimated turn positions.
Every printed row has the packet wording, step miles, stops, regular boxes,
and centralized boxes. The app can display a shorter heading and break
compound instructions into readable subturns. Counts and service directions
remain attached to the original row. No unlisted stop coordinates are invented.

GPS is opt-in and works while the page is visible. Show accuracy and mark
approximate map positions as such. Give optional voice and an opt-in assist
that may advance a drive-only step only after seeing the current waypoint and
then two accurate readings near the next waypoint in order. Missing or close
anchors, stale fixes, uncertain maneuvers, and any service step use manual
advance. Users may jump to a step from the searchable list and resume on reload.

Use a dependency-free static shell, a service worker for offline reload after
initial setup, and browser storage. A local preview serves the private file
only over loopback; the hosted shell does not contain it.

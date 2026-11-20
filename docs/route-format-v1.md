# Route Scout route file format version 1

Use this format to turn a written route, line of travel, or list of turns into a file that Route Scout can import. It works with the web app and the native iPhone app. This is Route Scout’s own version 1 interchange format.

Save the result as UTF-8 JSON with a filename such as `my-route.route.json`. A route can contain just instructions and distances. A map and GPS coordinates are optional.

## Quick start

1. Keep the original order of travel, including repeated streets, loops, service instructions, and the return trip.
2. Create one object in `steps` for each instruction. Number the objects `1, 2, 3, …` in their array order.
3. Express distances in **decimal miles**, and keep the complete instruction in `source`.
4. Include the three count fields on every step. Use `service: true` for an instruction that requires delivery work, even when its counts are zero.
5. If coordinates are unavailable, use `waypoint: null` and `manual: true`. If no aligned map is available, use `map: null`.

Start with the complete [example route](examples/harbor-practice.route.json). The [JSON Schema](route-format-v1.schema.json) describes field types and limits for software that creates files.

## Complete example

This fictional route is ready to import. Its distances total 1 mile. It includes driving instructions, a delivery step, a return trip, and an arrival instruction. It needs no coordinates or map.

```json
{
  "version": 1,
  "id": "HARBOR-PRACTICE",
  "name": "Harbor practice route",
  "area": "Fictional Harbor Village",
  "effective": "",
  "miles": 1.0,
  "map": null,
  "steps": [
    {
      "id": 1,
      "action": "depart",
      "title": "Harbor Road",
      "source": "Leave Harbor Depot heading east on Harbor Road. Continue for 0.40 miles.",
      "details": [],
      "miles": 0.4,
      "stops": 0,
      "regular": 0,
      "centralized": 0,
      "service": false,
      "manual": true,
      "waypoint": null
    },
    {
      "id": 2,
      "action": "right",
      "title": "Maple Avenue",
      "source": "Turn right onto Maple Avenue. Continue for 0.25 miles.",
      "details": [],
      "miles": 0.25,
      "stops": 0,
      "regular": 0,
      "centralized": 0,
      "service": false,
      "manual": true,
      "waypoint": null
    },
    {
      "id": 3,
      "action": "left",
      "title": "Pine Court mailboxes",
      "source": "Turn left into Pine Court. Service the 12 centralized boxes at the mailbox stop. Continue for 0.05 miles to the exit.",
      "details": ["One delivery stop with 12 centralized boxes."],
      "miles": 0.05,
      "stops": 1,
      "regular": 0,
      "centralized": 12,
      "service": true,
      "manual": true,
      "waypoint": null
    },
    {
      "id": 4,
      "action": "return",
      "title": "Harbor Depot",
      "source": "Return to Harbor Depot along Access Lane. Travel 0.30 miles.",
      "details": [],
      "miles": 0.3,
      "stops": 0,
      "regular": 0,
      "centralized": 0,
      "service": false,
      "manual": true,
      "waypoint": null
    },
    {
      "id": 5,
      "action": "finish",
      "title": "End at Harbor Depot",
      "source": "Arrive at Harbor Depot. This is the end of the route.",
      "details": [],
      "miles": 0,
      "stops": 0,
      "regular": 0,
      "centralized": 0,
      "service": false,
      "manual": true,
      "waypoint": null
    }
  ]
}
```

## Route fields

The file contains one JSON object.

| Field | Required | Type and limit | Meaning |
| --- | --- | --- | --- |
| `version` | Yes | Number, exactly `1` | File format version. |
| `id` | Yes | Nonblank string, up to 60 | A descriptive route identifier, such as `TOWN-R012`. |
| `name` | Yes | Nonblank string, up to 100 | Route name displayed in the app. |
| `area` | Yes | Nonblank string, up to 100 | Town, neighborhood, or delivery area. |
| `steps` | Yes | Array, 1–1,000 objects | Instructions in travel order. |
| `effective` | No | String, up to 40, or `null` | Source route’s effective date. Prefer `YYYY-MM-DD` when known; otherwise omit it or use `""`. |
| `miles` | No | Number, 0–5,000, or `null` | Total route mileage. If omitted or `null`, the app sums step mileage and rounds the total to two decimal places. |
| `map` | No | Map object or `null` | Optional embedded map, described below. Omit it or use `null` for a route with only directions. |

Use the source’s stated total mileage when it supplies one. A printed total may differ slightly from the sum of rounded leg distances. Keep that total and the original leg distances rather than changing them to make the numbers agree.

## Step fields

Each object in `steps` has these fields. The required count fields also appear on routes used only for driving.

| Field | Required | Type and limit | Meaning |
| --- | --- | --- | --- |
| `id` | Yes | Integer, 1–1,000 | The step’s position in the array, starting at 1. IDs must be consecutive. |
| `action` | Yes | One of the strings below | The main turn or maneuver. |
| `title` | Yes | Nonblank string, up to 140 | Short street, destination, or instruction label. |
| `source` | Yes | Nonblank string, up to 2,400 | Complete instruction, including service work, distances, and qualifications. |
| `miles` | Yes | Number, 0–500 | Distance of this step’s leg in decimal miles. |
| `stops` | Yes | Integer, 0–1,000 | Number of service stops on this step. |
| `regular` | Yes | Integer, 0–10,000 | Number of regular boxes served on this step. |
| `centralized` | Yes | Integer, 0–10,000 | Number of centralized or cluster boxes served on this step. |
| `details` | No | Array of up to 16 nonblank strings, each up to 360 | Extra notes. Omitted or `null` becomes an empty list. |
| `service` | No | Boolean, default `false` | Explicitly marks delivery work even if all counts are zero. If supplied, it must be `true` or `false`. |
| `manual` | No | Boolean, default `false` | Excludes this step from the web app’s optional GPS advance assistance and suppresses its distance estimate. Set `true` when the pin is missing or unreliable. The current iPhone pilot advances every step manually. |
| `waypoint` | No | Two-number array or `null` | `[latitude, longitude]` of the **start of this instruction**. Omitted or `null` means no pin. |

Text limits are measured in UTF-16 code units by both importers; ordinary letters usually count as one and emoji may count as two. Keep text below these limits and preserve all necessary instructions.

### Allowed actions

Action strings are lowercase and must match exactly.

| Value | Use |
| --- | --- |
| `depart` | Leave the starting location; put the heading in `source`. |
| `north` | Head north. |
| `straight` | Continue straight or continue along the current road. |
| `left` | Turn left. |
| `right` | Turn right. |
| `bear-left` | Keep or bear left. |
| `bear-right` | Keep or bear right. |
| `roundabout` | Use a roundabout; put the exit and full maneuver in `source`. |
| `return` | A return maneuver or return leg; describe the movement in `source`. |
| `finish` | Arrival or an explicit final instruction. |

For an initial east, south, or west heading, use `depart` and write the heading in `source`; those headings have no separate action values. Version 1 has no dedicated `stop` or `u-turn` action. Preserve such instructions in `source` and choose the supported action that describes the movement. Ask for clarification when that mapping is ambiguous. The `finish` action is optional; reaching the end of the array ends the packet.

### Distances and service work

For a newly authored route, a step such as “turn right onto Elm Street and continue 0.3 miles” has `action: "right"` and `miles: 0.3`. The number describes that leg, rather than the cumulative odometer reading. When converting a packet, keep its leg distances attached to the same instructions. Clarify whether a supplied distance is before or after a turn when the source leaves that ambiguous.

Convert feet to miles by dividing by **5,280**, meters by **1,609.344**, and kilometers by **1.609344**. Preserve useful precision. A stationary service or final arrival instruction can have `miles: 0`. Ask for missing driving distances; do not silently substitute zero, estimate blocks, or invent distances. All numbers must be JSON numbers, such as `0.25`, without units or quotes.

The app treats a step as service when **`service` is true OR any of `stops`, `regular`, or `centralized` is greater than zero**. A false flag cannot override positive counts. A driving-only step uses zero for all three counts. If the source specifies service but gives no counts, use `service: true`, keep counts at zero, and add a note such as `"Service counts not specified in source."` to `details`. Stops and boxes are separate quantities; do not infer one from the other.

Keep compound instructions together when preserving the source’s numbered rows. The one `action` represents the main maneuver; `source` and `details` retain any additional turns, mailbox work, or exceptions. If the source’s numbers have gaps or do not start at 1, assign consecutive JSON IDs and retain the original numbers in `details`. Do not merge repeated streets, remove loops, optimize the order, or allocate a compound leg’s distance among new steps without supplied distances.

## Optional coordinates and maps

A waypoint is a geographic coordinate in **latitude, longitude** order, in decimal degrees. Latitude must be between −85 and 85, and longitude between −180 and 180. For “turn left onto Elm Street,” the pin belongs at that turn, where the instruction starts. It is not the end of Elm Street, a pixel position, or a route polyline. Use supplied or checked coordinates; set `waypoint: null` and `manual: true` when unsure.

A map is optional. An embedded map has this shape. Replace the image placeholder with actual Base64 data and the illustrative bounds with the calibrated bounds for that image before import:

```json
{
  "image": "data:image/jpeg;base64,ACTUAL_BASE64_IMAGE_DATA",
  "width": 1200,
  "height": 800,
  "bounds": {
    "north": 45.01,
    "south": 44.99,
    "east": -122.99,
    "west": -123.01
  }
}
```

- `image`, `width`, and `height` are required whenever a map is supplied. Use an embedded **JPEG, PNG, or WebP** with a `data:image/jpeg;base64,`, `data:image/png;base64,`, or `data:image/webp;base64,` prefix. Supply valid, preferably padded Base64 without line breaks. Remote URLs, local file paths, SVG, and PDF are unsupported map values.
- Width and height are integers from **32 through 5,000 pixels**, matching the decoded image’s actual dimensions. Keep the complete JSON file, including the Base64 image, within **2,500,000 bytes**.
- `bounds` can be omitted or `null` for a map that is only an illustration. For a live GPS dot, supply all four bounds with `north > south` and `east > west`, using the same coordinate limits as waypoints.
- Bounds describe the edges of the **whole image** using a north-up Web Mercator alignment. A rotated scan or a screenshot with uncalibrated borders needs alignment work before GPS positions can be placed accurately. Do not guess bounds from visible town names or coordinates.
- The optional `attribution` field recognizes `"packet-road-references"` or `true` for the app’s built-in road-reference label. Leave it out unless that label applies.

For conversion by ChatGPT, start with `map: null` unless a correctly encoded and aligned map is already provided. The complete route remains usable with manual advance.

## GPS advance in the web app

On a phone, open Route Scout over **HTTPS**, import your route, tap **Enable GPS**, and allow location access. In Settings, turn on **GPS advance**. **Speak directions** and **Keep screen awake** are optional where supported; keep awake can be declined by the browser or phone. GPS assistance works only while Route Scout is in the foreground. Switching apps or locking the screen pauses tracking and resets advance detection. The current native iPhone pilot still advances every step manually.

For route authors:

- Each `waypoint` is the **start of its step**, in `[latitude, longitude]` order. The current and next steps both need usable pins and `manual: false` for advance assistance.
- The current step must be driving-only: `service` must be false and all three service counts must be zero. Delivery work always requires explicit manual advance, even with `manual: false`; GPS does not confirm that boxes were serviced.
- Keep steps with missing or untrusted pins, short legs, retraces, or internal paths manual. Pins derived from public maps are **desk estimates requiring field review**, not evidence of on-road validation.
- Map `bounds` align the GPS dot on an image. Neither a map nor its bounds is required for GPS advance eligibility.

Advance detection first needs an accurate fix near the current step’s start, then repeated fixes near the next step’s start. Starting halfway through a leg may never arm detection; use the step buttons when needed. Weak or stale GPS can also prevent advance. For reference, eligible anchors must be at least 70 m and less than 3,000 m apart; detection requires location accuracy of 24 m or better, a fix within 31 m of the current anchor, then two fixes within 26 m of the next anchor, 750 ms–10 s apart, after leaving the current anchor’s 31 m area.

## File checks

Use double quotes, plain JSON booleans, and finite numbers. Include no comments, trailing commas, duplicate object keys, `NaN`, or `Infinity`. Optional `service` and `manual` fields must be omitted or contain booleans; `null` is invalid for them. Unknown fields do not add behavior to the current apps.

Before importing, check that each `id` matches its array position, every source instruction appears in order, and any supplied map can decode with matching dimensions and correct bounds. The schema checks shape and numeric ranges using [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12). It does not check sequential step IDs, coordinate accuracy, image decoding, total file bytes, or the apps’ UTF-16 text limits. Passing schema validation alone does not verify the route on the ground.

## Prompt for ChatGPT

Give ChatGPT this document and the source directions. The schema and example file are useful additional attachments. Copy this prompt:

```text
Convert the attached route directions into a Route Scout version 1 .route.json file, following the attached “Route Scout route file format version 1” document.

Preserve the original travel order, repeated roads, loops, return trip, service instructions, warnings, and numbered compound instructions. Keep complete directions in source. Do not optimize the route or silently drop instructions.

Use consecutive step IDs starting at 1 and only the documented action values. Use numeric decimal miles for each leg, converting known units correctly. Keep any stated route total; otherwise omit the top-level miles field. Ask me about missing driving distances or ambiguous instructions before producing the final file. Do not invent distances, coordinates, map bounds, or service counts.

Include stops, regular, and centralized on every step. Use zero for driving-only steps. If service is required but counts are not given, set service to true, keep the counts at zero, and note that the source does not specify counts in details.

Use map: null unless I supply a correctly encoded and aligned map. Use waypoint: null and manual: true unless I supply checked coordinates for the start of each instruction. Preserve any extra delivery notes in details.

Validate the result against the document and, if available, the attached JSON Schema. Also check step order and sequential IDs, which the schema alone does not enforce. Do not claim a validation tool or import was run unless you actually ran it.

Once ambiguities are resolved, provide the complete JSON as a downloadable file named my-route.route.json if file creation is available. Otherwise provide one complete JSON code block that I can save under that name. Keep explanations outside the JSON.
```

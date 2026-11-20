#!/usr/bin/env python3
"""Prepare a private Route Scout file from a six-page Line of Travel packet."""
import argparse
import base64
import json
import re
from pathlib import Path

from pypdf import PdfReader

ROW = re.compile(r"^\s*(\d{1,2})\s{2,}(.+?)\s{2,}(\d+(?:\.\d+)?) mi\s+(\d+)\s+(\d+)\s+(\d+)\s*$")
MILEAGE = re.compile(r"Confirmed Mileage After LTM Review\s+(\d+(?:\.\d+)?) mi")
EFFECTIVE = re.compile(r"Effective Date\s+(\d+/\d+/\d+)")
PREFIXES = (
    ("continue straight onto ", "straight"),
    ("continue straight on ", "straight"),
    ("turn left on ", "left"),
    ("turn right on ", "right"),
    ("bear left on ", "bear-left"),
    ("bear right on ", "bear-right"),
)


def title_case(road):
    return re.sub(
        r"\b(Nw|Ne|Sw|Se|\d+(?:St|Nd|Rd|Th))\b",
        lambda m: m[0].lower() if m[0][0].isdigit() else m[0].upper(),
        road.title(),
    )


def read_steps(reader, recipe):
    rows = []
    for page in reader.pages[3:5]:
        step = None
        for line in page.extract_text(extraction_mode="layout").splitlines():
            if match := ROW.fullmatch(line):
                number, source, miles, stops, regular, centralized = match.groups()
                step = dict(id=int(number), source=" ".join(source.split()), miles=float(miles),
                            stops=int(stops), regular=int(regular), centralized=int(centralized))
                rows.append(step)
            elif step and line.strip():
                continuation = line.strip()
                if continuation.startswith(("Page ", "Total ")):
                    step = None
                elif not re.match(r"^\s{0,4}\S", line):
                    step["source"] += " " + " ".join(continuation.split())
                else:
                    raise ValueError(f"Unexpected content after step {step['id']}: {continuation}")
    if [row["id"] for row in rows] != list(range(1, recipe["expected"]["steps"] + 1)):
        raise ValueError("The packet must contain all expected steps in order.")
    if tuple(sum(row[k] for row in rows) for k in ("stops", "regular", "centralized")) != tuple(recipe["expected"][k] for k in ("stops", "regular", "centralized")):
        raise ValueError("Step counts do not agree with the printed totals.")
    for row in rows:
        number, source = row["id"], row["source"]
        custom = recipe["edits"].get(str(number))
        if custom:
            action, title, details = custom
        else:
            prefix, action = next((x for x in PREFIXES if source.lower().startswith(x[0])), (None, None))
            if prefix is None:
                raise ValueError(f"No presentation rule for step {number}: {source}")
            title, details = title_case(source[len(prefix):]), []
        row.update(action=action, title=title, details=details,
                   service=bool(re.search(r"\bservice\b", source, re.I)),
                   manual=number in recipe["manual"])
    return rows


def prepare(pdf_path, geo_path, recipe):
    reader = PdfReader(pdf_path)
    if len(reader.pages) != 6 or recipe["id"] not in reader.pages[0].extract_text():
        raise ValueError("Expected the six-page route packet named in the presentation file.")
    streets = max(reader.pages[0].images, key=lambda image: image.image.width * image.image.height)
    if streets.image.size != (1332, 869) or streets.image.format != "JPEG":
        raise ValueError("Embedded map does not match this packet revision.")
    geo = json.loads(geo_path.read_text()) if geo_path else {}
    rows = read_steps(reader, recipe)
    anchors = geo.get("anchors", {})
    for row in rows:
        if point := anchors.get(str(row["id"])):
            row["waypoint"] = point
    return {
        "version": 1, "id": recipe["id"], "name": recipe["name"], "area": recipe["area"],
        "effective": EFFECTIVE.search(reader.pages[2].extract_text(extraction_mode="layout"))[1],
        "miles": float(MILEAGE.search(reader.pages[1].extract_text(extraction_mode="layout"))[1]),
        "map": {
            "image": "data:image/jpeg;base64," + base64.b64encode(streets.data).decode("ascii"),
            "width": 1332, "height": 869, "bounds": geo.get("bounds"),
            "attribution": "packet-road-references",
        },
        "steps": rows
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--presentation", type=Path, required=True, help="Private display edits, manual flags, and expected totals")
    parser.add_argument("--geo", type=Path, help="Reviewed desk calibration and optional turn pins")
    args = parser.parse_args()
    route = prepare(args.pdf, args.geo, json.loads(args.presentation.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(route, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(route['steps'])} steps, {sum(s['stops'] for s in route['steps'])} stops, "
          f"{sum('waypoint' in s for s in route['steps'])} map pins.")


if __name__ == "__main__":
    main()

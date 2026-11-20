import Foundation
import RouteScoutCore
import XCTest

final class RoutePacketTests: XCTestCase {
    func testFictionalPacketPreservesOrderNotesAndMap() throws {
        let route = try RoutePacket.sample().route
        XCTAssertEqual(route.steps.map(\.id), Array(1...7))
        XCTAssertEqual(route.steps[1].centralized, 24)
        XCTAssertEqual(route.steps[2].details, ["Check the hold notice before continuing."])
        XCTAssertEqual(route.steps[2].stops, 0)
        XCTAssertTrue(route.steps[2].serviceRequired)
        XCTAssertTrue(route.steps[5].manual)
        XCTAssertNil(route.steps[5].waypoint)
        XCTAssertEqual(route.miles, 2.14)
        let map = try XCTUnwrap(route.map)
        XCTAssertEqual(map.width, 850)
        XCTAssertEqual(map.height, 560)
        XCTAssertEqual(map.bounds?.east, -122.9965)
        XCTAssertEqual(map.imageData.prefix(2), Data([0xFF, 0xD8]))
    }

    func testIncompatiblePacketsAreRejected() throws {
        for (label, change) in [
            ("unknown version", { $0["version"] = 2 }),
            ("no ordered steps", { $0["steps"] = [] }),
            ("reordered", { changeFirstStep(&$0) { $0["id"] = 2 } }),
            ("boolean mileage", { changeFirstStep(&$0) { $0["miles"] = true } }),
            ("invalid waypoint", { changeFirstStep(&$0) { $0["waypoint"] = [100, 0] } }),
            ("unknown action", { changeFirstStep(&$0) { $0["action"] = "sometimes" } }),
            ("invalid service flag", { changeFirstStep(&$0) { $0["service"] = NSNull() } }),
            ("invalid manual flag", { changeFirstStep(&$0) { $0["manual"] = 1 } }),
            ("fractional boxes", { changeFirstStep(&$0) { $0["regular"] = 0.5 } }),
            ("bad image", { changeMap(&$0) { $0["image"] = "data:image/jpeg;base64,AAAA" } }),
            ("vector image", { changeMap(&$0) { $0["image"] = "data:image/svg+xml;base64,AAAA" } }),
            ("incorrect pixel dimensions", { changeMap(&$0) { $0["width"] = 851 } }),
            ("crossed bounds", { changeMap(&$0) { $0["bounds"] = ["north": 40, "south": 41, "west": 20, "east": 21] } }),
        ] as [(String, (inout [String: Any]) -> Void)] {
            let corrupted = try sampleEdited(change)
            XCTAssertThrowsError(try RoutePacket.parse(corrupted), label)
        }
        XCTAssertThrowsError(try RoutePacket.parse(Data(repeating: 32, count: 2_500_001))) { error in
            XCTAssertEqual(error as? RouteImportError, .tooLarge)
        }
    }

    func testAcceptsRoutesWithoutMapAndOptionalMetadata() throws {
        let packet = try RoutePacket.parse(sampleEdited { packet in
            packet.removeValue(forKey: "map")
            packet.removeValue(forKey: "miles")
            packet.removeValue(forKey: "effective")
            changeFirstStep(&packet) { $0["details"] = NSNull() }
        })
        XCTAssertNil(packet.route.map)
        XCTAssertEqual(packet.route.effective, "")
        XCTAssertEqual(packet.route.miles, 2.14)
        XCTAssertTrue(packet.route.steps[0].details.isEmpty)
    }

    func testRejectsMapWhenHeaderIsReadableButPixelsCannotDecode() throws {
        // A 32×32 PNG with valid chunk CRCs and an unsupported compression mode.
        let corruptImage = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAL9AABBBA0gAAAAGUlEQVR4nO3BMQEAAADCoPVP7WENoAAAAG4MIAABt9NlCQAAAABJRU5ErkJggg=="
        let data = try sampleEdited { object in
            changeMap(&object) {
                $0["image"] = "data:image/png;base64," + corruptImage
                $0["width"] = 32
                $0["height"] = 32
            }
        }
        XCTAssertThrowsError(try RoutePacket.parse(data)) { XCTAssertEqual($0 as? RouteImportError, .invalidMap) }
    }

    func testAcceptsValidMapWithoutBase64Padding() throws {
        let data = try sampleEdited { object in
            changeMap(&object) {
                if let image = $0["image"] as? String, image.hasSuffix("=") {
                    $0["image"] = String(image.dropLast())
                }
            }
        }
        XCTAssertEqual(try RoutePacket.parse(data).route.map?.imageData, try RoutePacket.sample().route.map?.imageData)
    }

    func testReadsFileWithHardSizeLimit() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: url) }
        try RoutePacket.sample().data.write(to: url)
        XCTAssertEqual(try RoutePacket.read(from: url).route.id, "FICTIONAL-SAMPLE")
        try Data(repeating: 32, count: 2_500_001).write(to: url)
        XCTAssertThrowsError(try RoutePacket.read(from: url)) { error in
            XCTAssertEqual(error as? RouteImportError, .tooLarge)
        }
    }

    func testSearchMatchesNotesAndStepNumbers() throws {
        let route = try RoutePacket.sample().route
        XCTAssertEqual(route.search("  HOLD notice ", serviceOnly: true).map(\.id), [3])
        XCTAssertEqual(route.search("#5", serviceOnly: false).map(\.id), [5])
        XCTAssertEqual(route.search("Parkside", serviceOnly: false).map(\.id), [3, 4, 5])
        XCTAssertEqual(route.search("", serviceOnly: true).map(\.id), [2, 3, 4])
        XCTAssertTrue(route.search("#5", serviceOnly: true).isEmpty)
    }
}

func sampleEdited(_ edit: (inout [String: Any]) -> Void) throws -> Data {
    var object = try XCTUnwrap(JSONSerialization.jsonObject(with: RoutePacket.sample().data) as? [String: Any])
    edit(&object)
    return try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}

private func changeFirstStep(_ object: inout [String: Any], _ edit: (inout [String: Any]) -> Void) {
    guard var steps = object["steps"] as? [[String: Any]], !steps.isEmpty else { return }
    edit(&steps[0])
    object["steps"] = steps
}

private func changeMap(_ object: inout [String: Any], _ edit: (inout [String: Any]) -> Void) {
    guard var map = object["map"] as? [String: Any] else { return }
    edit(&map)
    object["map"] = map
}

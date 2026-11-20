import Foundation
import RouteScoutCore
import XCTest

final class RouteGeometryTests: XCTestCase {
    func testProjectsMapUsingMercatorAndRejectsOutsidePoints() throws {
        let bounds = MapBounds(north: 60, south: 0, east: 20, west: 0)
        let northWest = try XCTUnwrap(bounds.project(RoutePoint(latitude: 60, longitude: 0)))
        XCTAssertEqual(northWest.x, 0, accuracy: 0.0001)
        XCTAssertEqual(northWest.y, 0, accuracy: 0.0001)
        let inside = try XCTUnwrap(bounds.project(RoutePoint(latitude: 30, longitude: 10)))
        XCTAssertEqual(inside.x, 0.5, accuracy: 0.0001)
        XCTAssertEqual(inside.y, 0.5829, accuracy: 0.001)
        XCTAssertNil(bounds.project(RoutePoint(latitude: 30, longitude: -0.001)))
        XCTAssertNil(MapBounds(north: 60, south: 0, east: 20, west: 20).project(.init(latitude: 30, longitude: 20)))
    }

    func testAcceptsOnlyAccurateCurrentFixes() {
        let now = Date(timeIntervalSinceReferenceDate: 200_000)
        let point = RoutePoint(latitude: 45, longitude: -123)
        func fix(_ accuracy: Double, _ seconds: Double, _ location: RoutePoint? = nil) -> LocationFix {
            LocationFix(point: location ?? point, accuracy: accuracy, timestamp: now.addingTimeInterval(seconds))
        }
        XCTAssertTrue(fix(90, -30).isUsable(at: now))
        XCTAssertFalse(fix(90.1, -1).isUsable(at: now))
        XCTAssertFalse(fix(0, -1).isUsable(at: now))
        XCTAssertFalse(fix(5, -30.1).isUsable(at: now))
        XCTAssertFalse(fix(5, 5.1).isUsable(at: now))
        XCTAssertFalse(fix(5, -1, .init(latitude: .nan, longitude: 0)).isUsable(at: now))
    }

    func testDistanceUsesMetersRatherThanMapPixels() {
        let distance = RoutePoint(latitude: 0, longitude: 0).distance(to: RoutePoint(latitude: 0, longitude: 0.001))
        XCTAssertEqual(distance, 111.2, accuracy: 0.2)
    }

    func testNewerCoarseFixHidesPreviousDotAndOldCallbackCannotRestoreIt() {
        let now = Date(timeIntervalSinceReferenceDate: 200_000)
        let point = RoutePoint(latitude: 45, longitude: -123)
        let accurate = LocationFix(point: point, accuracy: 10, timestamp: now.addingTimeInterval(-2))
        let coarse = LocationFix(point: point, accuracy: 120, timestamp: now.addingTimeInterval(-1))
        let future = LocationFix(point: point, accuracy: 10, timestamp: now.addingTimeInterval(60))
        var readings = RecentLocation()
        XCTAssertTrue(readings.receive(accurate, at: now))
        XCTAssertEqual(readings.latest, accurate)
        XCTAssertTrue(readings.receive(coarse, at: now))
        XCTAssertEqual(readings.latest, coarse)
        XCTAssertFalse(readings.latest?.isUsable(at: now) ?? true)
        XCTAssertFalse(readings.receive(accurate, at: now))
        XCTAssertFalse(readings.receive(future, at: now))
        XCTAssertEqual(readings.latest, coarse)
        readings.clear()
        XCTAssertNil(readings.latest)
    }
}

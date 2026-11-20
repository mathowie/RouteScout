import Foundation
import RouteScoutCore
import XCTest

final class RoutePilotTests: XCTestCase {
    func testDriveAndServiceActionsCannotSkipOtherSteps() throws {
        var session = RouteSession(route: try RoutePacket.sample().route)
        XCTAssertFalse(session.apply(.serviceDone(stepID: 1)))
        XCTAssertTrue(session.apply(.nextDrive(stepID: 1)))
        XCTAssertFalse(session.apply(.nextDrive(stepID: 1)))
        XCTAssertFalse(session.apply(.nextDrive(stepID: 2)))
        XCTAssertTrue(session.apply(.serviceDone(stepID: 2)))
        XCTAssertEqual(session.current?.id, 3)
        XCTAssertFalse(session.apply(.nextDrive(stepID: 3)))
        XCTAssertTrue(session.apply(.serviceDone(stepID: 3)))
        XCTAssertEqual(session.current?.id, 4)
    }

    func testJumpUsesPacketIDAndDoesNotInventACompletionLog() throws {
        var session = RouteSession(route: try RoutePacket.sample().route)
        XCTAssertFalse(session.apply(.jump(stepID: 0)))
        XCTAssertTrue(session.apply(.jump(stepID: 6)))
        XCTAssertEqual(session.current?.id, 6)
        XCTAssertNil(session.current?.waypoint)
        XCTAssertTrue(session.apply(.jump(stepID: 3)))
        XCTAssertTrue(try XCTUnwrap(session.current).serviceRequired)
        XCTAssertTrue(session.apply(.restart))
        XCTAssertEqual(session.current?.id, 1)
    }

    func testSameImportedFilePreservesBookmarkAcrossRelaunch() throws {
        try withPilot { pilot, store, sample in
            let packet = try practiceImport()
            XCTAssertTrue(try pilot.importPacket(packet))
            XCTAssertTrue(try pilot.apply(.jump(stepID: 3)))
            XCTAssertFalse(try pilot.importPacket(packet))
            var reopened = RoutePilot(demo: sample, store: store)
            try reopened.restore()
            XCTAssertFalse(reopened.active.isDemo)
            XCTAssertEqual(reopened.active.packet.data, packet.data)
            XCTAssertEqual(reopened.active.session.current?.id, 3)
        }
    }

    func testReplacementRequiresApprovalAndResetsCursorEvenWithSameRouteID() throws {
        try withPilot { pilot, _, _ in
            let original = try practiceImport()
            let revision = try practiceImport(revision: true)
            XCTAssertTrue(try pilot.importPacket(original))
            XCTAssertTrue(try pilot.apply(.jump(stepID: 5)))
            XCTAssertTrue(pilot.needsReplacementConfirmation(revision))
            XCTAssertFalse(try pilot.importPacket(revision))
            XCTAssertEqual(pilot.active.packet.route.name, "Practice import")
            XCTAssertEqual(pilot.active.session.current?.id, 5)
            XCTAssertTrue(try pilot.importPacket(revision, replacing: true))
            XCTAssertEqual(pilot.active.packet.route.name, "Revised practice import")
            XCTAssertEqual(pilot.active.session.current?.id, 1)
        }
    }

    func testInvalidImportAndFailedWritePreserveCurrentProgress() throws {
        try withPilot { pilot, store, sample in
            XCTAssertTrue(try pilot.importPacket(practiceImport()))
            XCTAssertTrue(try pilot.apply(.jump(stepID: 2)))
            XCTAssertThrowsError(try pilot.importPacket(RoutePacket.parse(Data("[]".utf8)), replacing: true))
            var reopened = RoutePilot(demo: sample, store: store)
            try reopened.restore()
            XCTAssertEqual(reopened.active.session.current?.id, 2)
            try FileManager.default.removeItem(at: store.directory)
            try Data([1]).write(to: store.directory)
            XCTAssertThrowsError(try pilot.apply(.serviceDone(stepID: 2)))
            XCTAssertEqual(pilot.active.session.current?.id, 2)
            XCTAssertThrowsError(try pilot.importPacket(practiceImport(revision: true), replacing: true))
            XCTAssertEqual(pilot.active.packet.route.name, "Practice import")
        }
    }

    func testEndOfPacketRestoresAndBackReturnsToLastInstruction() throws {
        try withPilot { pilot, store, sample in
            XCTAssertTrue(try pilot.apply(.jump(stepID: 7)))
            XCTAssertNil(pilot.active.session.next)
            XCTAssertTrue(try pilot.apply(.nextDrive(stepID: 7)))
            var reopened = RoutePilot(demo: sample, store: store)
            try reopened.restore()
            XCTAssertTrue(reopened.active.session.isFinished)
            XCTAssertNil(reopened.active.session.current)
            XCTAssertFalse(try reopened.apply(.nextDrive(stepID: 7)))
            XCTAssertTrue(try reopened.apply(.previous))
            XCTAssertEqual(reopened.active.session.current?.id, 7)
        }
    }

    func testRemovingImportReturnsToDemoAndErasesSavedPacket() throws {
        try withPilot { pilot, store, sample in
            XCTAssertTrue(try pilot.importPacket(practiceImport()))
            XCTAssertTrue(try pilot.apply(.jump(stepID: 4)))
            try pilot.removeImportedRoute()
            XCTAssertTrue(pilot.active.isDemo)
            XCTAssertEqual(pilot.active.session.current?.id, 1)
            XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: store.directory.path), [])
            var reopened = RoutePilot(demo: sample, store: store)
            try reopened.restore()
            XCTAssertTrue(reopened.active.isDemo)
        }
    }

    private func practiceImport(revision: Bool = false) throws -> RoutePacket {
        try RoutePacket.parse(sampleEdited { $0["name"] = revision ? "Revised practice import" : "Practice import" })
    }

    private func withPilot(_ run: (inout RoutePilot, RouteStore, RoutePacket) throws -> Void) throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = RouteStore(directory: url)
        let sample = try RoutePacket.sample()
        var pilot = RoutePilot(demo: sample, store: store)
        defer { try? FileManager.default.removeItem(at: url) }
        try run(&pilot, store, sample)
    }
}

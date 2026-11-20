import CoreLocation
import XCTest

final class RouteScoutUITests: XCTestCase {
    @MainActor
    func testPracticeRoutePersistsEndAndReturnsToLastStep() {
        continueAfterFailure = false
        let app = launchFreshPractice()
        assertStep("Step 1 of 7", in: app)
        let advance = app.buttons["advance-step"]
        XCTAssertEqual(advance.label, "Next step")
        advance.tap()
        assertStep("Step 2 of 7", in: app)
        XCTAssertEqual(advance.label, "Service done")
        advance.tap()
        assertStep("Step 3 of 7", in: app)
        XCTAssertEqual(advance.label, "Service done")
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "hold notice")).firstMatch.exists)

        app.buttons["open-steps"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap()
        search.typeText("parking lot")
        app.buttons["route-step-7"].tap()
        assertStep("Step 7 of 7", in: app)
        app.buttons["advance-step"].tap()
        let finished = app.staticTexts["end-of-packet"]
        XCTAssertTrue(finished.waitForExistence(timeout: 5))
        app.terminate()
        app.launch()
        XCTAssertTrue(finished.waitForExistence(timeout: 5))
        app.buttons["previous-step"].tap()
        assertStep("Step 7 of 7", in: app)
    }

    @MainActor
    func testMapShowsSimulatedLocationWithoutAdvancing() {
        continueAfterFailure = false
        let app = launchFreshPractice(resetLocationPermission: true)
        assertStep("Step 1 of 7", in: app)
        app.buttons["open-map"].tap()
        app.buttons["location-toggle"].tap()
        let allowWhileUsing = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Allow While Using App"]
        XCTAssertTrue(allowWhileUsing.waitForExistence(timeout: 5))
        allowWhileUsing.tap()
        XCTAssertTrue(allowWhileUsing.waitForNonExistence(timeout: 5))
        // Supply a new fix once the app is authorized and listening.
        XCUIDevice.shared.location = XCUILocation(location: CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 45, longitude: -123.0015),
            altitude: 50, horizontalAccuracy: 5, verticalAccuracy: 5, timestamp: Date()
        ))
        defer { XCUIDevice.shared.location = nil }
        let dot = app.otherElements.matching(identifier: "gps-map-dot").firstMatch
        let status = app.staticTexts["map-location-status"]
        XCTAssertTrue(status.waitForExistence(timeout: 8))
        let updated = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS[c] %@", "within this map"), object: status)
        let outcome = XCTWaiter.wait(for: [updated], timeout: 15)
        XCTAssertEqual(outcome, .completed, "Last GPS status: \(status.label)")
        XCTAssertTrue(dot.exists || app.descendants(matching: .any).matching(identifier: "gps-map-dot").firstMatch.exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Route Scout simulated GPS"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["close-map"].tap()
        assertStep("Step 1 of 7", in: app)
    }

    @MainActor
    private func launchFreshPractice(resetLocationPermission: Bool = false) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["ROUTE_SCOUT_UI_TEST_RUN"] = UUID().uuidString
        app.launchArguments = ["-routeScout.spokenDirections", "NO"]
        if resetLocationPermission { app.resetAuthorizationStatus(for: .location) }
        app.launch()
        return app
    }

    @MainActor
    private func assertStep(_ description: String, in app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let badge = app.staticTexts["step-count"]
        XCTAssertTrue(badge.waitForExistence(timeout: 5), file: file, line: line)
        XCTAssertEqual(badge.label, description, file: file, line: line)
    }
}

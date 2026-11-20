import Foundation
import Observation
import RouteScoutCore
import UIKit

@MainActor @Observable
final class RouteModel {
    private var pilot: RoutePilot?
    private(set) var mapImage: UIImage?
    private(set) var startupProblem: String?

    var active: ActiveRoute? { pilot?.active }

    init() { load() }

    func load() {
        do {
            let demo = try RoutePacket.sample()
            var candidate = RoutePilot(demo: demo, store: RouteStore(directory: Self.storageDirectory))
            try candidate.restore()
            pilot = candidate
            reloadMap()
            startupProblem = nil
        } catch {
            startupProblem = "Route Scout couldn’t open the saved route. Unlock your iPhone and try again."
        }
    }

    @discardableResult
    func apply(_ action: RouteAction) throws -> Bool {
        guard var candidate = pilot, try candidate.apply(action) else { return false }
        pilot = candidate
        return true
    }

    func needsReplacementConfirmation(_ packet: RoutePacket) -> Bool {
        pilot?.needsReplacementConfirmation(packet) == true
    }

    @discardableResult
    func importPacket(_ packet: RoutePacket, replacing: Bool = false) throws -> Bool {
        let image: UIImage?
        if let map = packet.route.map {
            guard let candidate = UIImage(data: map.imageData), candidate.cgImage != nil else {
                throw RouteImportError.invalidMap
            }
            image = candidate
        } else {
            image = nil
        }
        guard var candidate = pilot, try candidate.importPacket(packet, replacing: replacing) else { return false }
        pilot = candidate
        mapImage = image
        return true
    }

    func removeImportedRoute() throws {
        guard var candidate = pilot else { return }
        try candidate.removeImportedRoute()
        pilot = candidate
        reloadMap()
    }

    private func reloadMap() {
        mapImage = active?.packet.route.map.flatMap { UIImage(data: $0.imageData) }
    }

    private static var storageDirectory: URL {
        #if DEBUG
        // Each UI test gets its own bookmark. Relaunching the app in the same test restores it.
        if let value = ProcessInfo.processInfo.environment["ROUTE_SCOUT_UI_TEST_RUN"],
           let run = UUID(uuidString: value) {
            return URL.temporaryDirectory.appending(path: "RouteScoutUITest-\(run.uuidString)", directoryHint: .isDirectory)
        }
        #endif
        return URL.applicationSupportDirectory.appending(path: "RouteScout", directoryHint: .isDirectory)
    }
}

enum RouteFileAccess {
    static func read(_ url: URL) throws -> RoutePacket {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var result: Result<RoutePacket, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { file in
            result = Result { try RoutePacket.read(from: file) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw RouteImportError.invalidFile }
        return try result.get()
    }
}

import Foundation

public struct ActiveRoute: Sendable {
    public let packet: RoutePacket
    public let isDemo: Bool
    public fileprivate(set) var session: RouteSession

    fileprivate init(packet: RoutePacket, isDemo: Bool, cursor: Int = 0) {
        self.packet = packet
        self.isDemo = isDemo
        self.session = RouteSession(route: packet.route, cursor: cursor)
    }
}

public struct RoutePilot: Sendable {
    private let demo: RoutePacket
    private let store: RouteStore
    public private(set) var active: ActiveRoute

    public init(demo: RoutePacket, store: RouteStore) {
        self.demo = demo
        self.store = store
        active = ActiveRoute(packet: demo, isDemo: true)
    }

    public mutating func restore() throws {
        if let saved = try store.load(demo: demo) { active = saved }
    }

    public func needsReplacementConfirmation(_ packet: RoutePacket) -> Bool {
        !active.isDemo && active.packet.data != packet.data
    }

    @discardableResult
    public mutating func importPacket(_ packet: RoutePacket, replacing: Bool = false) throws -> Bool {
        if !active.isDemo && (active.packet.data == packet.data || !replacing) { return false }
        let candidate = ActiveRoute(packet: packet, isDemo: false)
        try store.save(candidate)
        active = candidate
        return true
    }

    @discardableResult
    public mutating func apply(_ action: RouteAction) throws -> Bool {
        var candidate = active
        guard candidate.session.apply(action) else { return false }
        try store.save(candidate)
        active = candidate
        return true
    }

    public mutating func removeImportedRoute() throws {
        guard !active.isDemo else { return }
        try store.remove()
        active = ActiveRoute(packet: demo, isDemo: true)
    }
}

public struct RouteStore: Sendable {
    public let directory: URL

    public init(directory: URL) { self.directory = directory }

    private var recordURL: URL { directory.appendingPathComponent("RouteState.plist", isDirectory: false) }

    private struct SavedState: Codable {
        let packet: Data?
        let cursor: Int
    }

    fileprivate func load(demo: RoutePacket) throws -> ActiveRoute? {
        let bytes: Data
        do {
            bytes = try Data(contentsOf: recordURL)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return nil
        }
        let saved = try PropertyListDecoder().decode(SavedState.self, from: bytes)
        let packet = try saved.packet.map(RoutePacket.parse) ?? demo
        guard (0...packet.route.steps.count).contains(saved.cursor) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return ActiveRoute(packet: packet, isDemo: saved.packet == nil, cursor: saved.cursor)
    }

    fileprivate func save(_ route: ActiveRoute) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let state = SavedState(packet: route.isDemo ? nil : route.packet.data, cursor: route.session.cursor)
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        let bytes = try encoder.encode(state)
        #if os(iOS)
        var backupExcludedDirectory = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try backupExcludedDirectory.setResourceValues(values)
        try bytes.write(to: recordURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try bytes.write(to: recordURL, options: .atomic)
        #endif
    }

    fileprivate func remove() throws {
        do {
            try FileManager.default.removeItem(at: recordURL)
        } catch let error as CocoaError where error.code == .fileNoSuchFile || error.code == .fileReadNoSuchFile {
            // Already removed.
        }
    }
}

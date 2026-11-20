public enum RouteAction: Sendable {
    case nextDrive(stepID: Int)
    case serviceDone(stepID: Int)
    case previous
    case jump(stepID: Int)
    case restart
}

public struct RouteSession: Sendable {
    public let route: Route
    public private(set) var cursor: Int

    public init(route: Route, cursor: Int = 0) {
        self.route = route
        self.cursor = min(max(cursor, 0), route.steps.count)
    }

    public var current: RouteStep? { step(at: cursor) }
    public var next: RouteStep? { step(at: cursor + 1) }
    public var isFinished: Bool { cursor == route.steps.count }

    @discardableResult
    public mutating func apply(_ action: RouteAction) -> Bool {
        let destination: Int
        switch action {
        case .nextDrive(let stepID):
            guard let current, current.id == stepID, !current.serviceRequired else { return false }
            destination = cursor + 1
        case .serviceDone(let stepID):
            guard let current, current.id == stepID, current.serviceRequired else { return false }
            destination = cursor + 1
        case .previous:
            destination = max(cursor - 1, 0)
        case .jump(let stepID):
            guard stepID > 0, route.steps.indices.contains(stepID - 1) else { return false }
            destination = stepID - 1
        case .restart:
            destination = 0
        }
        guard destination != cursor else { return false }
        cursor = destination
        return true
    }

    private func step(at index: Int) -> RouteStep? {
        route.steps.indices.contains(index) ? route.steps[index] : nil
    }
}

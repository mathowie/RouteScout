import Foundation

public struct RoutePoint: Sendable, Equatable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }

    var isValid: Bool { (-85...85).contains(latitude) && (-180...180).contains(longitude) }

    public func distance(to other: Self) -> Double {
        guard isValid, other.isValid else { return .infinity }
        let dLat = radians(other.latitude - latitude)
        let dLon = radians(other.longitude - longitude)
        let h = pow(sin(dLat / 2), 2) + cos(radians(latitude)) * cos(radians(other.latitude)) * pow(sin(dLon / 2), 2)
        return 12_742_000 * asin(sqrt(min(1, h)))
    }
}

public struct MapPosition: Sendable, Equatable {
    public let x: Double
    public let y: Double
}

public struct MapBounds: Sendable, Equatable {
    public let north: Double
    public let south: Double
    public let east: Double
    public let west: Double

    public init(north: Double, south: Double, east: Double, west: Double) {
        self.north = north
        self.south = south
        self.east = east
        self.west = west
    }

    var isValid: Bool {
        RoutePoint(latitude: north, longitude: east).isValid && RoutePoint(latitude: south, longitude: west).isValid &&
            north > south && east > west && mercator(north) > mercator(south)
    }

    public func project(_ point: RoutePoint) -> MapPosition? {
        guard isValid, (south...north).contains(point.latitude), (west...east).contains(point.longitude) else { return nil }
        let top = mercator(north)
        return MapPosition(x: (point.longitude - west) / (east - west),
                           y: (top - mercator(point.latitude)) / (top - mercator(south)))
    }
}

public struct LocationFix: Sendable, Equatable {
    public let point: RoutePoint
    public let accuracy: Double
    public let timestamp: Date

    public init(point: RoutePoint, accuracy: Double, timestamp: Date) {
        self.point = point
        self.accuracy = accuracy
        self.timestamp = timestamp
    }

    public func isUsable(at now: Date) -> Bool {
        let age = now.timeIntervalSince(timestamp)
        return point.isValid && accuracy > 0 && accuracy <= 90 && (-5...30).contains(age)
    }
}

public struct RecentLocation: Sendable {
    public private(set) var latest: LocationFix?

    public init() {}

    @discardableResult
    public mutating func receive(_ reading: LocationFix, at now: Date) -> Bool {
        let age = now.timeIntervalSince(reading.timestamp)
        guard age.isFinite, age >= -5 else { return false }
        if let latest, reading.timestamp < latest.timestamp { return false }
        latest = reading
        return true
    }

    public mutating func clear() { latest = nil }
}

private func radians(_ degrees: Double) -> Double { degrees * .pi / 180 }

private func mercator(_ latitude: Double) -> Double { log(tan(.pi / 4 + radians(latitude) / 2)) }

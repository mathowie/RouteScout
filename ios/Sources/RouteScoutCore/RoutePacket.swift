import CoreFoundation
import Foundation
import ImageIO
import UniformTypeIdentifiers

public struct RoutePacket: Sendable {
    public let route: Route
    public let data: Data

    private static let maximumBytes = 2_500_000

    public static func parse(_ data: Data) throws -> Self {
        guard data.count <= maximumBytes else { throw RouteImportError.tooLarge }
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw RouteImportError.invalidFile
        }
        guard number(object["version"], in: 1...1) != nil else { throw RouteImportError.unsupportedVersion }
        guard let id = word(object["id"], limit: 60), let name = word(object["name"], limit: 100),
              let area = word(object["area"], limit: 100),
              let rows = object["steps"] as? [[String: Any]], (1...1000).contains(rows.count) else {
            throw RouteImportError.invalidRoute
        }
        let steps = try rows.enumerated().map { index, row in try parseStep(row, id: index + 1) }
        let miles: Double
        if isMissing(object["miles"]) {
            miles = (steps.reduce(0) { $0 + $1.miles } * 100).rounded() / 100
        } else if let value = number(object["miles"], in: 0...5000) {
            miles = value
        } else {
            throw RouteImportError.invalidRoute
        }
        let effective: String
        if isMissing(object["effective"]) || object["effective"] as? String == "" {
            effective = ""
        } else if let value = word(object["effective"], limit: 40) {
            effective = value
        } else {
            throw RouteImportError.invalidRoute
        }
        let map = try isMissing(object["map"]) ? nil : parseMap(object["map"])
        return Self(route: Route(id: id, name: name, area: area, effective: effective,
                                 miles: miles, map: map, steps: steps), data: data)
    }

    public static func read(from url: URL) throws -> Self {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        var data = Data()
        while data.count <= maximumBytes {
            let count = min(65_536, maximumBytes + 1 - data.count)
            guard let chunk = try file.read(upToCount: count), !chunk.isEmpty else { break }
            data.append(chunk)
        }
        return try parse(data)
    }

    public static func sample() throws -> Self {
        guard let url = Bundle.module.url(forResource: "Sample.route", withExtension: "json") else {
            throw RouteImportError.invalidFile
        }
        return try read(from: url)
    }

    private static func parseStep(_ row: [String: Any], id: Int) throws -> RouteStep {
        let invalid = RouteImportError.invalidStep(id)
        guard integer(row["id"], in: 1...1000) == id,
              let action = (row["action"] as? String).flatMap(RouteStep.Direction.init(rawValue:)),
              let title = word(row["title"], limit: 140), let source = word(row["source"], limit: 2400),
              let miles = number(row["miles"], in: 0...500), let stops = integer(row["stops"], in: 0...1000),
              let regular = integer(row["regular"], in: 0...10_000),
              let centralized = integer(row["centralized"], in: 0...10_000),
              let service = flag(row["service"]), let manual = flag(row["manual"]) else { throw invalid }
        var details: [String] = []
        if !isMissing(row["details"]) {
            guard let notes = row["details"] as? [Any], notes.count <= 16 else { throw invalid }
            details = try notes.map {
                guard let detail = word($0, limit: 360) else { throw invalid }
                return detail
            }
        }
        let waypoint: RoutePoint?
        if isMissing(row["waypoint"]) {
            waypoint = nil
        } else {
            guard let pair = row["waypoint"] as? [Any], pair.count == 2,
                  let latitude = number(pair[0], in: -85...85),
                  let longitude = number(pair[1], in: -180...180) else { throw invalid }
            waypoint = RoutePoint(latitude: latitude, longitude: longitude)
        }
        return RouteStep(id: id, action: action, title: title, source: source, details: details,
                         miles: miles, stops: stops, regular: regular, centralized: centralized,
                         service: service, manual: manual, waypoint: waypoint)
    }

    private static func parseMap(_ value: Any?) throws -> PacketMap {
        let invalid = RouteImportError.invalidMap
        let allowed: [(String, UTType)] = [("jpeg", .jpeg), ("png", .png), ("webp", .webP)]
        guard let object = value as? [String: Any], let url = object["image"] as? String,
              let width = integer(object["width"], in: 32...5000),
              let height = integer(object["height"], in: 32...5000),
              let format = allowed.first(where: { url.hasPrefix("data:image/\($0.0);base64,") }),
              let delimiter = url.firstIndex(of: ","),
              let bytes = decodeBase64(url[url.index(after: delimiter)...]),
              let image = CGImageSourceCreateWithData(bytes as CFData, nil),
              CGImageSourceGetStatus(image) == .statusComplete,
              CGImageSourceGetStatusAtIndex(image, 0) == .statusComplete,
              CGImageSourceGetType(image) as String? == format.1.identifier,
              let props = CGImageSourceCopyPropertiesAtIndex(image, 0, nil) as? [String: Any],
              props[kCGImagePropertyPixelWidth as String] as? Int == width,
              props[kCGImagePropertyPixelHeight as String] as? Int == height,
              CGImageSourceCreateThumbnailAtIndex(image, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceThumbnailMaxPixelSize: 32,
                  kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary) != nil else { throw invalid }
        let bounds: MapBounds?
        if isMissing(object["bounds"]) {
            bounds = nil
        } else {
            guard let coordinates = object["bounds"] as? [String: Any],
                  let north = number(coordinates["north"], in: -85...85),
                  let south = number(coordinates["south"], in: -85...85),
                  let west = number(coordinates["west"], in: -180...180),
                  let east = number(coordinates["east"], in: -180...180) else { throw invalid }
            let candidate = MapBounds(north: north, south: south, east: east, west: west)
            guard candidate.isValid else { throw invalid }
            bounds = candidate
        }
        let attribution = object["attribution"] as? String == "packet-road-references" ||
            flag(object["attribution"]) == true
        return PacketMap(imageData: bytes, width: width, height: height, bounds: bounds,
                         hasRoadReferenceAttribution: attribution)
    }

    private static func decodeBase64(_ payload: Substring) -> Data? {
        let remainder = payload.utf8.count % 4
        if remainder == 0 { return Data(base64Encoded: String(payload)) }
        guard remainder != 1, !payload.contains("=") else { return nil }
        return Data(base64Encoded: String(payload) + String(repeating: "=", count: 4 - remainder))
    }

    private static func isMissing(_ value: Any?) -> Bool { value == nil || value is NSNull }

    private static func word(_ value: Any?, limit: Int) -> String? {
        guard let string = value as? String, string.utf16.count <= limit else { return nil }
        let clean = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return clean.isEmpty ? nil : clean
    }

    private static func number(_ value: Any?, in range: ClosedRange<Double>) -> Double? {
        guard let wrapped = value as? NSNumber, CFGetTypeID(wrapped) != CFBooleanGetTypeID(),
              range.contains(wrapped.doubleValue) else { return nil }
        return wrapped.doubleValue
    }

    private static func integer(_ value: Any?, in range: ClosedRange<Double>) -> Int? {
        guard let x = number(value, in: range), x.rounded(.towardZero) == x else { return nil }
        return Int(x)
    }

    private static func flag(_ value: Any?) -> Bool? {
        guard let value else { return false }
        guard let wrapped = value as? NSNumber, CFGetTypeID(wrapped) == CFBooleanGetTypeID() else { return nil }
        return wrapped.boolValue
    }
}

public enum RouteImportError: LocalizedError, Equatable {
    case invalidFile, tooLarge, unsupportedVersion, invalidRoute, invalidStep(Int), invalidMap

    public var errorDescription: String? {
        switch self {
        case .invalidFile: "Choose a valid Route Scout JSON file."
        case .tooLarge: "This route file is larger than 2.5 MB."
        case .unsupportedVersion: "Choose a version 1 Route Scout route file."
        case .invalidRoute: "The packet needs a name and at least one ordered step."
        case .invalidStep(let number): "Step \(number) is invalid or out of order."
        case .invalidMap: "The packet map could not be read or its bounds are invalid."
        }
    }
}

public struct Route: Sendable {
    public let id: String
    public let name: String
    public let area: String
    public let effective: String
    public let miles: Double
    public let map: PacketMap?
    public let steps: [RouteStep]

    public func search(_ query: String, serviceOnly: Bool = false) -> [RouteStep] {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let startsWithHash = text.hasPrefix("#")
        let digits = startsWithHash ? String(text.dropFirst()) : text
        let id = digits.allSatisfy { $0 >= "0" && $0 <= "9" } ? Int(digits) : nil
        let words = text.split(whereSeparator: \.isWhitespace)
        return steps.filter { step in
            if serviceOnly && !step.serviceRequired { return false }
            if id == step.id { return true }
            if startsWithHash { return false }
            let description = ([step.title, step.source] + step.details).joined(separator: " ").lowercased()
            return words.allSatisfy { description.contains($0) }
        }
    }
}

public struct RouteStep: Sendable, Identifiable {
    public enum Direction: String, Sendable {
        case north, depart, straight, left, right, roundabout, `return`, finish
        case bearLeft = "bear-left"
        case bearRight = "bear-right"
    }

    public let id: Int
    public let action: Direction
    public let title: String
    public let source: String
    public let details: [String]
    public let miles: Double
    public let stops: Int
    public let regular: Int
    public let centralized: Int
    public let service: Bool
    public let manual: Bool
    public let waypoint: RoutePoint?

    public var serviceRequired: Bool { service || stops > 0 || regular > 0 || centralized > 0 }
}

public struct PacketMap: Sendable {
    public let imageData: Data
    public let width: Int
    public let height: Int
    public let bounds: MapBounds?
    public let hasRoadReferenceAttribution: Bool
}

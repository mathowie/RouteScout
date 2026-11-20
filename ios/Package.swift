// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RouteScoutCore",
    platforms: [.iOS(.v18), .macOS(.v14)],
    products: [.library(name: "RouteScoutCore", targets: ["RouteScoutCore"])],
    targets: [
        .target(name: "RouteScoutCore", resources: [.copy("Resources/Sample.route.json")]),
        .testTarget(name: "RouteScoutCoreTests", dependencies: ["RouteScoutCore"]),
    ]
)

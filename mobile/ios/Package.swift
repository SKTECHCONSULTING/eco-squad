// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "EcoSquad",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .executable(
            name: "EcoSquad",
            targets: ["EcoSquad"]
        )
    ],
    dependencies: [
        // No external dependencies - using native iOS frameworks only
    ],
    targets: [
        .executableTarget(
            name: "EcoSquad",
            path: "EcoSquad",
            exclude: ["Resources"],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        )
    ]
)

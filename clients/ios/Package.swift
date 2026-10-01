// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "XiaYunCore",
    products: [
        .library(name: "XiaYunCore", targets: ["XiaYunCore"]),
    ],
    targets: [
        .target(name: "XiaYunCore", path: "XiaYunCore"),
        .testTarget(
            name: "XiaYunCoreTests",
            dependencies: ["XiaYunCore"],
            path: "XiaYunCoreTests"
        ),
    ]
)

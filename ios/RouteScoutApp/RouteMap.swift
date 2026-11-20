import RouteScoutCore
import SwiftUI

struct RouteMapScreen: View {
    let packet: PacketMap
    let image: UIImage
    let step: RouteStep?
    let location: ForegroundLocation

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var zoom = 1.0

    private var stepPin: MapPosition? {
        step?.waypoint.flatMap { packet.bounds?.project($0) }
    }

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 2)) { update in
                let fix = location.fix.flatMap { $0.isUsable(at: update.date) ? $0 : nil }
                let gps = fix.flatMap { packet.bounds?.project($0.point) }
                VStack(spacing: 12) {
                    mapViewport(gps: gps)
                    mapControls
                    footer(fix: fix, gps: gps)
                }
                .frame(maxWidth: 760)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .background(ScoutPalette.paper.ignoresSafeArea())
            }
            .navigationTitle("Packet map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("close-map")
                }
            }
        }
        .tint(ScoutPalette.accent)
    }

    private func mapViewport(gps: MapPosition?) -> some View {
        GeometryReader { proxy in
            let ratio = CGFloat(packet.width) / CGFloat(packet.height)
            let baseWidth = max(1, min(proxy.size.width, proxy.size.height * ratio))
            let width = baseWidth * zoom
            let height = width / ratio
            ScrollView([.horizontal, .vertical]) {
                ZStack(alignment: .topLeading) {
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.high)
                        .accessibilityLabel("Route packet map")
                    if let pin = stepPin {
                        marker(color: .orange, core: 12, ring: 18)
                            .accessibilityLabel("Approximate current step pin")
                            .position(x: pin.x * width, y: pin.y * height)
                    }
                    if let gps {
                        marker(color: Color(red: 0.03, green: 0.38, blue: 0.86), core: 13, ring: 26)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("Your approximate GPS position")
                            .accessibilityIdentifier("gps-map-dot")
                            .position(x: gps.x * width, y: gps.y * height)
                    }
                }
                .frame(width: width, height: height)
                .frame(minWidth: proxy.size.width, minHeight: proxy.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
            .defaultScrollAnchor(.center)
            .background(ScoutPalette.surface, in: RoundedRectangle(cornerRadius: 16))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .frame(minHeight: 105)
    }

    private func marker(color: Color, core: CGFloat, ring: CGFloat) -> some View {
        ZStack {
            Circle().fill(color.opacity(0.27)).frame(width: ring, height: ring)
            Circle().fill(color).frame(width: core, height: core)
                .overlay { Circle().strokeBorder(.white, lineWidth: 2) }
                .shadow(color: .black.opacity(0.3), radius: 1, y: 1)
        }
    }

    private var mapControls: some View {
        HStack {
            Button {
                location.toggle()
            } label: {
                Label(location.requested ? "Turn GPS off" : "Enable GPS", systemImage: location.requested ? "location.fill" : "location")
                    .frame(minHeight: 30)
            }
            .buttonStyle(.borderedProminent)
            .tint(ScoutPalette.button)
            .foregroundStyle(.white)
            .accessibilityIdentifier("location-toggle")
            Spacer(minLength: 4)
            HStack(spacing: 4) {
                Button { zoom = max(1, zoom / 1.5) } label: {
                    Image(systemName: "minus.magnifyingglass").frame(minWidth: 28, minHeight: 30)
                }
                .accessibilityLabel("Zoom out")
                .disabled(zoom <= 1)
                Button("Fit") { zoom = 1 }.frame(minHeight: 30).disabled(zoom == 1)
                    .accessibilityLabel("Fit the map")
                Button { zoom = min(5, zoom * 1.5) } label: {
                    Image(systemName: "plus.magnifyingglass").frame(minWidth: 28, minHeight: 30)
                }
                .accessibilityLabel("Zoom in")
                .disabled(zoom >= 5)
            }
            .buttonStyle(.bordered)
        }
        .font(.subheadline.weight(.semibold))
    }

    private func footer(fix: LocationFix?, gps: MapPosition?) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(status(fix: fix, gps: gps))
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("map-location-status")
            if location.state == .denied, let settings = URL(string: UIApplication.openSettingsURLString) {
                Button("Open iPhone Settings") { openURL(settings) }.font(.subheadline)
            }
            if let step, stepPin != nil {
                if let fix, gps != nil, !step.manual, !step.serviceRequired, let waypoint = step.waypoint,
                   let distance = distanceLabel(fix.point.distance(to: waypoint)) {
                    Label(distance, systemImage: "mappin.circle").font(.footnote).foregroundStyle(.secondary)
                } else {
                    Label("Orange pin: approximate step start", systemImage: "mappin.circle")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            } else if step != nil {
                Label("No pin for this step", systemImage: "mappin.slash")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if packet.hasRoadReferenceAttribution {
                Text("Packet map aligned to public road references.").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func status(fix: LocationFix?, gps: MapPosition?) -> String {
        switch location.state {
        case .off: return "GPS off. Enable it to see your position."
        case .requesting: return "Waiting for location permission."
        case .paused: return "GPS paused."
        case .denied: return "Location access is off for Route Scout."
        case .unavailable: return "Location is unavailable."
        case .waiting: return "Waiting for a location fix."
        case .tracking: break
        }
        guard let fix else { return "GPS signal weak or out of date. Waiting for a fresh fix." }
        guard packet.bounds != nil else { return "This packet map has no GPS alignment." }
        guard gps != nil else { return "Your location is outside this packet map." }
        let feet = Int((fix.accuracy * 3.28084).rounded(.up))
        return "GPS on · Within this map · Accuracy about \(feet) ft"
    }

    private func distanceLabel(_ meters: Double) -> String? {
        guard meters <= 1600 else { return nil }
        if meters <= 12 { return "Near the current step pin" }
        let feet = (Int((meters * 3.28084 / 10).rounded()) * 10).formatted()
        return "About \(feet) ft to the step pin"
    }
}

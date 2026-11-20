import RouteScoutCore
import SwiftUI

struct GuideView: View {
    let active: ActiveRoute
    let hasMap: Bool
    let move: (RouteAction) -> Void
    let showMap: () -> Void
    let repeatDirection: () -> Void

    private var session: RouteSession { active.session }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                routeHeader
                if let step = session.current {
                    currentCard(step)
                    if let next = session.next {
                        nextCard(next)
                    }
                } else {
                    finishCard
                }
                if hasMap {
                    Button(action: showMap) {
                        HStack(spacing: 12) {
                            Image(systemName: "map")
                                .font(.title3)
                                .foregroundStyle(ScoutPalette.accent)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Packet map").font(.headline)
                                Text("View the route and your position")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                        }
                        .foregroundStyle(.primary)
                        .padding(16)
                        .scoutCard()
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("packet-map-card")
                }
            }
            .frame(maxWidth: 680)
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
        }
        .id(session.cursor)
        .scrollBounceBehavior(.basedOnSize)
        .background(ScoutPalette.paper.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { controls }
    }

    private var routeHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(active.isDemo ? "PRACTICE ROUTE" : "DELIVERY ROUTE")
                    .font(.caption.weight(.bold)).tracking(1.6)
                    .foregroundStyle(ScoutPalette.accent)
                Spacer()
                Text(session.route.miles.mileageLabel)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("\(session.route.miles, format: .number) miles in the packet")
            }
            Text(session.route.name)
                .font(.title2.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text(session.route.area)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ProgressView(value: Double(session.cursor), total: Double(session.route.steps.count))
                .tint(ScoutPalette.accent)
                .padding(.top, 5)
                .accessibilityLabel("Place in packet")
                .accessibilityValue("\(session.cursor) of \(session.route.steps.count) steps before the bookmark")
        }
    }

    private func currentCard(_ step: RouteStep) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .firstTextBaseline) {
                Text("Step \(step.id) of \(session.route.steps.count)")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(ScoutPalette.accent)
                    .accessibilityIdentifier("step-count")
                Spacer(minLength: 12)
                Text(step.miles.mileageLabel)
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .center, spacing: 13) {
                Image(systemName: step.action.symbol)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(ScoutPalette.button, in: RoundedRectangle(cornerRadius: 14))
                    .accessibilityHidden(true)
                Text(step.title)
                    .font(.title.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(step.source)
                .font(.title3)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(3)
            ForEach(Array(step.additionalNotes.enumerated()), id: \.offset) { _, note in
                Label {
                    Text(note).fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "text.alignleft").foregroundStyle(ScoutPalette.accent)
                }
                .font(.subheadline)
            }
            if step.serviceRequired {
                serviceCard(step)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .scoutCard()
        .accessibilitySortPriority(1)
    }

    private func serviceCard(_ step: RouteStep) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Label("Delivery step", systemImage: "envelope.fill")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(ScoutPalette.service)
            if step.stops + step.regular + step.centralized > 0 {
                let counts = [
                    step.stops > 0 ? "\(step.stops) stops" : nil,
                    step.regular > 0 ? "\(step.regular) regular boxes" : nil,
                    step.centralized > 0 ? "\(step.centralized) cluster boxes" : nil,
                ].compactMap { $0 }
                Text(counts.joined(separator: " · ")).font(.subheadline)
            } else {
                Text("Follow the service instruction above.").font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(ScoutPalette.service.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
    }

    private func nextCard(_ step: RouteStep) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: step.action.symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(ScoutPalette.accent)
                .frame(width: 37, height: 37)
                .background(ScoutPalette.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 10))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("UP NEXT").font(.caption2.weight(.bold)).tracking(1.3).foregroundStyle(.secondary)
                Text(step.title).font(.headline)
                Text(step.source).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .scoutCard()
    }

    private var finishCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "flag.checkered").font(.title).foregroundStyle(ScoutPalette.accent)
                .accessibilityHidden(true)
            Text("End of packet").font(.title.weight(.bold))
                .accessibilityIdentifier("end-of-packet")
                .accessibilityAddTraits(.isHeader)
            Text("Your place is saved at the end of the packet. Open Steps to revisit an instruction.")
                .font(.body).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .scoutCard()
    }

    private var controls: some View {
        VStack(spacing: 7) {
            if let step = session.current {
                Button {
                    move(step.serviceRequired ? .serviceDone(stepID: step.id) : .nextDrive(stepID: step.id))
                } label: {
                    Label(step.serviceRequired ? "Service done" : "Next step",
                          systemImage: step.serviceRequired ? "checkmark" : "arrow.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 47)
                }
                .buttonStyle(.borderedProminent)
                .tint(step.serviceRequired ? ScoutPalette.serviceButton : ScoutPalette.button)
                .foregroundStyle(.white)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .accessibilityIdentifier("advance-step")
            }
            HStack(spacing: 8) {
                Button { move(.previous) } label: {
                    Label("Back", systemImage: "chevron.left").frame(maxWidth: .infinity, minHeight: 44)
                }
                .accessibilityIdentifier("previous-step")
                .disabled(session.cursor == 0)
                if session.current != nil {
                    Button(action: repeatDirection) {
                        Label("Repeat", systemImage: "speaker.wave.2").frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .accessibilityIdentifier("repeat-step")
                }
            }
            .buttonStyle(.plain)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(ScoutPalette.accent)
        }
        .frame(maxWidth: 680)
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
        .overlay(alignment: .top) { Divider() }
    }
}

enum ScoutPalette {
    static let accent = adaptive(light: 0x126B57, dark: 0x74DFB9)
    static let button = Color(uiColor: UIColor(red: 0.045, green: 0.352, blue: 0.278, alpha: 1))
    static let service = adaptive(light: 0x795011, dark: 0xF6C56C)
    static let serviceButton = Color(uiColor: UIColor(red: 0.45, green: 0.27, blue: 0.05, alpha: 1))
    static let paper = adaptive(light: 0xF3F6F2, dark: 0x141D19)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x202C26)

    private static func adaptive(light: Int, dark: Int) -> Color {
        Color(uiColor: UIColor { trait in
            let rgb = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((rgb >> 16) & 255) / 255,
                           green: CGFloat((rgb >> 8) & 255) / 255,
                           blue: CGFloat(rgb & 255) / 255, alpha: 1)
        })
    }
}

extension View {
    func scoutCard() -> some View {
        background(ScoutPalette.surface, in: RoundedRectangle(cornerRadius: 18))
            .overlay { RoundedRectangle(cornerRadius: 18).strokeBorder(.primary.opacity(0.07), lineWidth: 1).allowsHitTesting(false) }
    }
}

extension RouteStep.Direction {
    var symbol: String {
        switch self {
        case .north, .depart, .straight: "arrow.up"
        case .left: "arrow.turn.up.left"
        case .right: "arrow.turn.up.right"
        case .bearLeft: "arrow.up.left"
        case .bearRight: "arrow.up.right"
        case .roundabout: "arrow.trianglehead.clockwise.rotate.90"
        case .return: "arrow.turn.down.left"
        case .finish: "flag.checkered"
        }
    }
}

extension Double {
    var mileageLabel: String { formatted(.number.precision(.fractionLength(0...2))) + " mi" }
}

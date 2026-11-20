import RouteScoutCore
import SwiftUI

@main
struct RouteScoutApp: App {
    var body: some Scene {
        WindowGroup { RouteScoutRoot() }
    }
}

struct RouteScoutRoot: View {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("routeScout.spokenDirections") private var spokenDirections = false
    @State private var model = RouteModel()
    @State private var location = ForegroundLocation()
    @State private var speech = SpokenGuide()
    @State private var sheet: Panel?
    @State private var problem: String?

    private enum Panel: String, Identifiable {
        case steps, map, settings
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let active = model.active {
                    GuideView(active: active, hasMap: model.mapImage != nil, move: apply, showMap: { sheet = .map }, repeatDirection: speakCurrent)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) { tool(.steps, title: "Steps", symbol: "list.number") }
                            ToolbarItemGroup(placement: .topBarTrailing) {
                                if model.mapImage != nil { tool(.map, title: "Map", symbol: "map") }
                                tool(.settings, title: "Settings", symbol: "gearshape")
                            }
                        }
                } else {
                    ContentUnavailableView {
                        Label("Route Scout is unavailable", systemImage: "exclamationmark.folder")
                    } description: {
                        Text(model.startupProblem ?? "The saved route could not be opened.")
                    } actions: {
                        Button("Try again") { model.load() }.buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("Route Scout")
            .navigationBarTitleDisplayMode(.inline)
        }
        .tint(ScoutPalette.accent)
        .sheet(item: $sheet) { panel in
            switch panel {
            case .steps:
                if let active = model.active {
                    RouteStepsScreen(session: active.session, select: { apply(.jump(stepID: $0)) })
                }
            case .map:
                if let active = model.active, let map = active.packet.route.map, let image = model.mapImage {
                    RouteMapScreen(packet: map, image: image, step: active.session.current, location: location)
                }
            case .settings:
                RouteSettingsScreen(model: model, spokenDirections: $spokenDirections, restart: { apply(.restart) })
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            location.foreground(phase == .active)
            if phase != .active { speech.stop() }
        }
        .onChange(of: spokenDirections) { _, enabled in
            if !enabled { speech.stop() }
        }
        .onChange(of: model.active?.packet.data) { _, _ in speech.stop() }
        .alert("Route Scout", isPresented: Binding(get: { problem != nil }, set: { if !$0 { problem = nil } })) {
            Button("OK", role: .cancel) { problem = nil }
        } message: {
            Text(problem ?? "")
        }
    }

    private func tool(_ panel: Panel, title: String, symbol: String) -> some View {
        Button { sheet = panel } label: {
            Image(systemName: symbol)
        }
        .accessibilityLabel(title)
        .accessibilityIdentifier("open-\(panel.rawValue)")
    }

    private func apply(_ action: RouteAction) {
        do {
            guard try model.apply(action) else { return }
            speech.stop()
            if spokenDirections, scenePhase == .active, let step = model.active?.session.current { speech.speak(step) }
        } catch {
            problem = "Your progress couldn’t be saved. The current step hasn’t changed."
        }
    }

    private func speakCurrent() {
        guard scenePhase == .active, let step = model.active?.session.current else { return }
        if !speech.speak(step) {
            problem = "An installed English system voice is needed for spoken directions."
        }
    }
}

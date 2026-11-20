import RouteScoutCore
import SwiftUI
import UniformTypeIdentifiers

struct RouteStepsScreen: View {
    let session: RouteSession
    let select: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var serviceOnly = false

    var body: some View {
        NavigationStack {
            let steps = session.route.search(query, serviceOnly: serviceOnly)
            List {
                Toggle("Delivery steps only", isOn: $serviceOnly)
                if steps.isEmpty {
                    ContentUnavailableView.search(text: query)
                } else {
                    ForEach(steps) { step in
                        Button {
                            select(step.id)
                            dismiss()
                        } label: {
                            stepRow(step)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("route-step-\(step.id)")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Line of travel")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Street, note, or #step")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .tint(ScoutPalette.accent)
    }

    private func stepRow(_ step: RouteStep) -> some View {
        let current = session.current?.id == step.id
        return HStack(alignment: .top, spacing: 12) {
            Image(systemName: step.action.symbol)
                .foregroundStyle(ScoutPalette.accent)
                .frame(minWidth: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text("\(step.id). \(step.title)").font(.body.weight(.semibold))
                Text(step.source).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
                if step.serviceRequired {
                    Label("Delivery step", systemImage: "envelope").font(.caption).foregroundStyle(ScoutPalette.service)
                }
                if current {
                    Text("Current step").font(.caption.weight(.semibold)).foregroundStyle(ScoutPalette.accent)
                }
            }
            Spacer(minLength: 4)
            Text(step.miles.mileageLabel)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }
}

struct RouteSettingsScreen: View {
    let model: RouteModel
    @Binding var spokenDirections: Bool
    let restart: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var filePicker = false
    @State private var importing = false
    @State private var prompt: Prompt?

    private enum Prompt: Identifiable {
        case replace(RoutePacket), restart, remove, message(String, String)

        var id: String {
            switch self {
            case .replace: "replace"
            case .restart: "restart"
            case .remove: "remove"
            case .message(let title, _): title
            }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let active = model.active {
                        LabeledContent("Active route", value: active.packet.route.name)
                    }
                    Button { filePicker = true } label: {
                        if importing {
                            ProgressView("Opening route…")
                        } else {
                            Label("Import route", systemImage: "square.and.arrow.down")
                        }
                    }
                    .accessibilityIdentifier("import-route")
                    .disabled(importing)
                } header: {
                    Text("Route packet")
                } footer: {
                    Text("Choose your existing .route.json from Files. The packet and your place stay on this iPhone.")
                }
                Section {
                    Toggle("Spoken directions", isOn: $spokenDirections)
                } footer: {
                    Text("Read the next instruction with an installed English system voice. Use Repeat to hear the current step any time the app is open.")
                }
                if let active = model.active {
                    Section("Progress") {
                        Button("Restart route") { prompt = .restart }
                            .disabled(active.session.cursor == 0 || importing)
                        if !active.isDemo {
                            Button("Remove imported route", role: .destructive) { prompt = .remove }.disabled(importing)
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.disabled(importing).accessibilityIdentifier("close-settings")
                }
            }
            .fileImporter(isPresented: $filePicker, allowedContentTypes: [.json], onCompletion: handleFile)
            .alert(item: $prompt, content: makeAlert)
            .interactiveDismissDisabled(importing)
        }
        .tint(ScoutPalette.accent)
    }

    private func handleFile(_ result: Result<URL, any Error>) {
        switch result {
        case .failure(let error):
            if (error as? CocoaError)?.code != .userCancelled {
                prompt = .message("Couldn’t open the file", "Choose a Route Scout packet from Files and try again.")
            }
        case .success(let url):
            importing = true
            Task {
                defer { importing = false }
                do {
                    let packet = try await Task.detached(priority: .userInitiated) { try RouteFileAccess.read(url) }.value
                    if model.needsReplacementConfirmation(packet) {
                        prompt = .replace(packet)
                    } else {
                        save(packet, replacing: false)
                    }
                } catch {
                    let detail = (error as? RouteImportError)?.errorDescription ?? "Check that the file is available in Files and try again."
                    prompt = .message("Couldn’t import route", detail)
                }
            }
        }
    }

    private func save(_ packet: RoutePacket, replacing: Bool) {
        do {
            if try model.importPacket(packet, replacing: replacing) {
                dismiss()
            } else {
                prompt = .message("Route already loaded", "Your current step is still saved.")
            }
        } catch let error as RouteImportError {
            prompt = .message("Couldn’t open the route map", error.localizedDescription)
        } catch {
            prompt = .message("Couldn’t save the route", "The current route and progress are still in place.")
        }
    }

    private func makeAlert(_ prompt: Prompt) -> Alert {
        switch prompt {
        case .replace(let packet):
            Alert(title: Text("Replace this route?"),
                  message: Text("\(packet.route.name) will start at step 1. This replaces the current packet and its saved place."),
                  primaryButton: .destructive(Text("Replace route")) { save(packet, replacing: true) }, secondaryButton: .cancel())
        case .restart:
            Alert(title: Text("Restart at step 1?"),
                  message: Text("This moves your bookmark to the start of the packet."),
                  primaryButton: .destructive(Text("Restart")) { dismiss(); restart() }, secondaryButton: .cancel())
        case .remove:
            Alert(title: Text("Remove the imported route?"),
                  message: Text("This removes Route Scout’s copy and its bookmark. Your original in Files stays in place."),
                  primaryButton: .destructive(Text("Remove")) { remove() }, secondaryButton: .cancel())
        case .message(let title, let detail):
            Alert(title: Text(title), message: Text(detail), dismissButton: .default(Text("OK")))
        }
    }

    private func remove() {
        do {
            try model.removeImportedRoute()
            dismiss()
        } catch {
            prompt = .message("Couldn’t remove the route", "The current packet and bookmark are still in place.")
        }
    }
}

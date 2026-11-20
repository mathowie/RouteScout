import AVFoundation
import CoreLocation
import Observation
import RouteScoutCore

@MainActor @Observable
final class ForegroundLocation: NSObject, CLLocationManagerDelegate {
    enum State: Equatable { case off, requesting, denied, waiting, tracking, paused, unavailable }

    private let manager = CLLocationManager()
    private(set) var state: State = .off
    private(set) var requested = false
    private var readings = RecentLocation()
    private var isActive = false

    var fix: LocationFix? { readings.latest }

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.activityType = .automotiveNavigation
        manager.distanceFilter = kCLDistanceFilterNone
    }

    func toggle() {
        requested.toggle()
        refresh(askPermission: requested)
    }

    func foreground(_ active: Bool) {
        isActive = active
        refresh()
    }

    private func refresh(askPermission: Bool = false) {
        guard requested && isActive else {
            manager.stopUpdatingLocation()
            readings.clear()
            state = requested ? .paused : .off
            return
        }
        switch manager.authorizationStatus {
        case .notDetermined:
            state = .requesting
            if askPermission { manager.requestWhenInUseAuthorization() }
        case .authorizedWhenInUse, .authorizedAlways:
            state = fix == nil ? .waiting : .tracking
            manager.startUpdatingLocation()
        case .denied, .restricted:
            manager.stopUpdatingLocation()
            readings.clear()
            state = .denied
        @unknown default:
            manager.stopUpdatingLocation()
            readings.clear()
            state = .unavailable
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor [weak self] in self?.refresh() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let point = RoutePoint(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
        let reading = LocationFix(point: point, accuracy: location.horizontalAccuracy, timestamp: location.timestamp)
        Task { @MainActor [weak self] in
            guard let self, isActive, requested,
                  self.manager.authorizationStatus == .authorizedWhenInUse || self.manager.authorizationStatus == .authorizedAlways else { return }
            // A newer weak reading supersedes the old position; a delayed callback does not.
            if readings.receive(reading, at: .now) { state = .tracking }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        let isDenied = (error as? CLError)?.code == .denied
        Task { @MainActor [weak self] in
            guard let self, isActive, requested else { return }
            if isDenied {
                refresh()
            } else {
                readings.clear()
                state = .waiting
            }
        }
    }
}

@MainActor
final class SpokenGuide {
    private let synthesizer = AVSpeechSynthesizer()

    init() { synthesizer.usesApplicationAudioSession = false }

    @discardableResult
    func speak(_ step: RouteStep) -> Bool {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter {
            $0.language.hasPrefix("en-") && !$0.voiceTraits.contains(.isNoveltyVoice)
                && !$0.voiceTraits.contains(.isPersonalVoice)
        }
        guard let voice = voices.first(where: { $0.language == "en-US" && $0.quality == .default }) ?? voices.first else {
            return false
        }
        stop()
        let utterance = AVSpeechUtterance(string: ([step.source] + step.additionalNotes).joined(separator: " "))
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.94
        synthesizer.speak(utterance)
        return true
    }

    func stop() { synthesizer.stopSpeaking(at: .immediate) }
}

extension RouteStep {
    var additionalNotes: [String] { details.filter { !source.localizedStandardContains($0) } }
}

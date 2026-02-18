import SwiftUI

struct AddBetView: View {
    @EnvironmentObject var vm: BetTrackerViewModel
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss

    // Form fields
    @State private var title = ""
    @State private var type: BetType = .moneyline
    @State private var sport: Sport = .nfl
    @State private var sportsbook = ""
    @State private var stakeText = ""
    @State private var oddsText = ""
    @State private var gameStartTime = Date()
    @State private var notes = ""
    @State private var notificationsEnabled = true

    // Parlay legs
    @State private var legs: [BetLeg] = []
    @State private var showAddLeg = false

    private var isParlay: Bool {
        [.parlay, .teaser, .roundRobin].contains(type)
    }

    private var isValid: Bool {
        !title.isEmpty &&
        !sportsbook.isEmpty &&
        (Double(stakeText) ?? 0) > 0 &&
        Int(oddsText) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    // Details section
                    Section("Bet Details") {
                        themedTextField(label: "Title / Selection", text: $title, placeholder: "e.g. Chiefs -3.5")
                        themedPicker(label: "Sport", selection: $sport, options: Sport.allCases, display: \.rawValue)
                        themedPicker(label: "Type", selection: $type, options: BetType.allCases, display: \.rawValue)
                        themedTextField(label: "Sportsbook", text: $sportsbook, placeholder: "DraftKings, FanDuel...")
                    }
                    .listRowBackground(theme.surface)

                    // Financials section
                    Section("Financials") {
                        HStack {
                            Text("Stake ($)")
                                .foregroundStyle(theme.onSurface.opacity(0.7))
                            TextField("0.00", text: $stakeText)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(theme.onSurface)
                        }
                        HStack {
                            Text("Odds")
                                .foregroundStyle(theme.onSurface.opacity(0.7))
                            TextField("+110 or -110", text: $oddsText)
                                .keyboardType(.numbersAndPunctuation)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(theme.onSurface)
                        }

                        if let stake = Double(stakeText), let odds = Int(oddsText), stake > 0 {
                            let payout = odds > 0
                                ? stake * (Double(odds) / 100)
                                : stake * (100.0 / Double(abs(odds)))
                            HStack {
                                Text("Potential Win")
                                    .foregroundStyle(theme.onSurface.opacity(0.7))
                                Spacer()
                                Text(String(format: "$%.2f", payout))
                                    .foregroundStyle(theme.primary)
                                    .bold()
                            }
                        }
                    }
                    .listRowBackground(theme.surface)

                    // Game info
                    Section("Game Info") {
                        DatePicker("Game Start", selection: $gameStartTime, displayedComponents: [.date, .hourAndMinute])
                            .foregroundStyle(theme.onSurface)
                    }
                    .listRowBackground(theme.surface)

                    // Parlay legs
                    if isParlay {
                        Section("Legs") {
                            ForEach($legs) { $leg in
                                legRow(leg: leg)
                            }
                            .onDelete { legs.remove(atOffsets: $0) }
                            Button {
                                showAddLeg = true
                            } label: {
                                Label("Add Leg", systemImage: "plus.circle")
                                    .foregroundStyle(theme.primary)
                            }
                        }
                        .listRowBackground(theme.surface)
                    }

                    // Notifications
                    Section("Notifications") {
                        Toggle(isOn: $notificationsEnabled) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Enable Notifications")
                                    .foregroundStyle(theme.onSurface)
                                Text("Game start alerts and score updates")
                                    .font(.caption)
                                    .foregroundStyle(theme.onSurface.opacity(0.5))
                            }
                        }
                        .tint(theme.primary)
                    }
                    .listRowBackground(theme.surface)

                    // Notes
                    Section("Notes (Optional)") {
                        TextField("Reasoning, matchup notes...", text: $notes, axis: .vertical)
                            .lineLimit(3...6)
                            .foregroundStyle(theme.onSurface)
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
                .background(theme.background)
            }
            .navigationTitle("Add Bet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(theme.onSurface.opacity(0.6))
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        saveBet()
                    }
                    .foregroundStyle(isValid ? theme.primary : theme.onSurface.opacity(0.3))
                    .fontWeight(.semibold)
                    .disabled(!isValid)
                }
            }
            .sheet(isPresented: $showAddLeg) {
                AddLegView(legs: $legs)
                    .environment(\.theme, theme)
            }
        }
    }

    // MARK: - Row Builders

    private func themedTextField(label: String, text: Binding<String>, placeholder: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(theme.onSurface.opacity(0.7))
            TextField(placeholder, text: text)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(theme.onSurface)
        }
    }

    private func themedPicker<T: Hashable>(label: String, selection: Binding<T>, options: [T], display: KeyPath<T, String>) -> some View {
        Picker(label, selection: selection) {
            ForEach(options, id: \.self) { opt in
                Text(opt[keyPath: display]).tag(opt)
            }
        }
        .foregroundStyle(theme.onSurface)
    }

    private func legRow(leg: BetLeg) -> some View {
        HStack {
            Image(systemName: leg.sport.iconName)
                .foregroundStyle(theme.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text(leg.game)
                    .font(.caption.bold())
                    .foregroundStyle(theme.onSurface)
                Text(leg.selection)
                    .font(.caption2)
                    .foregroundStyle(theme.onSurface.opacity(0.6))
            }
            Spacer()
            Text(leg.formattedOdds)
                .font(.caption.bold())
                .foregroundStyle(theme.accent)
        }
    }

    // MARK: - Save

    private func saveBet() {
        guard let stake = Double(stakeText), let odds = Int(oddsText) else { return }
        let bet = Bet(
            title: title,
            type: type,
            sport: sport,
            sportsbook: sportsbook,
            stake: stake,
            odds: odds,
            legs: legs,
            gameStartTime: gameStartTime,
            notes: notes,
            notificationsEnabled: notificationsEnabled
        )
        vm.addBet(bet)
        dismiss()
    }
}

// MARK: - Add Leg View

struct AddLegView: View {
    @Binding var legs: [BetLeg]
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss

    @State private var game = ""
    @State private var selection = ""
    @State private var sport: Sport = .nfl
    @State private var oddsText = ""

    private var isValid: Bool {
        !game.isEmpty && !selection.isEmpty && Int(oddsText) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                Form {
                    Section {
                        HStack {
                            Text("Game")
                                .foregroundStyle(theme.onSurface.opacity(0.7))
                            TextField("e.g. Chiefs vs Eagles", text: $game)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(theme.onSurface)
                        }
                        HStack {
                            Text("Selection")
                                .foregroundStyle(theme.onSurface.opacity(0.7))
                            TextField("e.g. Chiefs -3.5", text: $selection)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(theme.onSurface)
                        }
                        Picker("Sport", selection: $sport) {
                            ForEach(Sport.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                        }
                        .foregroundStyle(theme.onSurface)
                        HStack {
                            Text("Odds")
                                .foregroundStyle(theme.onSurface.opacity(0.7))
                            TextField("-110", text: $oddsText)
                                .keyboardType(.numbersAndPunctuation)
                                .multilineTextAlignment(.trailing)
                                .foregroundStyle(theme.onSurface)
                        }
                    }
                    .listRowBackground(theme.surface)
                }
                .scrollContentBackground(.hidden)
                .background(theme.background)
            }
            .navigationTitle("Add Leg")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }.foregroundStyle(theme.onSurface.opacity(0.6))
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Add") {
                        if let odds = Int(oddsText) {
                            legs.append(BetLeg(game: game, selection: selection, odds: odds, sport: sport))
                            dismiss()
                        }
                    }
                    .foregroundStyle(isValid ? theme.primary : theme.onSurface.opacity(0.3))
                    .fontWeight(.semibold)
                    .disabled(!isValid)
                }
            }
        }
    }
}

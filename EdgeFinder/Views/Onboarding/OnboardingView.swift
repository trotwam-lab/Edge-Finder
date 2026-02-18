import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @State private var showSignIn = false
    @State private var showSignUp = true  // default to sign up for new users
    @State private var isSignIn = false

    // Sign up fields
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""

    // Sign in fields
    @State private var signInEmail = ""
    @State private var signInPassword = ""

    var body: some View {
        ZStack {
            theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Brand header
                brandHeader

                Spacer()

                // Auth card
                VStack(spacing: 20) {
                    // Toggle sign in / sign up
                    Picker("Mode", selection: $isSignIn) {
                        Text("Sign Up").tag(false)
                        Text("Sign In").tag(true)
                    }
                    .pickerStyle(.segmented)

                    if isSignIn {
                        signInForm
                    } else {
                        signUpForm
                    }

                    if let error = userVM.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    // Submit button
                    Button {
                        Task {
                            if isSignIn {
                                await userVM.signIn(email: signInEmail, password: signInPassword)
                            } else {
                                await userVM.signUp(username: username, email: email, password: password)
                            }
                        }
                    } label: {
                        Group {
                            if userVM.isLoading {
                                ProgressView().tint(.black)
                            } else {
                                Text(isSignIn ? "Sign In" : "Create Account")
                                    .font(.headline)
                                    .foregroundStyle(.black)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(isFormValid ? theme.primary : theme.primary.opacity(0.4))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!isFormValid || userVM.isLoading)
                }
                .padding(24)
                .background(theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .padding()

                Spacer()

                Text("By continuing, you agree to our Terms of Service and Privacy Policy")
                    .font(.caption2)
                    .foregroundStyle(theme.onSurface.opacity(0.3))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .padding(.bottom, 16)
            }
        }
    }

    // MARK: - Brand Header

    private var brandHeader: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                .resizable()
                .frame(width: 70, height: 70)
                .foregroundStyle(theme.primary)
                .padding(.top, 60)

            Text("EdgeFinder")
                .font(.system(size: 36, weight: .black, design: .rounded))
                .foregroundStyle(theme.onSurface)

            Text("Find your betting edge.")
                .font(.subheadline)
                .foregroundStyle(theme.onSurface.opacity(0.5))

            // Feature pills
            HStack(spacing: 8) {
                featurePill(icon: "bolt.fill", text: "+EV Edges")
                featurePill(icon: "bell.fill", text: "Live Alerts")
                featurePill(icon: "lock.open.fill", text: "Lock Screen")
            }
            .padding(.top, 4)
        }
        .padding(.horizontal)
    }

    private func featurePill(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2)
            Text(text).font(.caption2.bold())
        }
        .foregroundStyle(theme.primary)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(theme.primary.opacity(0.1))
        .clipShape(Capsule())
    }

    // MARK: - Forms

    private var signInForm: some View {
        VStack(spacing: 12) {
            authField(label: "Email", text: $signInEmail, keyboard: .emailAddress)
            authField(label: "Password", text: $signInPassword, isSecure: true)
        }
    }

    private var signUpForm: some View {
        VStack(spacing: 12) {
            authField(label: "Username", text: $username)
            authField(label: "Email", text: $email, keyboard: .emailAddress)
            authField(label: "Password", text: $password, isSecure: true)
            authField(label: "Confirm Password", text: $confirmPassword, isSecure: true)
        }
    }

    private func authField(
        label: String,
        text: Binding<String>,
        keyboard: UIKeyboardType = .default,
        isSecure: Bool = false
    ) -> some View {
        Group {
            if isSecure {
                SecureField(label, text: text)
            } else {
                TextField(label, text: text)
                    .keyboardType(keyboard)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
        }
        .padding()
        .background(theme.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .foregroundStyle(theme.onSurface)
    }

    private var isFormValid: Bool {
        if isSignIn {
            return !signInEmail.isEmpty && signInPassword.count >= 6
        } else {
            return !username.isEmpty &&
                   email.contains("@") &&
                   password.count >= 6 &&
                   password == confirmPassword
        }
    }
}

// MARK: - Pro Upgrade View

struct ProUpgradeView: View {
    @EnvironmentObject var userVM: UserViewModel
    @Environment(\.theme) var theme
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        // Hero
                        VStack(spacing: 12) {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 56))
                                .foregroundStyle(theme.accent)
                            Text("EdgeFinder Pro")
                                .font(.system(size: 28, weight: .black, design: .rounded))
                                .foregroundStyle(theme.onSurface)
                            Text("Unlock every edge, every tool, every theme.")
                                .font(.subheadline)
                                .foregroundStyle(theme.onSurface.opacity(0.6))
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 20)

                        // Features
                        VStack(spacing: 14) {
                            proFeatureRow(icon: "paintpalette.fill",  title: "Custom Layout Themes",    subtitle: "8 Pro color themes for your interface")
                            proFeatureRow(icon: "bolt.fill",          title: "All Positive EV Edges",   subtitle: "Full edge database with filters")
                            proFeatureRow(icon: "bell.badge.fill",    title: "Priority Notifications",  subtitle: "Instant alerts before the line moves")
                            proFeatureRow(icon: "chart.line.uptrend.xyaxis", title: "Advanced Analytics", subtitle: "CLV, ROI tracking, and bankroll tools")
                            proFeatureRow(icon: "lock.fill",          title: "Lock Screen Live Updates", subtitle: "Real-time scores on your lock screen")
                        }
                        .padding()
                        .background(theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .padding(.horizontal)

                        // Pricing
                        VStack(spacing: 8) {
                            Text("$9.99 / month")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundStyle(theme.onSurface)
                            Text("or $79.99 / year — save 33%")
                                .font(.subheadline)
                                .foregroundStyle(theme.accent)
                        }

                        // CTA
                        Button {
                            Task {
                                await userVM.upgradeToPro()
                                dismiss()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "crown.fill")
                                Text("Upgrade to Pro")
                                    .fontWeight(.bold)
                            }
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(theme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .padding(.horizontal)

                        Text("Cancel anytime. Restore purchases available.")
                            .font(.caption)
                            .foregroundStyle(theme.onSurface.opacity(0.3))
                    }
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Go Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(theme.onSurface.opacity(0.6))
                }
            }
        }
    }

    private func proFeatureRow(icon: String, title: String, subtitle: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(theme.accent)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.bold()).foregroundStyle(theme.onSurface)
                Text(subtitle).font(.caption).foregroundStyle(theme.onSurface.opacity(0.5))
            }
            Spacer()
            Image(systemName: "checkmark")
                .foregroundStyle(theme.primary)
                .font(.caption.bold())
        }
    }
}

import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // ── Push notifications: request permission for badge + sound + alert.
        // The actual /api/usage-style flow is driven from JavaScript via the
        // @capacitor/push-notifications plugin; this just makes sure the OS
        // shows the permission sheet at the right moment.
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }

        // ── Local notifications: medication / retest reminders scheduled from JS.
        // No additional registration is required — the @capacitor/local-notifications
        // plugin handles scheduling via UNUserNotificationCenter under the hood.

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Pause ongoing tasks, timers, etc.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Release shared resources, save user data, etc.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Refresh data on resume — the JS side picks this up via App.addListener('appStateChange').
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart tasks paused while inactive.
        // Clear the app icon badge — the user has now seen any pending notifications.
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Save state if appropriate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Forward custom URL schemes to Capacitor so deep links work.
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal Links.
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // ── APNs token registration (required for FCM push on iOS) ───────────────
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // The Capacitor PushNotifications plugin swizzles this, but we keep the
        // hook here for manual debugging if a future plugin needs it.
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Log the error in debug builds — silent in production.
        #if DEBUG
        print("[FeelFit] APNs registration failed: \(error.localizedDescription)")
        #endif
    }
}

// ── Local + push notification delegate ──────────────────────────────────────────
// The @capacitor/local-notifications and @capacitor/push-notifications plugins
// install their own UNUserNotificationCenterDelegate, but if the JS bridge isn't
// ready yet (cold-launch from a notification tap) we need a fallback that just
// completes the launch.
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show notification even when the app is in the foreground.
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // Tap-handling is delegated to the JS bridge via the plugin.
        completionHandler()
    }
}

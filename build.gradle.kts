// Root build file.
//
// Intentionally empty: every plugin is applied in the module that needs it, with
// versions pinned centrally in gradle/libs.versions.toml.
//
// Keeping the root project free of any plugin declaration (even `apply false`)
// means the pure Kotlin/JVM `:core` module can be configured, built and tested
// without the Android Gradle Plugin ever being resolved:
//
//     ./gradlew --configure-on-demand :core:test
//
// which is useful on machines without an Android SDK installed.

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

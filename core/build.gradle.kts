import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
}

// Pure Kotlin/JVM module: all of WalkFit's domain logic lives here (step
// baseline arithmetic, streaks, distance/calorie estimation, aggregation).
// It has no Android dependencies, so it is fully unit-testable on any JVM.
//
// Bytecode is pinned to Java 17 because this module is consumed by the Android
// `:app` module. Deliberately not using a Gradle toolchain so the module builds
// with whatever JDK 17+ is already installed, without downloading one.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    testImplementation(libs.junit)
}

tasks.withType<Test>().configureEach {
    useJUnit()
    testLogging {
        events("passed", "failed", "skipped")
    }
}

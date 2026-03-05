# YChatClaw Agent ProGuard Rules
-keep class com.ychatclaw.agent.** { *; }
-keep class com.ychatclaw.agent.WebViewActivity$WebAutomationBridge { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

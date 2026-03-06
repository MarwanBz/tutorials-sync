# Expo OTA Force Update -- Blocking the App Until Users Upgrade

> Implement a force update mechanism in Expo apps that blocks users on outdated binaries with an undismissable modal, using OTA updates to enforce version gates.

---
Type: post
Date: 2026-03-01
Reading time: 21 min read
---

# Expo OTA Force Update -- Blocking the App Until Users Upgrade

> **Target Audience:** Intermediate React Native / Expo developers who already have OTA updates working and want to implement a version gate that forces users onto a new binary when native changes land.

## The Problem

You ship your Expo app as an APK (sideloaded, no Play Store). Users install it once and get JS updates via `eas update`. Life is good -- until you make a **native change** (new permission, new native module, SDK upgrade). Now the old binary is incompatible with your new JS bundle. Users are stuck on the old APK and don't know they need to update.

You need a way to **remotely block the app** and force users to download the new binary.

This tutorial walks through the exact pattern for the basma-mobile project (`/home/marwan/basma-app/basma-mobile`).

---

## Part 1: The Mental Model -- OTA vs Binary

### Two Separate Things Live on the User's Device

```
Binary (APK/IPA)                    OTA Bundle (JS)
+---------------------------+       +---------------------------+
| Native code               |       | React components          |
| Native modules            |       | Business logic            |
| Permissions               |       | Assets (images, fonts)    |
| expo-updates runtime      |       | API calls, configs        |
| version: "1.0.0" (frozen) |       | Delivered via eas update  |
+---------------------------+       +---------------------------+
      Built once with EAS              Pushed anytime via OTA
```

| Concept | What It Is | Can OTA Change It? |
|---------|------------|-------------------|
| `version` in `app.json` | The binary version baked into the APK at build time | **No** -- frozen forever in that binary |
| `runtimeVersion` | Compatibility key that links a binary to its compatible OTA bundles | **No** -- also baked into the binary |
| JS bundle | Your React Native code and assets | **Yes** -- this is what OTA updates |

### The Key Insight

OTA can **read** the binary version but **cannot change it**. This asymmetry is the lever. You push an OTA update that reads the installed binary version, compares it to a minimum threshold, and if the binary is too old -- blocks the entire app with an undismissable modal.

```
Timeline:
1. User installs binary v1.0.0
2. You push OTA updates, user gets them automatically (v1.0.0 binary is fine)
3. You make a native change -- now you need binary v2.0.0
4. You push an OTA update with: minVersion = "2.0.0"
5. OTA lands on the user's v1.0.0 binary
6. Hook reads Constants.expoConfig.version -> "1.0.0"
7. "1.0.0" < "2.0.0" -> BLOCKED. Modal appears. Download new APK.
8. User installs v2.0.0 binary -> gate clears -> app works
```

### Why `runtimeVersion` Matters Here

In `/home/marwan/basma-app/basma-mobile/app.json`:

```json
{
  "expo": {
    "version": "1.0.0",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://u.expo.dev/ffd8165b-b7a1-4fcd-9c81-eecae8e0434a"
    }
  }
}
```

`runtimeVersion` tells `expo-updates`: "only apply OTA bundles built for this runtime." If you change `runtimeVersion` to `"2.0.0"` in a new binary, old v1.0.0 binaries will **ignore** OTA bundles built for runtime `"2.0.0"`. This is a safety net -- but the force update modal is the **user-facing** enforcement layer. Without it, users on old binaries just silently stop receiving updates and never know why.

---

## Part 2: The Version Gate Logic

### Reading the Binary Version

```typescript
import Constants from "expo-constants";

// This returns the `version` field from app.json, baked into the binary
const installedVersion = Constants.expoConfig?.version;
// On a v1.0.0 binary: "1.0.0"
// On a v2.0.0 binary: "2.0.0"
// This NEVER changes via OTA -- it's frozen at build time
```

**Why `Constants.expoConfig?.version`?** This reads the config that was compiled into the native binary. Even if you push an OTA update that changes `app.json`, `Constants.expoConfig?.version` still returns the **original binary's** value. That's exactly what you want -- you're checking the installed binary, not the OTA bundle.

### The Semver Comparison Function

Create the hook at `/home/marwan/basma-app/basma-mobile/hooks/useForceUpdate.ts`:

```typescript
import { useState, useEffect } from "react";
import Constants from "expo-constants";

/**
 * Compares two semver strings: returns true if `installed` < `minimum`.
 *
 * Why roll our own instead of using a library?
 * - It's 8 lines of code vs pulling in `semver` (40KB)
 * - We only need less-than comparison, not the full semver spec
 * - No pre-release tags to worry about in our versioning
 */
function isVersionLessThan(installed: string, minimum: string): boolean {
  const installedParts = installed.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const a = installedParts[i] || 0;
    const b = minimumParts[i] || 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false; // equal versions -> no update needed
}

// --- Configuration ---
// Change these values when you need to force an update:
const FORCE_UPDATE_CONFIG = {
  minVersion: "1.0.0",  // Bump this to force users off older binaries
  downloadUrl: "https://your-domain.com/basma-latest.apk",
};

export function useForceUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    const installedVersion = Constants.expoConfig?.version;

    if (!installedVersion) {
      // Development builds or Expo Go -- skip the check
      return;
    }

    const needsUpdate = isVersionLessThan(
      installedVersion,
      FORCE_UPDATE_CONFIG.minVersion
    );
    setUpdateRequired(needsUpdate);
  }, []);

  return {
    updateRequired,
    downloadUrl: FORCE_UPDATE_CONFIG.downloadUrl,
    installedVersion: Constants.expoConfig?.version ?? "unknown",
    minVersion: FORCE_UPDATE_CONFIG.minVersion,
  };
}
```

### Walk Through the Logic

```
isVersionLessThan("1.0.0", "2.0.0")
  i=0: a=1, b=2 -> 1 < 2 -> return true   // UPDATE REQUIRED

isVersionLessThan("2.0.0", "2.0.0")
  i=0: a=2, b=2 -> continue
  i=1: a=0, b=0 -> continue
  i=2: a=0, b=0 -> continue
  return false                              // No update needed

isVersionLessThan("2.1.0", "2.0.0")
  i=0: a=2, b=2 -> continue
  i=1: a=1, b=0 -> 1 > 0 -> return false   // No update needed (newer)
```

### Why `useState` + `useEffect` Instead of Just a Constant?

You might think: "why not just compute this inline?" Two reasons:

1. **Rules of Hooks compliance** -- the hook always runs, always returns the same shape. No conditional logic that could violate hook ordering.
2. **Future extensibility** -- you might later fetch `minVersion` from a remote config API instead of hardcoding it. The `useEffect` pattern is ready for that async fetch.

---

## Part 3: The Undismissable Modal

### Why NOT React Native's `<Modal>`?

| Aspect | `<Modal>` | `<View>` with `absoluteFillObject` |
|--------|-----------|-----------------------------------|
| Android back button | **Dismisses it** by default | **No effect** -- just a View |
| `onRequestClose` | Required on Android, can be bypassed | Not applicable |
| Gesture dismiss | Can be swiped away | Cannot be dismissed |
| Overlay behavior | Creates new native window | Lives in the React tree |
| Force-update safe? | **No** -- user can escape | **Yes** -- inescapable |

The entire point of a force-update screen is that the user **cannot dismiss it**. On Android, `<Modal>` fires `onRequestClose` when the user hits the hardware back button. If you set it to a no-op, some Android versions still dismiss it. Using a `<View>` that covers the entire screen sidesteps this problem entirely.

### The ForceUpdateModal Component

Create at `/home/marwan/basma-app/basma-mobile/components/ForceUpdateModal.tsx`:

```typescript
import { View, Text, StyleSheet, Linking, Pressable } from "react-native";

interface ForceUpdateModalProps {
  downloadUrl: string;
  installedVersion: string;
  minVersion: string;
}

export function ForceUpdateModal({
  downloadUrl,
  installedVersion,
  minVersion,
}: ForceUpdateModalProps) {
  const handleDownload = () => {
    Linking.openURL(downloadUrl);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>تحديث مطلوب</Text>
        <Text style={styles.subtitle}>Update Required</Text>

        <Text style={styles.message}>
          يجب تحديث التطبيق للاستمرار في الاستخدام.
        </Text>
        <Text style={styles.messageEn}>
          A new version of the app is required to continue.
        </Text>

        <Text style={styles.versionInfo}>
          Installed: v{installedVersion} | Required: v{minVersion}
        </Text>

        <Pressable style={styles.button} onPress={handleDownload}>
          <Text style={styles.buttonText}>تحميل التحديث / Download Update</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,  // <-- THIS is the key
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 24,
    alignItems: "center",
    width: "85%",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0ea5e9",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 24,
  },
  messageEn: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  versionInfo: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 24,
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

### Dissecting `StyleSheet.absoluteFillObject`

```typescript
StyleSheet.absoluteFillObject
// Equivalent to:
{
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
}
```

This makes the `View` cover the **entire screen**, sitting on top of everything else in the component tree. Combined with `zIndex: 9999`, nothing renders above it. The user sees only the update card. No navigation, no back button escape, no gesture to dismiss. The only action available is the download button.

### Why `Linking.openURL` for the APK?

Since basma-mobile distributes APKs directly (no Play Store), the download URL points to wherever you host the APK file. `Linking.openURL` hands off to the system browser, which downloads the APK and triggers Android's install flow. This works for:

- Direct APK download links
- Firebase App Distribution links
- Any URL that serves an `.apk` file

---

## Part 4: Wiring in _layout.tsx

### The Gotcha: Rules of Hooks

React hooks must be called in the **same order** on every render. You cannot call a hook after an early `return`. This is the most common mistake when adding `useForceUpdate` to a layout.

### Where to Place the Hook

Looking at `/home/marwan/basma-app/basma-mobile/app/_layout.tsx`, the `RootLayoutNav` function currently looks like:

```typescript
function RootLayoutNav() {
  const { isAuthenticated, isLoading, role } = useAuth();
  usePushNotifications();

  if (isLoading) {
    return ( /* loading spinner */ );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* ... screens */}
    </Stack>
  );
}
```

### The WRONG Way (Rules of Hooks Violation)

```typescript
function RootLayoutNav() {
  const { isAuthenticated, isLoading, role } = useAuth();
  usePushNotifications();

  if (isLoading) {
    return ( /* loading spinner */ );
  }

  // BUG: useForceUpdate is called AFTER an early return
  // If isLoading is true, this hook is SKIPPED
  // React sees different number of hooks between renders -> CRASH
  const { updateRequired, downloadUrl } = useForceUpdate();

  // ...
}
```

This will produce the dreaded error:
```
Error: Rendered more hooks than during the previous render.
```

### The RIGHT Way

```typescript
// In /home/marwan/basma-app/basma-mobile/app/_layout.tsx

import { ForceUpdateModal } from "@/components/ForceUpdateModal";
import { useForceUpdate } from "@/hooks/useForceUpdate";

function RootLayoutNav() {
  const { isAuthenticated, isLoading, role } = useAuth();
  usePushNotifications();
  // ALL hooks called BEFORE any early returns
  const { updateRequired, downloadUrl, installedVersion, minVersion } =
    useForceUpdate();

  if (isLoading) {
    return ( /* loading spinner */ );
  }

  // Force update check -- blocks the entire app
  if (updateRequired) {
    return (
      <ForceUpdateModal
        downloadUrl={downloadUrl}
        installedVersion={installedVersion}
        minVersion={minVersion}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(guest)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}
```

### Why This Placement Matters

```
Component Tree:

RootLayout
  GestureHandlerRootView
    KeyboardProvider
      GluestackUIProvider
        QueryProvider          <-- useForceUpdate needs to be INSIDE providers
          AuthProvider              (in case you later fetch minVersion from API)
            ThemeProvider
              RootLayoutNav    <-- Hook lives HERE
                Stack / ForceUpdateModal
```

The hook is called inside `RootLayoutNav`, which lives inside all providers. This means:
1. If you later fetch `minVersion` from your API, React Query is available
2. Auth context is available (you could log which users are blocked)
3. The modal replaces the **entire navigation stack** -- there's no screen behind it to navigate to

### The Before/After Diff

```diff
 function RootLayoutNav() {
   const { isAuthenticated, isLoading, role } = useAuth();
   usePushNotifications();
+  const { updateRequired, downloadUrl, installedVersion, minVersion } =
+    useForceUpdate();

   if (isLoading) {
     return (
       <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
         <ActivityIndicator size="large" color="#0ea5e9" />
       </View>
     );
   }

+  if (updateRequired) {
+    return (
+      <ForceUpdateModal
+        downloadUrl={downloadUrl}
+        installedVersion={installedVersion}
+        minVersion={minVersion}
+      />
+    );
+  }
+
   return (
     <Stack screenOptions={{ headerShown: false }}>
```

---

## Part 5: The Deployment Sequence

This is the full lifecycle. Get this wrong and you either lock out everyone or lock out nobody.

### Scenario: You Added a New Native Module

```
Step 1: Build the new binary
$ eas build -p android --profile production
# This builds an APK with version "2.0.0" and runtimeVersion "2.0.0"
# (You already bumped both in app.json before building)

Step 2: Distribute the new APK
# Upload to your hosting, Firebase App Distribution, etc.
# Update the downloadUrl in useForceUpdate.ts to point to this new APK

Step 3: Push the OTA gate to the OLD binary's branch
$ eas update --branch production --message "Force update: require v2.0.0"
# This pushes your JS bundle (with minVersion: "2.0.0" in the hook)
# to the production branch that v1.0.0 binaries are listening on
#
# Result: Users on v1.0.0 get this OTA -> hook fires -> BLOCKED

Step 4: Users download and install v2.0.0 APK
# The new binary has version "2.0.0"
# Hook checks: isVersionLessThan("2.0.0", "2.0.0") -> false
# Modal does NOT appear -> app works normally

Step 5: Push OTA updates to the new binary going forward
$ eas update --branch production --message "New feature: ..."
# Now your OTA updates target runtimeVersion "2.0.0"
# Only v2.0.0 binaries receive them
```

### The Two Critical Commands

| Command | When | What It Does |
|---------|------|-------------|
| `eas update --branch production --message "Force update: require v2.0.0"` | After new binary is hosted | Pushes the version gate to old binaries |
| `eas update --branch production --message "Clear force update gate"` | After users have migrated (optional) | Can lower `minVersion` back if needed |

### The Timing Diagram

```
Day 1:  Binary v1.0.0 in the wild, OTA updates flowing normally
        minVersion = "1.0.0" -> no blocking

Day 15: You add a native module. Build binary v2.0.0.
        Upload APK to hosting.
        Update downloadUrl in hook.
        Update minVersion to "2.0.0" in hook.

Day 15: Push OTA with the gate:
        $ eas update --branch production --message "Force update: require v2.0.0"

Day 15: Users open the app:
        - v1.0.0 binary gets OTA -> sees minVersion "2.0.0" -> BLOCKED
        - They download v2.0.0 -> install -> gate clears
        - v2.0.0 binary -> "2.0.0" >= "2.0.0" -> app works

Day 16+: Normal OTA updates to production branch
         Only v2.0.0 binaries receive them (runtimeVersion match)
```

---

## Part 6: Anti-Patterns

### 1. Calling `useForceUpdate()` AFTER an Early Return

```typescript
// WRONG -- will crash with "Rendered more hooks than during previous render"
function RootLayoutNav() {
  const { isLoading } = useAuth();

  if (isLoading) return <Loading />;  // <-- early return

  const { updateRequired } = useForceUpdate();  // NEVER REACHED when isLoading
  // ...
}
```

**Why it breaks:** React tracks hooks by call order. On render 1, `isLoading` is true, so only `useAuth` runs (1 hook). On render 2, `isLoading` is false, so `useAuth` AND `useForceUpdate` run (2 hooks). React panics because the count changed.

**Fix:** Always call all hooks at the top, before any conditional returns.

### 2. Using `<Modal>` Instead of `<View>`

```typescript
// WRONG -- user can dismiss on Android
<Modal visible={updateRequired} onRequestClose={() => {}}>
  <UpdateCard />
</Modal>
```

**Why it breaks:** On Android, the hardware back button fires `onRequestClose`. Even with a no-op handler, some Android versions and OEM skins will dismiss the modal anyway. The user escapes your gate and uses the app with an incompatible binary.

**Fix:** Use `<View style={StyleSheet.absoluteFillObject}>` -- it's just a View, there's nothing to dismiss.

### 3. Using `Updates.manifest.version` Instead of `Constants.expoConfig.version`

```typescript
// WRONG -- this reads the OTA manifest version, not the binary version
import * as Updates from "expo-updates";
const version = Updates.manifest?.version;  // This changes with OTA!

// RIGHT -- this reads the binary version frozen at build time
import Constants from "expo-constants";
const version = Constants.expoConfig?.version;  // Frozen in binary
```

**Why it matters:** The whole pattern depends on reading the **immutable binary version**. `Updates.manifest` reflects the latest OTA update, which is the thing you're pushing. If you read from it, you'd be comparing the OTA version against itself -- the gate would never trigger.

### 4. Forgetting to Update `downloadUrl` Before Shipping

```typescript
const FORCE_UPDATE_CONFIG = {
  minVersion: "2.0.0",
  downloadUrl: "https://your-domain.com/basma-latest.apk",  // PLACEHOLDER!
};
```

**What happens:** You push the OTA gate, users see the modal, tap "Download Update"... and get a 404 or a broken link. Now they're locked out of the app with no way to update.

**Fix:** Before pushing the OTA gate, verify:
1. The new APK is uploaded and the URL is live
2. The URL in `FORCE_UPDATE_CONFIG.downloadUrl` points to the **real** APK
3. Test the URL in a browser first

---

## Part 7: Quick Reference

| Action | What to Do |
|--------|-----------|
| **Initial setup** | Create `hooks/useForceUpdate.ts` and `components/ForceUpdateModal.tsx` |
| **Wire it up** | Call `useForceUpdate()` in `RootLayoutNav` BEFORE any early returns |
| **Normal OTA update** | `eas update --branch production --message "description"` |
| **Force update gate** | 1. Build new binary with bumped `version` and `runtimeVersion` in `app.json` |
| | 2. Upload APK, update `downloadUrl` in hook |
| | 3. Set `minVersion` to new version in hook |
| | 4. `eas update --branch production --message "Force update: require vX.Y.Z"` |
| **Verify gate works** | Install old APK on test device, let OTA land, confirm modal appears |
| **Check binary version** | `Constants.expoConfig?.version` (NOT `Updates.manifest`) |
| **Clear the gate** | Set `minVersion` back to current version, push OTA |

### Files Involved

| File | Purpose |
|------|---------|
| `/home/marwan/basma-app/basma-mobile/app.json` | `version` and `runtimeVersion` -- bump both for new binary |
| `/home/marwan/basma-app/basma-mobile/eas.json` | Build profiles with `channel: "production"` |
| `/home/marwan/basma-app/basma-mobile/hooks/useForceUpdate.ts` | Version comparison logic and config |
| `/home/marwan/basma-app/basma-mobile/components/ForceUpdateModal.tsx` | The undismissable blocking UI |
| `/home/marwan/basma-app/basma-mobile/app/_layout.tsx` | Where the hook is called and modal is rendered |

### Mental Model Cheat Sheet

```
OTA Update = changing the paint and furniture inside a house
Binary Update = rebuilding the foundation and walls

Force Update = a sign on the door that says:
  "This house's foundation is too old. Move to the new house."
  The sign is delivered via OTA (paint), but checks the foundation (binary).
```

---

## Further Reading

- [Expo Updates documentation](https://docs.expo.dev/versions/latest/sdk/updates/) -- official API reference
- [Expo Constants documentation](https://docs.expo.dev/versions/latest/sdk/constants/) -- `Constants.expoConfig` details
- [EAS Update guide](https://docs.expo.dev/eas-update/introduction/) -- managing update branches and channels
- [Runtime version policies](https://docs.expo.dev/eas-update/runtime-versions/) -- how `runtimeVersion` controls compatibility
- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) -- why hook call order matters
- `/home/marwan/basma-app/basma-mobile/docs/expo-updates-guide.md` -- your existing OTA setup reference


## Further Reading & Expert Context

### How `expo-updates` Actually Works Under the Hood

When your app launches, `expo-updates` checks for a new update bundle from the Expo updates server (or your custom server). The key concept is **runtimeVersion** -- this is NOT a semver version number, it is a **compatibility key**. The updates server will only serve an update to a client if the update's `runtimeVersion` matches the client's `runtimeVersion`. This prevents your app from loading a JS bundle that references native modules that do not exist in the binary.

Expo provides three built-in `runtimeVersion` policies:

- **`appVersion`** -- Sets `runtimeVersion` equal to the `version` field in `app.json` (e.g., `"1.0.0"`). This is what basma-mobile uses (hardcoded as `"runtimeVersion": "1.0.0"`). Simple and predictable: every time you bump `version` in `app.json`, you create a new runtime family. OTA updates only reach devices running the same `version`.
- **`nativeVersion`** -- Combines `version` with platform-specific build numbers (e.g., `"1.0.0(1)"`). Useful when you push multiple builds of the same version to TestFlight or internal testing tracks.
- **`fingerprint`** -- Automatically hashes your project's native dependencies, config plugins, and native code to generate a unique runtime version. This is the most robust policy because it catches native changes you might forget to bump manually, but it also means you need a new native build more often.

For the force-update pattern in this tutorial, the `runtimeVersion` matters because `checkForUpdateAsync()` will only find updates that match the current runtime. If you publish an update that requires a new native binary (new SDK version, new native module), you need a **store update**, not an OTA update -- and that is exactly when the force-update modal becomes critical.

### The Update Lifecycle: What Happens When

The `expo-updates` library provides three core async methods that form the update lifecycle:

1. **`Updates.checkForUpdateAsync()`** -- Makes a network request to the updates server to check if a new compatible update exists. Returns `{ isAvailable: boolean, manifest?: object }`. This is a lightweight check -- it downloads only the manifest, not the bundle.
2. **`Updates.fetchUpdateAsync()`** -- Downloads the actual JS bundle and assets. This is the expensive operation. The update is downloaded to disk but NOT applied yet.
3. **`Updates.reloadAsync()`** -- Restarts the app process and loads the newly downloaded bundle. This is the only way to apply a downloaded update without the user manually killing and restarting the app.

By default (`checkAutomatically: "ON_LAUNCH"`), expo-updates checks for updates automatically when the app launches and downloads them in the background. The downloaded update is applied on the **next** launch. For force-update scenarios, you want to call these methods manually and use `reloadAsync()` to apply the update immediately.

The `useUpdates()` hook provides a reactive way to monitor this lifecycle from a React component, exposing `currentlyRunning`, `isUpdateAvailable`, and `isUpdatePending` properties.

### Remote Config Alternative: Firebase Remote Config

The hardcoded `minVersion` approach in this tutorial is simple and works well for small teams. But it has a drawback: changing the minimum version requires publishing a new OTA update. For production apps at scale, a **remote config** approach decouples the version gate from your code deployments.

Here is the Firebase Remote Config pattern:

```typescript
// Instead of hardcoding minVersion in your app code:
// const MIN_SUPPORTED_VERSION = "1.2.0";

// You fetch it from Firebase Remote Config:
import remoteConfig from "@react-native-firebase/remote-config";

async function getMinSupportedVersion(): Promise<string> {
  await remoteConfig().setDefaults({
    min_supported_version: "1.0.0", // fallback if fetch fails
  });

  // Fetch with a short cache (e.g., 5 minutes in production)
  await remoteConfig().fetchAndActivate();

  return remoteConfig().getValue("min_supported_version").asString();
}

// Then in your force-update check:
async function shouldForceUpdate(currentVersion: string): Promise<boolean> {
  const minVersion = await getMinSupportedVersion();
  return compareVersions(currentVersion, minVersion) < 0;
}
```

**Tradeoffs:**

| Approach | Pros | Cons |
|----------|------|------|
| Hardcoded `minVersion` | Zero dependencies, works offline after first load, simple to reason about | Requires OTA push to change threshold |
| Firebase Remote Config | Change threshold instantly without any deploy, A/B test rollouts | Adds Firebase dependency, requires network call, needs fallback for offline |
| Custom backend endpoint | Full control, can target specific users/regions | You build and maintain it, same network/offline concerns |

For basma-mobile's current scale, the hardcoded approach is the right call. When you have thousands of users and need to gate specific versions urgently (e.g., a critical security fix), migrate to remote config.

### Android `BackHandler` Behavior

On Android, the hardware back button is a system-level event. When you present a blocking modal using `View` with `StyleSheet.absoluteFillObject`, the modal covers the entire screen visually -- but the hardware back button still fires. In React Native, if no `BackHandler` listener intercepts the event, the default behavior is to **exit the app** (not dismiss the modal).

For a force-update gate, this is actually acceptable behavior: the user either updates or leaves the app. There is no "dismiss and continue" path. If you want to be explicit about it, you can add a `BackHandler` listener that returns `true` (consuming the event) to prevent even the app exit:

```typescript
import { BackHandler } from "react-native";
import { useEffect } from "react";

// Inside your force-update modal component:
useEffect(() => {
  const handler = BackHandler.addEventListener("hardwareBackPress", () => {
    // Return true to prevent default back behavior (app exit)
    // User MUST tap the update button -- no escape
    return true;
  });

  return () => handler.remove();
}, []);
```

Whether to trap the back button or allow app exit is a UX decision. Both are valid for a force-update gate.

### Official Documentation Links

- [expo-updates API Reference](https://docs.expo.dev/versions/latest/sdk/updates/) -- Full API docs for `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync`, and `useUpdates()`
- [Runtime Version Policies](https://docs.expo.dev/eas-update/runtime-versions/) -- Deep dive on `appVersion`, `nativeVersion`, and `fingerprint` policies
- [How EAS Update Downloads Work](https://docs.expo.dev/eas-update/download-updates/) -- Explains the update lifecycle, caching, and when bundles are downloaded
- [EAS Update Deployment Patterns](https://docs.expo.dev/eas-update/deployment/) -- Production deployment strategies and branching patterns
- [React Native BackHandler](https://reactnative.dev/docs/backhandler) -- Android hardware back button handling
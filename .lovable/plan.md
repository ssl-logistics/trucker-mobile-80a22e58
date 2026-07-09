## Problem
After Apple ID sign-in (first time), tapping any bottom nav (Chat / Bidding / Settings / Dashboard) yanks the user back to the home page. Only fully killing and reopening the app clears the loop.

## Root cause
`src/hooks/useDeepLinkHandler.ts` re-processes the Apple auth deep link every time the app comes to the foreground:

1. `App.addListener("appStateChange", …)` calls `checkLaunchUrl()` on every foreground event.
2. On iOS, `App.getLaunchUrl()` keeps returning the original `thetroob://apple-auth-callback?access_token=…&refresh_token=…` URL until the app process is killed.
3. Even a very brief backgrounding (which happens when a native tab/route transition briefly loses focus, or when Capacitor's WebView refocuses) fires `appStateChange`, so the callback handler runs again.
4. Inside the callback branch, every path ends with `navigate("/home", { replace: true })` on success and `navigate("/", { replace: true })` on failure. Since the tokens have already been consumed, the second run of `supabase.auth.setSession(...)` fails and hits the error branch, or the success branch fires again — either way the router is force-pushed away from whatever page the user just tapped.
5. `lastHandledUrl` inside the effect closure is meant to dedupe, but it does NOT survive across the retry paths inside `handleDeepLink` (the guard lives in `handleUrlOnce`, and `appUrlOpen` uses `handleDeepLink` directly). It also does not persist across effect re-runs.

This exactly matches the reported symptoms: bounces to "หน้าแรก", and only a hard app-kill clears it (because that finally drops iOS's cached launch URL).

## Fix
Make the Apple auth callback single-shot per install/session and stop force-navigating when there is nothing to do.

Edits, all in `src/hooks/useDeepLinkHandler.ts`:

1. Add a persistent guard for the callback URL:
   - When the `apple-auth-callback` branch is entered, compute a stable key from the URL (or just the path + first N chars of the access token) and check `sessionStorage.getItem("apple_auth_handled")`.
   - If already set, short-circuit: close the in-app browser if open, do NOT call `setSession` again, and do NOT call `navigate(...)`. Just `return`.
   - On successful handling, write the marker to `sessionStorage` AND set an in-memory ref so we don't depend only on storage.

2. Harden `lastHandledUrl`:
   - Promote it from a closure-local `let` to a `useRef` so it survives effect re-runs.
   - Apply the dedupe inside `handleDeepLink` itself (not only in `handleUrlOnce`) so the `appUrlOpen` listener also benefits.

3. Stop unconditional redirects on the re-entry path:
   - In the success branch, only `navigate("/home", { replace: true })` when the current `location.pathname` is `/` or `/auth/...`. If the user is already inside the app, just persist auth + toast and stay put.
   - In the error branch of `apple-auth-callback`, do not `navigate("/")` if the app already has a valid stored `auth_driver` (check `getAuthItem("auth_driver")` before redirecting). This prevents a stale token error from logging the user out of a working session.

4. Same treatment for the `code` sub-branch (lines ~343–416) since it has the same navigate pattern.

No other files need to change. `AuthContext`, `ProtectedRoute`, `StartPage`, `SignIn`, and `BottomNavigation` all behave correctly once the deep-link handler stops replaying the callback.

## Verification
- Manual: sign in with Apple, tap Chat/Settings/Dashboard/Bidding immediately after — should stay on the tapped screen. Background/foreground the app several times — should stay on the tapped screen.
- Check console: `[DeepLink] 🍎 Apple auth callback detected` must appear at most once per install session; subsequent foregrounds should log a "skipped, already handled" line.
- Ensure normal LINE flow is untouched (guard is scoped to `apple-auth-callback` path only).

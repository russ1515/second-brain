# Native RTL status (Expo SDK 52)

`RTL_NATIVE_NOT_VERIFIED`

Arabic (`ar`) and Hebrew (`he`) are marked RTL in the shared registry. The Web
root receives `dir="rtl"`, and the existing native navigation shell reads the
same metadata to mirror its edge, arrows and drawer placement.

Full native Yoga/navigation mirroring after an in-app language change is not
claimed for this Expo SDK 52 / React Native 0.76 build. React Native documents
that `I18nManager.allowRTL` and `I18nManager.forceRTL` only take full effect on
the next application start, and recommends against `forceRTL` in production.
Expo's documented runtime router `LocaleProvider` applies to newer SDKs and is
not exported by the installed Expo Router 4 package.

For that reason this codebase deliberately does **not** call `forceRTL`,
`allowRTL`, or `Updates.reloadAsync` when the learner changes locale. Doing so
would either leave the current view partly mirrored or force a disruptive app
reload. Native Arabic and Hebrew need device validation after a supported
router/runtime-direction upgrade; until then, only the explicitly directional
components are covered.

References:

- https://reactnative.dev/docs/i18nmanager
- https://docs.expo.dev/guides/localization/#rtl-support

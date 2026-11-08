# Spotlight for macOS

The Spotlight web app in its own window. It shows new inbox items as Mac
notifications, puts the number of unread items on the Dock icon, and opens
`spotlight://open/w/…` links.

## Develop

```bash
npm ci --ignore-scripts
npm start
```

`npm start` opens `https://app.usespotlight.ai`. To open another Spotlight,
select **Spotlight → Spotlight Address…**.

`npm run pack` builds an unsigned app in `release/mac-arm64` with an ad-hoc
signature, so that it starts on Apple silicon.

## Icon

`build/Spotlight.icon` is an Icon Composer document with a light and a dark
appearance. Open it in Icon Composer, which comes with Xcode 26. Building the
app needs Xcode 26, because `actool` compiles the icon.

## Release

The `desktop` job in `.github/workflows/release.yml` builds a universal app,
signs and notarizes it, and uploads the `.dmg`, the `.zip` and `latest-mac.yml`
to the release. The installed app updates itself from the latest release.

It needs these repository secrets:

| Secret | Value |
| --- | --- |
| `MAC_CERTIFICATE_P12_BASE64` | The Developer ID Application certificate and key, as a base64 `.p12`. |
| `MAC_CERTIFICATE_PASSWORD` | The password of the `.p12`. |
| `APPLE_API_KEY_P8` | The App Store Connect API key, the text of the `.p8` file. |
| `APPLE_API_KEY_ID` | The ID of that key. |
| `APPLE_API_ISSUER` | The issuer ID of the App Store Connect team. |

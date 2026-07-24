# Jazagora website — GitHub upload

Homepage redesigned on 22 July 2026. SEO, favicon and image delivery optimized on 24 July 2026. Legal pages updated in English on 21 July 2026.

The public website is maintained exclusively in English. No separate Italian homepage is included.

## Main website files

- `index.html`
- `assets/site.css`
- `assets/site.js`
- `assets/jazagora-universe-hero.webp`
- `assets/jazagora-universe-hero-mobile.webp`
- `assets/jazagora-app.webp`
- `assets/in-tune-app.webp`
- `assets/jazagora-universe-hero.png`
- `assets/jazagora-app.png`
- `assets/jazagora-app-light.png`
- `assets/in-tune-app.png`
- `favicon.svg`
- `favicon-48x48.png`
- `favicon-96x96.png`
- `favicon-192x192.png`
- `favicon-512x512.png`
- `apple-touch-icon.png`

## Legal page files

- `assets/legal.css`
- `assets/jazagora-orbit.webp`
- `assets/jazagora-orbit.png`
- `privacy-policy/index.html`
- `terms/index.html`
- `delete-account/index.html`
- `sources/index.html`

Copy the complete extracted contents into the root of the `jazagora-site` repository while preserving the directory structure. `index.html` must remain in the repository root. The resulting URLs will be:

- `https://jazagora.com/`
- `https://jazagora.com/privacy-policy/`
- `https://jazagora.com/terms/`
- `https://jazagora.com/delete-account/`
- `https://jazagora.com/sources/`

The Sources & Attribution page is linked from Privacy Policy and Terms only. No new link is required inside the Jazagora app.

The Google Play controls on the homepage currently display a clear “coming soon” message. Replace their behavior with the final Play Store URLs only when each listing is publicly available.

The PNG originals remain in the repository for social previews and compatibility. The live page loads the smaller WebP assets, including a dedicated mobile hero image.

Suggested commit message:

`Optimize Jazagora website images and favicon`

## Important implementation alignment

Before publishing the final deletion statement, confirm that in-app account deletion removes venue reviews stored at `clubs/{clubId}/reviews/{uid}` as well as favourites and the Firebase Authentication user. The current app deletion routine searches legacy top-level `reviews` and `comments` collections, while current venue reviews are stored inside each club document.

## Optional communications implementation

The legal text assumes the future communications control is:

- off by default;
- separate from acceptance of Terms and Privacy Policy;
- optional for registration and use;
- reversible at any time from Profile settings;
- accompanied by an unsubscribe method in promotional emails.

Recommended Firestore fields:

```text
marketingConsent: true | false
marketingConsentUpdatedAt: server timestamp
marketingConsentPolicyVersion: "2026-07-21"
```

Do not send promotional emails until the user has actively enabled the setting.

## Review note

These pages are a carefully prepared operational draft based on the app's current implementation and supplied business details. They are not a substitute for review by a qualified lawyer, particularly before commercial partnerships, paid offers or large-scale email marketing begin.

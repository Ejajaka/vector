# Microsoft Edge Add-ons submission

Everything here is ready. You just need to log in and click through Partner
Center. I cannot do that step - it needs your Microsoft account.

## Prerequisites (already done)
- Upload package: `dist/vector-extension.zip` (built by `npm run package`).
  It is a Chromium Manifest V3 extension, so it runs on Edge unchanged.
- Logo (300x300): `media/store-logo-300.png`.
- Listing text: `store/listing.md`.
- Privacy policy: `store/privacy-policy.md` (host it publicly first).
- Privacy/permission answers: `store/permissions-and-privacy.md`.

If you changed any code since packaging, re-run `npm run package`.

## Steps

1. **Developer account (free)**
   Go to https://partner.microsoft.com/dashboard/microsoftedge/public/login and
   register for the Microsoft Edge program. No fee.
   Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account

2. **Create the extension**
   Dashboard -> **Edge** workspace -> **Create new extension**.

3. **Upload**
   Drag `dist/vector-extension.zip` onto the upload page. Wait for "verified".

4. **Availability**
   Visibility: **Public** (or **Hidden** to share only by link for a demo).
   Markets: all, or your country.

5. **Properties**
   - Category: **Developer tools**
   - Website / support: optional (your GitHub or project page)

6. **Privacy** (paste from `store/permissions-and-privacy.md`)
   - Single purpose description
   - Permission justification for `storage`, `clipboardWrite`, and each host
   - Remote code: **No, I am not using remote code**
   - Data usage: leave all "collect" boxes unchecked (we collect nothing)
   - Privacy policy URL: paste the public URL of `store/privacy-policy.md`

7. **Store listing**
   - Extension logo: upload `media/store-logo-300.png`
   - Description: paste from `store/listing.md` (min 250 chars)
   - Screenshots: optional but recommended (640x480 or 1280x800) - see below
   - Search terms: `aws`, `terraform`, `cloud security`, `prompt`, `iam`,
     `encryption`, `s3`

8. **Submit**
   Add the certification notes below, then click **Publish**. Certification can
   take up to ~7 business days.

## Notes for certification (paste into the box)

```
Vector is an offline-first security linter for cloud infrastructure prompts.

- The rule engine runs entirely on the device. No account or network is required
  to use the core feature.
- The content script only runs on chatgpt.com, chat.openai.com, claude.ai and
  gemini.google.com. It adds a floating button and reads the text already typed
  in the chat composer ONLY after the user clicks the button. It does not read
  other page content or run automatically.
- The optional "Deep scan" is OFF by default. It first tries Chrome/Edge's
  built-in on-device model (no network). Only if the user enters their own API
  key in the Options page, and clicks Deep scan, is the prompt text sent to the
  endpoint they configured (default https://api.openai.com/v1).
- To test: click the toolbar icon, press "Sample", then "Analyze". Then click
  "Add clause" on a finding and see the improved prompt update.
- No remote code is used; all logic ships in the package.
```

## Missing asset I cannot create
**Screenshots** require a real browser (640x480 or 1280x800). Capture:
1. The popup showing a risk panel with missing controls.
2. The improved prompt after adding clauses.
3. The floating in-page panel on a supported AI site.

## After it is live
Your listing URL will look like:
`https://microsoftedge.microsoft.com/addons/detail/<id>`

Hand that link in for your submission.

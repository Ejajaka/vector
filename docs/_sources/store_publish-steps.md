# Publish to the Chrome Web Store - step by step

## 0. Build the upload file
```powershell
npm run package
```
This produces `dist/vector-extension.zip` (manifest.json at the zip root - the
store requires exactly that).

## 1. Register as a developer ($5 one-time)
1. Go to the [developer dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account you want to own the extension.
3. Accept the developer agreement and pay the one-time US$5 registration fee.
   (Docs: developer.chrome.com/docs/webstore/register)

## 2. Create the item
1. Dashboard -> **Add new item**.
2. Upload `dist/vector-extension.zip`.
3. Wait for it to process.

## 3. Fill the Store listing tab
Use `store/listing.md`:
- Name, short description (<=132 chars), detailed description, category
  (Developer Tools), language.

## 4. Upload images
- **Store icon**: already in `media/icon128.png` (the store also uses the
  manifest icons).
- **Screenshots**: 1-5 required, size 1280x800 or 640x400 (PNG/JPEG).
  I cannot generate these without a browser - capture the popup showing a risk
  panel, and the in-page panel on a chat site.

## 5. Privacy tab
Use `store/permissions-and-privacy.md`:
- Single purpose, permission justifications, remote-code = No, data-usage boxes.
- Host `store/privacy-policy.md` publicly and paste the URL.

## 6. Distribution tab
- Visibility: **Public** (or Unlisted for a private demo).
- Regions: all (or just your country).

## 7. Submit for review
- Click **Submit for review**.
- Review usually takes a few days. You'll get an email at the developer address.
- Common rejection causes for an extension like this: unclear single purpose,
  missing/weak privacy policy, or an unjustified host permission. The files here
  are written to cover those.

## 8. Testing without publishing
If you only need it for a demo or class submission, you do **not** need to
publish at all:
- `chrome://extensions` -> Developer mode -> **Load unpacked** -> pick the
  project folder. Free, instant, works offline.

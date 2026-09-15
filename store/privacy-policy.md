# Privacy Policy — Vector - Cloud Prompt Security

Last updated: (set the date before publishing)

Vector is a Chrome extension that analyses cloud infrastructure prompts for
missing security controls.

## What we collect

**Nothing.** The extension has no accounts, no analytics, no telemetry, and no
server of its own.

## Where your data goes

- **Rule-based analysis:** runs entirely in your browser. Your prompt is never
  sent anywhere.
- **Optional "Deep scan":**
  - If Chrome's built-in on-device model is available, the analysis also runs
    locally on your device. Nothing is transmitted.
  - If you choose to configure a third-party API key, and only when you click
    "Deep scan", the prompt text is transmitted to the API endpoint you
    configured, under that provider's terms and privacy policy. You control the
    key and the endpoint.

## What is stored locally

Settings (optional API key, base URL, model, policy JSON) and a short history of
your last analyses are stored using `chrome.storage.local` on your device. This
data never leaves your device and can be cleared by removing the extension.

## Permissions and why they are needed

- `storage`: save your settings and local history.
- `clipboardWrite`: copy the improved prompt when you click Copy.
- Host access to AI chat sites: read the prompt in the chat box only after you
  click the Vector button.
- `https://api.openai.com/*`: used only if you configure an API key for the
  optional deep scan.

## Children's privacy

The extension is a developer tool and is not directed at children.

## Contact

Replace with your name and email before publishing.

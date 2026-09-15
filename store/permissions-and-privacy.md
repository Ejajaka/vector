# Permissions & privacy justification

Paste these into the dashboard's "Privacy practices" tab.

## Single purpose (required field)

Vector analyses a natural-language AWS infrastructure prompt for missing security
controls before infrastructure code is generated.

## Justification for each permission

**storage**
Stores the user's settings (optional API key, model, policy rules) and a local
history of recent analyses on the device. No data leaves the device.

**clipboardWrite**
Used to copy the improved prompt when the user clicks "Copy".

**Host permissions (chatgpt.com, chat.openai.com, claude.ai, gemini.google.com)**
A content script adds a floating button and, only when the user clicks it, reads
the prompt already typed in the page's chat box to analyse it. The script does
not read any other page content and does not run automatically.

**Host permission (https://api.openai.com/\*)**
Used only for the optional AI deep scan, and only when the user has supplied
their own API key. No request is made otherwise.

## Remote code

The extension does **not** load or execute remote code. All logic ships in the
package. (`remote code` answer: No.)

## Data usage disclosures

- Does the item collect or use personal/sensitive user data? **No**, except:
- If the user enables the optional deep scan with their own API key, the prompt
  text they chose to analyse is transmitted to the API endpoint they configured.
- Data is not sold, not used for advertising, and not used for creditworthiness.
- Check all three certification boxes only after confirming the above is true for
  your build.

## Privacy policy URL

Host `store/privacy-policy.md` somewhere public (GitHub Pages, Gist, your site)
and paste the URL. A privacy policy is required because the extension handles
prompt text.

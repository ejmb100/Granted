# Tidepath Safe Form Filler

This Manifest V3 browser extension is a hackathon prototype for foundation portals that do not provide applicant-submission APIs.

## Safety contract

- It only stores a draft after Tidepath marks it approved for portal review.
- It matches text using question labels and nearby prompt text—not page coordinates.
- It fills only after the user presses **Fill approved answers**.
- It never checks attestations, uploads files, presses Save, or presses Submit.
- Unmatched questions and over-limit answers are reported in the in-page panel.

## Load in Chrome or Edge

1. Visit `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this `tidepath-form-filler` folder.
4. Open Tidepath, approve a draft, then open a supported portal.
5. In the Tidepath panel on the portal, choose **Fill approved answers** and review the result.

## Safari

Safari uses the same WebExtension model, but package conversion and signing are handled in Xcode. Convert this folder with `safari-web-extension-converter`, review the generated project, then enable the extension in Safari’s Extensions settings.

Before enabling a real portal, confirm that its terms allow assistive form filling. This prototype is intentionally not a submission integration.

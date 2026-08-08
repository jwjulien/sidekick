---
title: NFC Tag Management
status: Draft
target: 
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 014-deep-link-routing.md
---

# Feature: NFC Tag Management

## 1. Overview
This feature allows users to program physical NFC stickers with Sidekick deep links. When an Android device is held near a programmed sticker, the OS intercepts the NDEF payload and launches the app directly to the encoded location. To prevent accidental data loss, the system implements a "read-before-write" safeguard to warn users if they are about to overwrite an existing, valid Sidekick tag.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Write NFC Tag" button within the detail view of a specific Storage Location.
* **Interaction:** 1. The user clicks "Write NFC Tag" on a specific Drawer or Bin.
    2. A bottom-sheet modal slides up displaying a pulsing NFC icon and the text "Hold phone near NFC tag..."
    3. The user taps the phone to the tag.
    4. **Safety Check:** The app reads the tag. If it contains an existing `fuse://` URI, the UI pauses and displays a prominent warning: "This tag is already programmed to [Existing Location Name]. Overwrite?"
    5. If the tag is blank, or the user confirms the overwrite, the app writes the new `fuse://location/{id}` payload to the NDEF record.
    6. A success checkmark and beep confirm the operation.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Utilizes the `@tauri-apps/plugin-nfc` to access native mobile NFC hardware.
    * The write function must be chained: `scan()` -> `parse NDEF` -> `evaluate` -> `write()`.
    * Payloads must be formatted strictly as NDEF URI Records using the `fuse://` scheme.
* **Backend (FastAPI):** * `GET /api/resolve/{uuid}` (from Feature 013) may be utilized during the Safety Check phase to translate an existing UUID on a tag into a human-readable location name for the overwrite warning.

## 4. Out of Scope
* Desktop/Web NFC support. While USB NFC readers exist, this feature relies heavily on the native mobile OS NDEF background dispatch systems. Desktop support is excluded for this phase.
* Password-protecting or permanently locking the NFC tags against future rewrites.

---

## 5. Implementation Tasks
- [ ] Install and configure `tauri-plugin-nfc`.
- [ ] Build SolidJS bottom-sheet modal for the NFC writing UX.
- [ ] Implement the read-before-write safety logic.
- [ ] Implement the NDEF URI Record writing logic.
- [ ] Handle OS-level NFC permission requests gracefully.
---
title: NFC Tag Management
status: Completed
target: 
  - Android
  - Windows
dependencies: 
  - 010-inventory-storage.md
  - 014-deep-link-routing.md
---

# Feature: NFC Tag Management

## 1. Overview
This feature allows users to program physical NFC stickers with Sidekick deep links (`fuse://location/{id}` and `fuse://part/{id}`). When an Android device or desktop USB PC/SC reader (ACR122U) is held near a programmed sticker, the system reads the NDEF payload and launches or navigates the app directly to the encoded location or part detail view. 

In addition to direct navigation, NFC scanning integrates directly into modal workflows (such as part relocation) to quickly jump to target locations in Miller column selectors, and allows programming new NFC tags immediately upon creating a new storage location. To prevent accidental data loss, the system enforces a "read-before-write" safeguard to warn users before overwriting an active tag.

## 2. Architecture & Key Use Cases

### 2.1 Write NFC Tags (Locations & Parts)
* **Location Tags (`fuse://location/{id}`):** Any node in the Storage tree (Cabinet, Shelf, Drawer, Bin) can be written via a "Write NFC Tag" action button.
* **Part Tags (`fuse://part/{id}`):** The `PartDetails` page features a "Write NFC Tag" button to program tags for standalone part reels or anti-static bags.
* **Read-Before-Write Safeguard:** 
  1. App initiates an NDEF read scan.
  2. If the tag contains an existing `fuse://` payload or UUID, the app queries `GET /api/resolve/{payload}`.
  3. If resolved to an active entity in the database, the UI displays a warning: *"This tag is already programmed to [Resolved Name / Breadcrumb]. Overwrite?"*
  4. Upon user confirmation (or if tag is blank), the new NDEF URI record is written.

### 2.2 Recall & Deep Link Dispatch
* Background NFC scans trigger Android OS intent dispatch (`fuse://` scheme registered in Feature 014), launching/foregrounding Sidekick and navigating directly to `/storage?location={id}` or `/parts/{id}`.

### 2.3 Modal Workflows (Move & Location Onboarding)
* **In-Modal NFC Target Selection:** When `MovePartModal` or `LocationMoveModal` is open, scanning an NFC tag intercepts `fuse://location/{id}`, resolves the location, and automatically navigates the Miller columns to select that location.
* **Onboarding NFC Programming during Location Creation:** 
  - When creating a new storage location, `POST /api/locations` returns the created `id` (UUIDv7) immediately.
  - Upon successful creation, the modal presents a prompt: *"Location Created! Tap phone to NFC tag to program tag now."*
  - Writing the NDEF record assigns the physical tag immediately during location onboarding.

---

## 3. Technical Implementation
* **Tauri Rust Backend (`src-tauri`):**
  * **Desktop Target (Windows/Linux):** Integrates the [`pcsc`](https://crates.io/crates/pcsc) Rust crate to interface directly with PC/SC WinSCard / PCSC-lite APIs. This enables native hardware support for USB NFC readers (such as the **ACR122U**) on desktop workstations via APDU NDEF commands.
  * **Mobile Target (Android):** Utilizes `tauri-plugin-nfc` to bridge native Android `NfcAdapter` NDEF APIs.
  * **Unified Custom Commands:** Exposes unified Tauri commands (`nfc_read_tag`, `nfc_write_tag`) to the frontend, decoupling hardware specifics from the UI.
* **Frontend (SolidJS):**
  * `nfcService.ts`: Unified frontend service interfacing with Tauri's Rust NFC module, with fallback Desktop Dev Mock Mode.
  * `NfcWriteModal.tsx`: Reusable bottom-sheet modal for scanning, read-before-write safety evaluation, overwrite confirmation, and NDEF writing.
* **Backend (FastAPI):**
  * `GET /api/resolve/{payload}`: Universal entity resolver endpoint returning entity type (`location` | `part`), UUID, human-readable breadcrumbs, and target routes.

---

## 4. Implementation Tasks
- [x] Add `GET /api/resolve/{payload:path}` router in FastAPI backend with unit tests.
- [x] Add `pcsc` crate to Rust desktop target in `src-tauri/Cargo.toml` and configure `tauri-plugin-nfc` for mobile target.
- [x] Implement Rust NFC commands (`nfc_read_tag`, `nfc_write_tag`) using `pcsc` and `tauri-plugin-nfc`.
- [x] Create `nfcService.ts` with unified Tauri invoke calls and desktop dev mock mode.
- [x] Build SolidJS `NfcWriteModal.tsx` with read-before-write safeguard.
- [x] Add "Write NFC Tag" buttons to `Storage.tsx` location views and `PartDetails.tsx`.
- [x] Wire NFC scanner listener into `MovePartModal.tsx` for quick Miller column location jumping.
- [x] Wire immediate NFC programming prompt into Location Creation flow.
---
title: Part Documents
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
---

# Feature: Part Documents

## 1. Overview
This feature allows users to attach reference files (primarily PDF datasheets, manuals, or wiring diagrams) directly to a specific Part. By storing the file content natively as a BLOB within the SQLite database, Sidekick ensures that backups and data migrations are seamless, keeping the database as a single source of truth without relying on external file system directories.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Documents" or "Datasheets" tab within the Detail View of a specific Part.
* **Interaction:** 1. The user navigates to a part and views the Documents tab.
    2. A list of currently attached documents is displayed showing the `label` and `filename`.
    3. Clicking an existing document triggers a download or opens it in a new browser/Tauri window.
    4. Clicking "Upload Document" opens a native file picker.
    5. The user selects a file and provides a friendly `label` (e.g., "Texas Instruments Datasheet").
    6. Upon saving, the file is uploaded and added to the list.
* **Mobile Considerations:** The "Upload" button must invoke the native Android file picker. The UI must cleanly handle standard mobile MIME types (like `application/pdf`). 

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A file upload form component using standard HTML `<input type="file">`.
    * API calls must utilize `FormData` to transmit the binary file and the `label` metadata simultaneously.
* **Backend (FastAPI):** * `GET /api/parts/{part_id}/documents` - Returns a list of documents for a part (excluding the heavy BLOB content for performance).
    * `GET /api/documents/{id}/download` - Returns the actual file BLOB with the appropriate `Content-Disposition` headers to trigger a download or browser preview.
    * `POST /api/parts/{part_id}/documents` - Accepts `multipart/form-data`, extracting the file binary and saving it to the database.
    * `DELETE /api/documents/{id}` - Removes the document.
* **Database Schema (SQLite / Peewee):** * Model: `Document`
    * Columns: `id` (PK), `created_on`, `modified_on`, `part_id` (FK to Parts), `label` (VARCHAR 40), `filename` (VARCHAR 30), `content` (BLOB).

## 4. Out of Scope
* Automatic OCR (Optical Character Recognition) to scrape text out of uploaded PDFs.
* Previewing complex/proprietary CAD files directly in the browser; this feature relies on the OS to handle the downloaded file.

---

## 5. Implementation Tasks
- [ ] Define `Document` Peewee model with `part_id` foreign key.
- [ ] Build FastAPI `POST` route to handle `multipart/form-data` uploads.
- [ ] Build FastAPI `GET` download route returning `FileResponse` or streaming response.
- [ ] Create SolidJS UI for listing documents.
- [ ] Create SolidJS UI for uploading new files.
- [ ] Wire frontend forms to the FastAPI backend.
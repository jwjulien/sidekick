---
title: Universal Storage Location Selector Component
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 028-storage-layouts.md
  - 029-homeless-parts.md
---

# Feature: Universal Storage Location Selector Component

## 1. Overview
Selecting a physical storage location is a core interaction required across multiple workflows in Sidekick (e.g., assigning homeless parts, checking in new inventory, relocating components, or assigning storage during BOM execution). 

This feature introduces a reusable **`UniversalLocationSelector`** component (mirroring `UniversalPartsBrowser`). It allows users to select a destination location either by searching by name/keyword or by browsing structurally using cascading **Miller Columns**. Furthermore, it enables users to create new storage bin nodes directly inline within the structural tree, pre-populating suggested location names based on the component being assigned (`part.value`).

## 2. User Experience & UI
* **Dynamic Views & Auto-Switching:**
  * **Upper Right Corner Search Box:** A search input box is embedded directly in the top right header bar of the selector, maximizing modal header real estate and featuring offset magnifying glass styling (`!pl-9`).
  * **Miller Columns View (Default / Empty Search):** When the search box is empty (`""`), the component displays cascading horizontal Miller Columns showing root storage units down to individual shelf, drawer, and bin leaf nodes. Selecting a parent node expands its children in the next column to the right.
  * **Global Database Search List View (Auto-Triggered):** Entering text into the search bar automatically switches the view to a filtered list matching across **all locations in the database** (fetched flat from `/locations?flat=true`). Each search result displays its full hierarchical breadcrumb path (e.g. `Engineering Cabinet A > Drawer 1 > Bin B3`).
  * **Seamless Return:** Clearing the search input (or clicking "✕") instantly returns the component to the Miller Columns view with the user's active column path preserved!
* **Inline Bin Creation in Miller Columns:**
  * At the bottom of each column (or next to the selected parent node), an **"+ Add Bin Here"** button opens a quick creation card inside that column.
  * **Smart Name Suggestion:** If the selector was opened for a specific part (e.g., `part.value = "10k Ohm"`), the name field automatically defaults to `"{part.value} Bin"` (e.g., `"10k Ohm Bin"`). The user can accept or customize the name before saving.
  * Saving instantly updates the storage tree and auto-selects the newly created bin as the target destination.
* **Selection State & Feedback:**
  * Highlighting active column selection paths.
  * Breadcrumb preview showing full hierarchical path (e.g. `Cabinet A > Drawer 2 > Bin B3`).

## 3. Technical Implementation
* **Frontend Component (`client/src/components/storage/UniversalLocationSelector.tsx`):**
  * Props:
    * `selectedLocationId?: string`
    * `onSelectLocation: (location: any) => void`
    * `part?: any` (Optional part context for pre-populating suggested bin names)
    * `mode?: "miller" | "search"`
    * `showInlineCreate?: boolean`
  * Sub-components / Views:
    * Cascading column renderer with active node highlighting.
    * Inline quick creation form under active parent column.
* **Backend API (`FastAPI`):**
  * Leverages existing `GET /locations?flat=true` and `POST /locations` endpoints.
  * Transactionally creates new bin nodes and returns updated hierarchy.

## 4. Scope & Integration
* Replaces static location dropdowns in:
  1. `AssignLocationModal.tsx` (Homeless parts triage workflow).
  2. `PartDetails.tsx` (Stock relocation and bin assignment modal).
  3. `StockController.tsx` (Quick check-in storage selector).

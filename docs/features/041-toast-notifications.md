---
title: Toast Notifications & Undo Pattern
status: Complete
target:
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Toast Notifications & Undo Pattern

## 1. Overview
The Toast Notification system provides non-intrusive, real-time visual feedback for user actions and system events across Sidekick. All notifications adhere to a standardized dark glassmorphic color scheme (`#0f172a` backdrop filter with slate borders) that integrates seamlessly with the rest of the application. It supports distinct visual variants (`info`, `success`, `warning`, `error`), interactive primary and secondary action buttons, and a standardized **Undo Toast** pattern for instant action revertibility.

## 2. User Experience & UI
* **Appearance & Theme:**
  - Glassmorphic dark card (`#0f172a` / slate-900 with `backdrop-blur-md`, 16px rounded corners, crisp white/grey typography).
  - Positioned consistently in the bottom-right corner of the application viewport.
  - Smooth slide-and-fade entry animations.
* **Variants & Accents:**
  - **`info` (Default):** Sky blue icon (`Info`) & subtle accent border highlight (`#38bdf8`).
  - **`success`:** Emerald green icon (`CheckCircle2`) & border highlight (`#34d399`).
  - **`warning`:** Amber yellow icon (`AlertTriangle`) & border highlight (`#fbbf24`).
  - **`error`:** Rose red icon (`AlertCircle`) & border highlight (`#fb7185`).
* **Action Buttons:**
  - Toasts accept an optional list of interactive button actions (`actions`).
  - **`primary` button:** Highlighted with accent color background (e.g. cyan or variant tint) for main suggested actions (such as "Locate in Drawer" or "Undo").
  - **`secondary` button:** Ghost dark style (`bg-slate-800`, border) for secondary choices.
* **Undo Toast Pattern:**
  - When removing items from lists or deleting records, an `undo` toast appears for 6 seconds with a prominent "Undo" button (featuring a `RotateCcw` icon).
  - Clicking "Undo" immediately executes the restoration routine, closes the toast, and displays a confirmation success toast.

## 3. Technical Implementation
* **Frontend Components:**
  - `client/src/components/toast/ToastNotification.tsx`: Core SolidJS reactive Toast UI component rendering message content, variant icons, action buttons, and close button.
  - `client/src/components/toast/Toast.css`: Styling rules overriding `solid-toast` container styles with transparent backgrounds and entry keyframe animations.
  - `client/src/utils/toast.tsx`: Helper utility module exposing `showToast`, `showToast.info()`, `showToast.success()`, `showToast.warning()`, `showToast.error()`, `showToast.undo()`, and unified re-export as `toast`.
* **Container Integration:**
  - `<Toaster position="bottom-right" toastOptions={{ style: { background: "transparent", boxShadow: "none", padding: 0 } }} />` configured in `App.tsx`.
* **API Developer Reference:**
  ```typescript
  import { showToast, toast } from "./utils/toast";

  // Basic variant toasts
  showToast.info("System notification message");
  showToast.success("Part list created successfully!");
  showToast.warning("Quantity below reorder threshold");
  showToast.error("Failed to connect to database");

  // Custom action buttons
  showToast.warning("Item already in active list", {
    actions: [
      {
        title: "Locate in Drawer",
        variant: "primary",
        onClick: () => highlightItem(id)
      }
    ]
  });

  // Standard Undo pattern
  showToast.undo("Removed component from list", async () => {
    await restoreItem(snapshot);
    showToast.success("Component restored!");
  });
  ```

## 4. Out of Scope
* Push notification backend integrations.
* Persistent toast history log drawer (system history is logged in Audit Log).

---

## 5. Implementation Tasks
- [x] Create `client/src/components/toast/ToastNotification.tsx` with dark theme styling, variant icons, close button, and primary/secondary action buttons.
- [x] Create `client/src/components/toast/Toast.css` with dark theme container overrides and slide-in keyframe animations.
- [x] Create `client/src/utils/toast.tsx` utility module providing `showToast`, `info`, `success`, `warning`, `error`, `undo`, and `toast` export alias.
- [x] Configure `<Toaster />` in `client/src/App.tsx` with dark theme container options.
- [x] Refactor item deletion in `PartListItemsTable.tsx` to use `showToast.undo()`.
- [x] Refactor duplicate item warnings in `PartDetails.tsx`, `PartLists.tsx`, and `ActiveListBottomDrawer.tsx` to use `showToast.warning()` with primary action button.
- [x] Create comprehensive unit test suite `ToastNotification.test.tsx`.

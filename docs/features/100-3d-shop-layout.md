---
title: 3D Shop Layout Visualization
status: Draft
target:
- Web
- Windows
- Android
- dependancies: []
---

# Feature: 3D Shop Layout Visualization

## 1. Overview
This feature provides a procedurally generated, 3D wireframe visualization of the shop space[cite: 149, 158]. Users can orbit, navigate, and select subdivided storage drawers and boxes directly from the Tauri application[cite: 149, 284]. The layout is purely data-driven, reading a relational tree structure directly from the database rather than relying on external 3D CAD files[cite: 282, 283].

## 2. User Experience & UI
* **Trigger:** The user loads the primary shop layout view.
* **Interaction:** * Desktop users use native pointer events (click and drag to orbit, scroll to zoom)[cite: 163].
    * Mobile users use touch gestures (swipe to orbit, pinch to zoom)[cite: 284].
    * Clicking or tapping a specific storage bin triggers selection, popping open a UI side panel showing the underlying inventory details[cite: 176, 286].
* **Configuration:** Layout creation is handled via a 2D HTML settings form where users input room dimensions, rack offsets, and row/column matrices[cite: 289, 290].
* **Mobile Considerations:** * To ensure small wireframe lines are selectable on touchscreens, invisible, slightly larger solid bounding boxes must be rendered around the elements to serve as touch "hitboxes"[cite: 285].
    * The webview CSS must include `touch-action: none;` on the 3D canvas container to prevent the mobile OS from triggering scroll or bounce events during 3D navigation[cite: 287, 288].

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Three.js will handle the core 3D engine rendering[cite: 279].
    * Three.js must be natively bound inside a SolidJS `onMount` hook, avoiding heavy framework wrappers (like `solid-three`)[cite: 280].
    * Visuals will utilize Three.js `wireframe: true` materials for lightweight, procedural rendering[cite: 281].
    * `OrbitControls` will be used for camera navigation[cite: 284].
    * A `THREE.Raycaster` will detect clicks/taps and translate normalized device coordinates to fetch the unique ID of the selected bin[cite: 286].
* **Backend (FastAPI):** * API routes must serve the spatial data (dimensions and coordinates) as a JSON tree structure to the frontend[cite: 283].
* **Database Schema (SQLite / Peewee):** * Storage container models must include coordinate parameters so the frontend knows where to mathematically draw the boxes[cite: 172].
    * Required fields include dimensions (`size_x`, `size_y`, `size_z`) and location coordinates (`pos_x`, `pos_y`, `pos_z`)[cite: 174].

## 4. Out of Scope
* Building a complex 3D drag-and-drop CAD layout editor[cite: 289].
* Importing external static 3D models (e.g., `.gltf` or `.obj` files)[cite: 282].

---

## 5. Implementation Tasks
- [ ] Update Peewee SQLite schema to include dimension and coordinate fields for storage units.
- [ ] Build FastAPI route to serve layout tree structure.
- [ ] Create a 2D HTML configuration form to accept structural dimensions.
- [ ] Create SolidJS UI component with an `onMount` hook to initialize the Three.js canvas.
- [ ] Apply `touch-action: none;` to the canvas container.
- [ ] Program procedural wireframe generation logic using the API data.
- [ ] Render invisible solid touch hitboxes around the wireframes.
- [ ] Wire up `OrbitControls` for navigation and `THREE.Raycaster` for object selection.
- [ ] Connect selection callback to open the inventory side panel.
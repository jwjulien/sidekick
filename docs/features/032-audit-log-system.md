---
title: Audit Log & Activity Trail System
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
  - 019-scale-inventory-reconciliation.md
  - 025-cycle-counting.md
  - 027-ubiquitous-stock-controller.md
  - 029-homeless-parts.md
---

# Feature: Audit Log & Activity Trail System

## 1. Overview
The Audit Log & Activity Trail System provides an immutable, system-wide event ledger and audit dashboard for Sidekick. Moving beyond basic part-only transaction logs, this feature records every operational event across the shop—including inventory count adjustments, location relocations, container tare calibrations, scale reconciliations, cycle count variances, project BOM allocations, lost/found part triage, and administrative catalog updates.

By storing full state snapshots (before vs after), structured reason codes, and acquisition methods (scale, scanner, manual), Sidekick gives shop managers and makers total historical visibility, automated discrepancy tracking (identifying stock shrinkage or tare drift over time), and exportable compliance reports.

## 2. User Experience & UI

* **Trigger:** A dedicated "Audit Log" tab in the primary sidebar navigation, as well as an "Activity" tab inside individual Part Details (`PartDetails.tsx`) and Storage Location views.

* **Global Audit Log Feed (`/audit` Route):**
  * **Activity Stream:** A live, chronological feed of all system actions. Each entry displays:
    * Action Type Badge (color-coded: Green = Check-In, Blue = Relocation, Amber = Variance/Discrepancy, Purple = Scale Calibration, Red = Lost Tagged).
    * Entity Name & Link (clickable deep links to the affected Part, Location, or Project).
    * User Avatar & Name.
    * Method Icon (Bluetooth scale, barcode scanner, manual edit, wizard).
    * Quantity Change (+/- Delta) and Standardized Reason Code.
    * Relative Timestamp (e.g., "12 mins ago") with hover tooltip for exact UTC time.
  * **Interactive Diff Drawer:** Clicking any log row opens a side drawer showing full before-and-after JSON state diffs (e.g., `Location`: Bin A1 $\rightarrow$ Bin B4, `Quantity`: 50 $\rightarrow$ 42, `Tare Weight`: 120g $\rightarrow$ 125g).

* **Advanced Filtering & Search Bar:**
  * **Category Filter Pills:** All Events | Stock Changes | Relocations | Scale & Tare | Cycle Counts | Project BOM | Catalog Edits | Discrepancies.
  * **Date Range Selector:** Today, Last 7 Days, Last 30 Days, Custom Date Range.
  * **Method Filter:** All Methods | Manual Entry | Bluetooth Scale | Barcode Scanner | Cycle Count Wizard.
  * **Search Input:** Real-time text search across Part Numbers, SKU, Description, Location Name, User Name, and Notes.

* **Reason Code Prompting:**
  * Whenever a user manually adjusts inventory stock, performs a count overwrite, or writes off parts, Sidekick prompts for a **Reason Code**:
    * `Initial Stocking` - First-time registration or intake.
    * `Supplier Receiving` - Stock received from purchase order.
    * `Assembly Build` - Material consumed for a project assembly.
    * `Cycle Count Adjustment` - Variance corrected during physical audit.
    * `Tare Drift` - Container weight recalibration adjustment.
    * `Scrap / Damage` - Broken, spilled, or defective components.
    * `Lost & Found Triage` - Component marked lost or recovered.
    * `Other` - Custom notes required.

* **Export & Analytics:**
  * One-click "Export CSV" and "Export JSON" buttons to download filtered audit trails for offline auditing or spreadsheet reporting.
  * Summary metrics bar at the top displaying: Total Events (30d), Discrepancy Count, Scale Reconciliations %, and Top Moved Components.

* **Mobile Considerations:**
  * Touch-friendly filter pill carousel, swipeable activity cards, and compact state diff view optimized for mobile screens.

## 3. Technical Implementation

* **Database Schema (`server/app/models.py`):**
  * Refactor / expand `Transaction` into an immutable `AuditLog` table:
    ```python
    class AuditLog(Base):
        __tablename__ = "audit_logs"

        id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
        part_id = Column(String(36), ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
        location_id = Column(String(36), ForeignKey("storage_locations.id", ondelete="SET NULL"), nullable=True)
        project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
        user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
        
        entity_type = Column(String, nullable=False) # 'part', 'storage_location', 'project', 'scale', 'cycle_count'
        entity_id = Column(String, nullable=False)
        action_type = Column(String, nullable=False) # 'create', 'check_in', 'check_out', 'count_update', 'relocation', 'tare_calibration', 'lost_tagged', 'found_tagged', 'homeless_assigned', 'bom_consumed'
        reason_code = Column(String, nullable=True) # 'initial_stocking', 'supplier_receiving', 'assembly_build', 'cycle_count_adjustment', 'tare_drift', 'scrap_damage', 'triage', 'other'
        
        quantity_change = Column(Float, default=0.0)
        previous_state = Column(JSON, nullable=True) # {"quantity": 100, "location_id": "loc_1", "tare_weight": 120}
        new_state = Column(JSON, nullable=True)      # {"quantity": 85,  "location_id": "loc_2", "tare_weight": 125}
        method = Column(String, default="manual")    # 'manual', 'scale', 'scanner', 'cycle_count', 'nfc', 'csv_import'
        notes = Column(Text, nullable=True)
        created_at = Column(DateTime, default=datetime.utcnow, index=True)

        part = relationship("Part")
        user = relationship("User")
        location = relationship("StorageLocation")
        project = relationship("Project")
    ```
  * **Immutability Enforcement:** Database triggers and API restrictions strictly block `UPDATE` and `DELETE` queries on `audit_logs`.

* **Backend Architecture (`server/app/routers/audit.py`):**
  * Centralized logging helper function `log_audit_event(...)` that transactionalizes event writing alongside business logic:
    ```python
    def log_audit_event(
        db: Session,
        entity_type: str,
        entity_id: str,
        action_type: str,
        user_id: str,
        part_id: Optional[str] = None,
        location_id: Optional[str] = None,
        project_id: Optional[str] = None,
        reason_code: Optional[str] = None,
        quantity_change: float = 0.0,
        previous_state: Optional[dict] = None,
        new_state: Optional[dict] = None,
        method: str = "manual",
        notes: Optional[str] = None
    ) -> AuditLog: ...
    ```
  * **Endpoints:**
    * `GET /api/audit/logs` - Query filtered, paginated audit records.
    * `GET /api/audit/stats` - Aggregate metrics (discrepancy counts, reason code distribution).
    * `GET /api/audit/export` - Streaming CSV/JSON export response.

* **Frontend (SolidJS / Tauri):**
  * `client/src/pages/AuditLog.tsx`: Main dashboard with reactive search filters, stats cards, and feed view.
  * `client/src/components/audit/AuditDiffDrawer.tsx`: Formatted JSON diff inspector.
  * `client/src/components/audit/ReasonCodeModal.tsx`: Shared modal prompt for stock adjustment reasons.
  * Integration into `PartDetails.tsx`, `UniversalLocationSelector.tsx`, `ScaleModal.tsx`, `CycleCountWizard.tsx`, and `AssignLocationModal.tsx`.

## 4. Out of Scope

* External enterprise syslog / SIEM webhook integrations (log storage remains local in SQLite).
* Multi-user hierarchical sign-off workflows (e.g. requiring manager authorization for large scrap adjustments).

---

## 5. Implementation Tasks

- [ ] Create `audit_logs` table schema in `server/app/models.py` and run Alembic database migration.
- [ ] Implement `log_audit_event()` helper utility in backend service layer with immutability guarantees.
- [ ] Build FastAPI audit router (`server/app/routers/audit.py`) with filtering, searching, stats, and CSV export.
- [ ] Instrument existing routes (`parts.py`, `locations.py`, `projects.py`) to emit audit events on count changes, relocations, calibrations, and triage actions.
- [ ] Build SolidJS `<ReasonCodeModal />` component for stock change prompts.
- [ ] Build SolidJS `<AuditDiffDrawer />` component for before-and-after state visualization.
- [ ] Implement full `/audit` page route (`client/src/pages/AuditLog.tsx`) with search, filter pills, date range selector, and stats header.
- [ ] Add navigation tab for "Audit Log" to the main app sidebar navigation.
- [ ] Add entity-specific "Activity" history tab to Part Details and Location views.
- [ ] Add backend unit tests for audit log creation, immutability constraints, and filter queries.

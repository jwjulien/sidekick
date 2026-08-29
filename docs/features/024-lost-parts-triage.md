---
title: Lost Parts Triage (Unassigned Inventory)
status: Scrapped
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 029-homeless-parts.md
---

# Feature: Lost Parts Triage

> [!NOTE]
> **Superseded & Merged**: This feature specification has been merged into and superseded by [029-homeless-parts.md](029-homeless-parts.md) (**Homeless Parts Browsing & Organization**).
> 
> All functionality—including unassigned inventory tracking, mobile rapid stow, inline bin creation, and barcode assignment—is implemented under the Homeless Parts workflow.

## 1. Overview
Parts that are logged into the database upon delivery but left in a physical "limbo" box without assigned storage locations are managed via the **Homeless Parts** workflow (`/parts/homeless`).

Please refer to [029-homeless-parts.md](029-homeless-parts.md) for full architectural specifications, UI workflows, and implementation details.
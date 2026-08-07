import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from . import models, auth
from .routers import auth as auth_router, items, locations, categories, uploads

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sidekick Inventory Manager API",
    description="Backend API supporting cross-platform Tauri client with OIDC authentication and local RBAC permissions.",
    version="0.1.0"
)

# Enable CORS for local client and Tauri app origins
origins = [
    "http://localhost:5173",       # Vite dev server
    "http://localhost:3000",       # Alternate dev port
    "tauri://localhost",           # Tauri custom scheme (Windows/Linux)
    "http://tauri.localhost",      # Tauri custom scheme (Android)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(items.router)
app.include_router(uploads.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Sidekick Inventory Manager API",
        "dev_mode": auth.DEV_MODE,
        "oidc_issuer": auth.OIDC_ISSUER_URL
    }

# ----------------- Development Seeding Route -----------------
@app.post("/dev/seed", tags=["development"])
def seed_database(db: Session = Depends(get_db)):
    """
    Populate the SQLite database with mock categories, hierarchical locations,
    custom fields, items, and dev users for testing.
    Only executable if DEV_MODE=True.
    """
    if not auth.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding endpoint is only available in DEV_MODE."
        )
        
    try:
        # Clear existing data in reverse order of foreign keys
        db.query(models.Transaction).delete()
        db.query(models.Attachment).delete()
        db.query(models.CustomFieldValue).delete()
        db.query(models.CustomField).delete()
        db.query(models.Item).delete()
        db.query(models.Location).delete()
        db.query(models.Category).delete()
        db.query(models.User).delete()
        db.commit()
        
        # 1. Seed Users (with OIDC sub mapping corresponding to "dev-role" headers)
        dev_roles = ["admin", "designer", "stocker", "puller", "analyst", "viewer"]
        users_seeded = []
        for role in dev_roles:
            user = models.User(
                oidc_sub=f"dev_sub_{role}",
                email=f"{role}@dev.sidekick",
                username=f"Dev {role.capitalize()}",
                role=role
            )
            db.add(user)
            users_seeded.append(user)
        db.commit()
        admin_user = users_seeded[0]
        
        # 2. Seed Categories
        cat_elec = models.Category(name="Electronics", description="Integrated circuits, microcontrollers, passives, and boards.")
        cat_hard = models.Category(name="Hardware", description="Screws, bolts, brackets, and structural elements.")
        cat_tool = models.Category(name="Tools", description="Soldering equipment, hand tools, meters, and calipers.")
        db.add_all([cat_elec, cat_hard, cat_tool])
        db.commit()
        
        # 3. Seed Custom Fields definitions
        cf_mfg = models.CustomField(name="Manufacturer", field_type="text", category_id=cat_elec.id)
        cf_part = models.CustomField(name="Part Number", field_type="text", category_id=cat_elec.id)
        cf_volts = models.CustomField(name="Operating Voltage", field_type="text", category_id=cat_elec.id)
        
        cf_serial = models.CustomField(name="Serial Number", field_type="text", category_id=cat_tool.id)
        cf_calib = models.CustomField(name="Calibration Date", field_type="date", category_id=cat_tool.id)
        
        db.add_all([cf_mfg, cf_part, cf_volts, cf_serial, cf_calib])
        db.commit()
        
        # 4. Seed Hierarchical Locations
        loc_lab = models.Location(name="Engineering Lab", description="Main R&D laboratory space.")
        loc_wh = models.Location(name="Warehouse A", description="Bulk inventory storage.")
        db.add_all([loc_lab, loc_wh])
        db.commit()
        
        loc_bench = models.Location(name="Workbench 1", description="Electronics assembly workbench.", parent_id=loc_lab.id)
        loc_cab = models.Location(name="Cabinet A", description="Component organizer cabinet.", parent_id=loc_wh.id)
        db.add_all([loc_bench, loc_cab])
        db.commit()
        
        loc_drawer = models.Location(name="Drawer 3", description="Resistors & Capacitors tray.", parent_id=loc_cab.id)
        db.add(loc_drawer)
        db.commit()
        
        # 5. Seed Items
        # Item 1: Resistors (Electronics)
        item_res = models.Item(
            name="10k Ohm Resistor 1/4W",
            description="Metal film resistors, 1% tolerance.",
            sku="RES-10K-025W",
            barcode="074470123456",
            quantity=450,
            min_quantity_alert=100,
            category_id=cat_elec.id,
            location_id=loc_drawer.id
        )
        # Item 2: Soldering Station (Tools)
        item_solder = models.Item(
            name="Digital Soldering Station",
            description="Temperature controlled professional soldering iron.",
            sku="TLS-SLD-DGT",
            barcode="085560987654",
            quantity=3,
            min_quantity_alert=2,
            category_id=cat_tool.id,
            location_id=loc_bench.id
        )
        # Item 3: M3 Screws (Hardware)
        item_screws = models.Item(
            name="M3 x 10mm Machine Screws",
            description="Stainless steel pan head screws.",
            sku="HRD-M3-10SS",
            barcode="093320112233",
            quantity=12,  # Triggering low stock warning!
            min_quantity_alert=50,
            category_id=cat_hard.id,
            location_id=loc_cab.id
        )
        
        db.add_all([item_res, item_solder, item_screws])
        db.commit()
        
        # 6. Seed Custom Field Values
        val_mfg = models.CustomFieldValue(item_id=item_res.id, custom_field_id=cf_mfg.id, value="Yageo")
        val_part = models.CustomFieldValue(item_id=item_res.id, custom_field_id=cf_part.id, value="MFR-25FRF52-10K")
        
        val_serial = models.CustomFieldValue(item_id=item_solder.id, custom_field_id=cf_serial.id, value="SLD-88912-A")
        val_calib = models.CustomFieldValue(item_id=item_solder.id, custom_field_id=cf_calib.id, value="2026-05-12")
        
        db.add_all([val_mfg, val_part, val_serial, val_calib])
        
        # 7. Seed Transactions history logs
        tx_res = models.Transaction(
            item_id=item_res.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=450,
            notes="Seeded initial stock load."
        )
        tx_solder = models.Transaction(
            item_id=item_solder.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=3,
            notes="Seeded calibration tools."
        )
        tx_screws = models.Transaction(
            item_id=item_screws.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=12,
            notes="Seeded base hardware pack."
        )
        db.add_all([tx_res, tx_solder, tx_screws])
        db.commit()
        
        return {"status": "success", "message": "Database seeded with default mock inventory."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(e)}"
        )

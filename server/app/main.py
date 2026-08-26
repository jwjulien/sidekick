import os
import shutil
import sys
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date, datetime
import json
from alembic.config import Config
from alembic import command

from .database import engine, Base, get_db, SIDEKICK_DB_PATH, REFERENCE_DB_PATH, BASE_DIR
from . import models, auth
from .routers import auth as auth_router, parts, locations, categories, uploads, suppliers, projects, products, tares, audit, resolve

# Helper to run Alembic migrations programmatically
def run_startup_migrations():
    try:
        alembic_ini = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini")
        if os.path.exists(alembic_ini):
            alembic_cfg = Config(alembic_ini)
            command.upgrade(alembic_cfg, "head")
    except Exception as e:
        print(f"Startup Alembic migration warning: {e}")

# Run migrations automatically on startup and ensure missing tables are created
run_startup_migrations()
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sidekick Inventory Manager API",
    description="Backend API supporting cross-platform Tauri client with OIDC authentication and local RBAC permissions.",
    version="0.1.0"
)

# Enable CORS for local client and Tauri app origins
origins = [
    "http://localhost:5173",       # Vite dev server
    "http://127.0.0.1:5173",       # Local IP Vite dev server
    "http://localhost:5174",       # Alternate Vite port
    "http://127.0.0.1:5174",       # Alternate Vite IP
    "http://localhost:1420",       # Tauri v2 dev server
    "http://127.0.0.1:1420",      # Local IP dev server
    "http://localhost:1421",       # Alternate Tauri port
    "http://localhost:3000",       # Alternate dev port
    "tauri://localhost",           # Tauri custom scheme (Windows/Linux)
    "http://tauri.localhost",      # Tauri custom scheme (Android)
    "https://tauri.localhost",     # Tauri HTTPS scheme
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers
    )
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    response = JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}"}
    )
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    else:
        response.headers["Access-Control-Allow-Origin"] = "*"
    return response

# Register routers
app.include_router(auth_router.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(parts.router)
app.include_router(uploads.router)
app.include_router(suppliers.router)
app.include_router(projects.router)
app.include_router(products.router)
app.include_router(tares.router)
app.include_router(audit.router)
app.include_router(resolve.router)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "Sidekick Inventory Manager API",
        "dev_mode": auth.DEV_MODE,
        "oidc_issuer": auth.OIDC_ISSUER_URL
    }

# ----------------- Development Seeding Routes -----------------
@app.post("/dev/seed", tags=["development"])
def seed_database(mode: str = "reference", db: Session = Depends(get_db)):
    """
    Reset and seed the SQLite database.
    - mode="reference" (default): Restores the database from data/sidekick_reference.db (full real dataset) and runs Alembic migrations.
    - mode="mock": Resets and injects minimal synthetic test dataset.
    Only executable if DEV_MODE=True.
    """
    if not auth.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding endpoint is only available in DEV_MODE."
        )
        
    if mode == "reference":
        if not os.path.exists(REFERENCE_DB_PATH):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reference database file not found at {REFERENCE_DB_PATH}."
            )
        try:
            db.close()
            engine.dispose()
            shutil.copy2(REFERENCE_DB_PATH, SIDEKICK_DB_PATH)
            run_startup_migrations()
            return {
                "status": "success",
                "message": "Database restored successfully from master reference dataset snapshot.",
                "mode": "reference"
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Restoring reference database failed: {str(e)}"
            )

    try:
        # Recreate tables to ensure schema is fully clean and updated
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        
        # 1. Seed Users (OIDC mappings corresponding to "dev-role" headers)
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
        
        # 2. Seed Categories (hierarchical tree)
        cat_passives = models.Category(title="Passives", designator="PAS")
        cat_semis = models.Category(title="Semiconductors", designator="SEM")
        cat_pcbs = models.Category(title="PCB Assemblies", designator="PCB")
        db.add_all([cat_passives, cat_semis, cat_pcbs])
        db.commit()
        
        cat_resistors = models.Category(title="Resistors", parent_id=cat_passives.id, designator="R")
        cat_capacitors = models.Category(title="Capacitors", parent_id=cat_passives.id, designator="C")
        cat_mcus = models.Category(title="Microcontrollers", parent_id=cat_semis.id, designator="U")
        db.add_all([cat_resistors, cat_capacitors, cat_mcus])
        db.commit()
        
        # 3. Seed Parts
        part_res = models.Part(
            category_id=cat_resistors.id,
            value="10k Ohm",
            number="ERJ-6GEYJ103V",
            package="0805",
            price=0.01,
            weight=0.002,
            threshold=100,
            notes="Metal film resistor, 1% tolerance, 1/10W.",
            attributes={"barcode": "74470123456", "Tolerance": "1%", "Power": "0.1W"}
        )
        part_cap = models.Part(
            category_id=cat_capacitors.id,
            value="100nF",
            number="GRM21BR71H104KA01L",
            package="0805",
            price=0.02,
            weight=0.003,
            threshold=150,
            notes="MLCC ceramic capacitor, 50V, X7R, 10% tolerance.",
            attributes={"barcode": "85560987654", "Voltage": "50V", "Dielectric": "X7R"}
        )
        part_mcu = models.Part(
            category_id=cat_mcus.id,
            value="STM32F103C8T6",
            number="STM32F103C8T6",
            package="LQFP48",
            price=3.50,
            weight=0.2,
            threshold=10,
            notes="ARM Cortex-M3 MCU, 64KB Flash, 72MHz, 2.0V-3.6V.",
            attributes={"barcode": "93320112233", "Architecture": "ARM Cortex-M3"}
        )
        db.add_all([part_res, part_cap, part_mcu])
        db.commit()
        
        # 4. Seed Suppliers
        supplier_digikey = models.Supplier(
            name="DigiKey",
            website="https://www.digikey.com",
            search="https://www.digikey.com/en/products?keywords="
        )
        supplier_mouser = models.Supplier(
            name="Mouser Electronics",
            website="https://www.mouser.com",
            search="https://www.mouser.com/c/?q="
        )
        db.add_all([supplier_digikey, supplier_mouser])
        db.commit()
        
        # 5. Seed Products (distributor catalog entries)
        prod_res_dk = models.Product(supplier_id=supplier_digikey.id, part_id=part_res.id, sku="P10K-0805-DK")
        prod_res_ms = models.Product(supplier_id=supplier_mouser.id, part_id=part_res.id, sku="603-RC0805JR-0710KL")
        prod_mcu_dk = models.Product(supplier_id=supplier_digikey.id, part_id=part_mcu.id, sku="497-6060-ND")
        prod_mcu_ms = models.Product(supplier_id=supplier_mouser.id, part_id=part_mcu.id, sku="511-STM32F103C8T6")
        db.add_all([prod_res_dk, prod_res_ms, prod_mcu_dk, prod_mcu_ms])
        db.commit()
        
        # 6. Seed Storage Locations (hierarchical bins and stock quantities)
        storage_cabinet = models.Storage(name="Engineering Cabinet A", description="Lab component storage cabinet.")
        db.add(storage_cabinet)
        db.commit()
        
        storage_drawer1 = models.Storage(name="Drawer 1 - Passives", parent_id=storage_cabinet.id, description="Tray for passive R and C components.")
        storage_drawer2 = models.Storage(name="Drawer 2 - Chips", parent_id=storage_cabinet.id, description="Tray for active semiconductor components.")
        db.add_all([storage_drawer1, storage_drawer2])
        db.commit()
        
        storage_slot_res = models.Storage(
            name="Bin A1 (10k Resistors)",
            parent_id=storage_drawer1.id,
            part_id=part_res.id,
            quantity=450,
            description="Slot for 10k 0805 resistors."
        )
        storage_slot_cap = models.Storage(
            name="Bin A2 (100nF Capacitors)",
            parent_id=storage_drawer1.id,
            part_id=part_cap.id,
            quantity=80, # Low stock alert triggers (threshold is 150)
            description="Slot for 100nF 0805 decoupling capacitors."
        )
        storage_slot_mcu = models.Storage(
            name="Bin B1 (STM32 MCUs)",
            parent_id=storage_drawer2.id,
            part_id=part_mcu.id,
            quantity=8, # Low stock alert triggers (threshold is 10)
            description="Slot for STM32F103 microcontrollers in ESD foam."
        )
        db.add_all([storage_slot_res, storage_slot_cap, storage_slot_mcu])
        db.commit()
        
        # 7. Seed Projects & Assemblies & Revisions & materials (BOM lists)
        proj_sensor = models.Project(
            title="Wireless Sensor Node PCB",
            description="Low-power IoT environmental telemetry PCB containing humidity and temperature sensors."
        )
        proj_motor = models.Project(
            title="BLDC Motor Controller Assembly",
            description="Brushless DC motor speed regulator shield with high power MOSFET stage."
        )
        db.add_all([proj_sensor, proj_motor])
        db.commit()
        
        assembly_sensor = models.Assembly(project_id=proj_sensor.id, name="Sensor Assembly")
        assembly_motor = models.Assembly(project_id=proj_motor.id, name="Motor Assembly")
        db.add_all([assembly_sensor, assembly_motor])
        db.commit()
        
        rev_sensor_v1 = models.Revision(
            assembly_id=assembly_sensor.id,
            version="v1.0.0",
            date=date(2026, 1, 15)
        )
        rev_motor_v2 = models.Revision(
            assembly_id=assembly_motor.id,
            version="v2.1.0",
            date=date(2026, 7, 20)
        )
        db.add_all([rev_sensor_v1, rev_motor_v2])
        db.commit()
        
        # BOM lines for Sensor Node
        bom1 = models.Material(revision_id=rev_sensor_v1.id, part_id=part_res.id, quantity=1, designator="R1")
        bom2 = models.Material(revision_id=rev_sensor_v1.id, part_id=part_res.id, quantity=1, designator="R2")
        bom3 = models.Material(revision_id=rev_sensor_v1.id, part_id=part_cap.id, quantity=2, designator="C1")
        bom4 = models.Material(revision_id=rev_sensor_v1.id, part_id=part_mcu.id, quantity=1, designator="U1")
        # Add a ghost material to Sensor Node
        bom_ghost1 = models.Material(revision_id=rev_sensor_v1.id, part_id=None, quantity=1, designator="U2", ghost_description="Temperature Sensor IC (I2C)")
        
        # BOM lines for Motor Controller
        bom5 = models.Material(revision_id=rev_motor_v2.id, part_id=part_cap.id, quantity=1, designator="C1")
        bom6 = models.Material(revision_id=rev_motor_v2.id, part_id=part_cap.id, quantity=1, designator="C2")
        bom7 = models.Material(revision_id=rev_motor_v2.id, part_id=part_mcu.id, quantity=1, designator="U1")
        # Add a ghost material to Motor Controller
        bom_ghost2 = models.Material(revision_id=rev_motor_v2.id, part_id=None, quantity=10, designator="R10", ghost_description="0.1 Ohm Current Sense Resistor (1206)")
        db.add_all([bom1, bom2, bom3, bom4, bom_ghost1, bom5, bom6, bom7, bom_ghost2])
        db.commit()
        
        # 8. Seed Audit Transaction history logs
        tx_res = models.Transaction(
            part_id=part_res.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=450,
            notes="Seeded initial passives drawer stock."
        )
        tx_cap = models.Transaction(
            part_id=part_cap.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=80,
            notes="Seeded initial capacitors tray load."
        )
        tx_mcu = models.Transaction(
            part_id=part_mcu.id,
            user_id=admin_user.id,
            action_type="create",
            quantity_change=8,
            notes="Seeded initial microcontroller foam units."
        )
        db.add_all([tx_res, tx_cap, tx_mcu])
        db.commit()
        
        return {"status": "success", "message": "Database seeded with synthetic test inventory.", "mode": "mock"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(e)}"
        )


@app.post("/dev/seed/save-reference", tags=["development"])
def save_reference_seed(db: Session = Depends(get_db)):
    """
    Save current active database (sidekick.db) as the master reference seed dataset (sidekick_reference.db).
    Only executable if DEV_MODE=True.
    """
    if not auth.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Saving reference endpoint is only available in DEV_MODE."
        )
        
    try:
        if BASE_DIR not in sys.path:
            sys.path.insert(0, BASE_DIR)
        from data.update_reference_seed import update_reference_seed
        
        db.close()
        engine.dispose()
        update_reference_seed()
        return {
            "status": "success",
            "message": "Successfully saved current active database as master reference seed dataset."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save reference dataset: {str(e)}"
        )

